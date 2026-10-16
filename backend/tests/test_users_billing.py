import hashlib
import hmac
import json
import time
import uuid

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.db import get_db
from app.main import app
from app.services import billing
from tests.conftest import (
    TEST_DATABASE_URL,
    TEST_STRIPE_WEBHOOK_SECRET,
    auth_header,
    requires_db,
)

WEBHOOK = "/api/v1/billing/webhook"


def stripe_signature(payload: bytes, secret: str = TEST_STRIPE_WEBHOOK_SECRET) -> str:
    ts = int(time.time())
    mac = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256)
    return f"t={ts},v1={mac.hexdigest()}"


def checkout_completed(user_id: uuid.UUID | str | None) -> bytes:
    return json.dumps(
        {
            "id": "evt_test",
            "object": "event",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "object": "checkout.session",
                    "client_reference_id": None if user_id is None else str(user_id),
                    "customer": "cus_test123",
                }
            },
        }
    ).encode()


def test_webhook_requires_signature_header(
    client: TestClient, db_must_not_be_used
) -> None:
    assert client.post(WEBHOOK, content=b"{}").status_code == 400
    assert db_must_not_be_used == []


def test_webhook_rejects_bad_signature(client: TestClient) -> None:
    payload = checkout_completed(uuid.uuid4())
    res = client.post(
        WEBHOOK,
        content=payload,
        headers={"Stripe-Signature": stripe_signature(payload, "whsec_wrong")},
    )
    assert res.status_code == 400


def signed(payload: bytes) -> dict[str, str]:
    return {"Stripe-Signature": stripe_signature(payload)}


@pytest.fixture
def db_must_not_be_used():
    """Replace get_db with a session that fails the test if anything touches it."""
    opened: list[bool] = []

    class Untouchable:
        def __getattr__(self, name):
            raise AssertionError(f"DB session used: {name}")

    async def fake_db():
        opened.append(True)
        yield Untouchable()

    app.dependency_overrides[get_db] = fake_db
    yield opened
    app.dependency_overrides.pop(get_db)


def test_bad_signature_never_opens_a_db_session(
    client: TestClient, db_must_not_be_used
) -> None:
    payload = checkout_completed(uuid.uuid4())
    res = client.post(
        WEBHOOK,
        content=payload,
        headers={"Stripe-Signature": stripe_signature(payload, "whsec_wrong")},
    )
    assert res.status_code == 400
    assert db_must_not_be_used == []


@pytest.mark.parametrize(
    "ref", ["not-a-uuid", "", None], ids=["garbage", "empty", "missing"]
)
def test_webhook_acknowledges_events_without_a_valid_user(
    client: TestClient, db_must_not_be_used, ref
) -> None:
    # e.g. a Payment Link sale: must be 200 (or Stripe retries for days), and
    # must not touch any profile.
    payload = checkout_completed(ref)
    res = client.post(WEBHOOK, content=payload, headers=signed(payload))
    assert res.status_code == 200


def test_webhook_returns_503_when_database_unconfigured(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(get_settings(), "database_url", "")
    payload = checkout_completed(uuid.uuid4())
    res = client.post(WEBHOOK, content=payload, headers=signed(payload))
    assert res.status_code == 503


def test_checkout_always_creates_a_stripe_customer(monkeypatch) -> None:
    import asyncio

    captured: dict = {}

    class FakeSessions:
        async def create_async(self, params):
            captured.update(params)
            return type("S", (), {"url": "https://checkout.stripe.test/abc"})()

    class FakeClient:
        checkout = type("C", (), {"sessions": FakeSessions()})()

    monkeypatch.setattr(billing, "_client", lambda: FakeClient())
    user = uuid.uuid4()
    url = asyncio.run(billing.create_checkout_session(user, "a@b.gr"))

    assert url == "https://checkout.stripe.test/abc"
    assert captured["customer_creation"] == "always"
    assert captured["client_reference_id"] == str(user)
    assert captured["mode"] == "payment"


@requires_db
def test_checkout_completed_makes_user_premium(client: TestClient, test_user) -> None:
    payload = checkout_completed(test_user)
    res = client.post(
        WEBHOOK,
        content=payload,
        headers={"Stripe-Signature": stripe_signature(payload)},
    )
    assert res.status_code == 200, res.text

    with psycopg.connect(TEST_DATABASE_URL) as conn:
        row = conn.execute(
            "select is_premium, stripe_customer_id from public.profiles where id = %s",
            (test_user,),
        ).fetchone()
    assert row == (True, "cus_test123")

    me = client.get("/api/v1/users/me", headers=auth_header(test_user)).json()
    assert me["is_premium"] is True


@requires_db
def test_get_and_update_profile(client: TestClient, make_user) -> None:
    user = make_user(full_name="Eleni")
    headers = auth_header(user)

    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["full_name"] == "Eleni"
    assert me.json()["role"] == "high_school"

    updated = client.patch(
        "/api/v1/users/me",
        json={"full_name": "Eleni K.", "role": "university"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Eleni K."
    assert (
        client.get("/api/v1/users/me", headers=headers).json()["role"] == "university"
    )


@requires_db
def test_profile_update_validates_role(client: TestClient, test_user) -> None:
    res = client.patch(
        "/api/v1/users/me", json={"role": "admin"}, headers=auth_header(test_user)
    )
    assert res.status_code == 422


@requires_db
def test_profile_update_cannot_grant_premium(client: TestClient, test_user) -> None:
    client.patch(
        "/api/v1/users/me", json={"is_premium": True}, headers=auth_header(test_user)
    )
    me = client.get("/api/v1/users/me", headers=auth_header(test_user)).json()
    assert me["is_premium"] is False
