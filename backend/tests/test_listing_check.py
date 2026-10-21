import asyncio
import base64
import uuid
from collections.abc import Iterator
from concurrent import futures
from concurrent.futures import ThreadPoolExecutor

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.listing_check import ListingAnalysis, ListingDetails
from app.services.listing_check import (
    AnalyzerError,
    AreaRow,
    CheckContext,
    FakeAnalyzer,
    build_result,
    get_analyzer,
)
from tests.conftest import TEST_DATABASE_URL, auth_header, requires_db

URL = "/api/v1/assistant/listing-checks"
SCORES = dict.fromkeys(
    ("safety", "quiet", "nightlife", "green", "amenities", "student_life"), 3
)


def _area(slug: str, rent: int) -> AreaRow:
    return AreaRow(
        slug=slug,
        name=slug.title(),
        name_el=slug,
        zone="east",
        lat=37.97,
        lng=23.77,
        typical_studio_rent=rent,
        scores=SCORES,
        commute_minutes=20,
        commute_estimated=False,
    )


def _analysis(area_slug: str | None, rent: int | None) -> ListingAnalysis:
    return ListingAnalysis(
        is_listing=True,
        details=ListingDetails(
            rent_eur=rent,
            size_m2=30,
            floor="2",
            heating=None,
            furnished=True,
            bills_included=None,
            deposit_months=2,
            address_text=None,
            area_slug=area_slug,
        ),
        verdict="fair",
        summary="ok",
        pros=[],
        cons=[],
        red_flags=[],
        questions_for_landlord=[],
        landlord_message_el="Καλησπέρα",
    )


def test_area_facts_use_our_numbers() -> None:
    ctx = CheckContext([_area("zografou", 400)], None, None)
    result = build_result(_analysis("zografou", 460), ctx, [], "en")
    assert result.area is not None
    assert result.area.typical_studio_rent == 400
    assert result.area.price_vs_area_pct == 15
    assert result.area.commute_minutes == 20
    assert result.area.canteen is None  # no department → no canteen of "theirs"


def test_unknown_area_slug_from_the_model_is_dropped() -> None:
    ctx = CheckContext([_area("zografou", 400)], None, None)
    result = build_result(_analysis("atlantis", 460), ctx, [], "en")
    assert result.details.area_slug is None
    assert result.area is None


def test_no_rent_means_no_price_comparison() -> None:
    ctx = CheckContext([_area("zografou", 400)], None, None)
    result = build_result(_analysis("zografou", None), ctx, [], "en")
    assert result.area.price_vs_area_pct is None


def test_requires_an_account(client: TestClient) -> None:
    assert client.post(URL, json={"text": "flat"}).status_code == 401
    assert client.get(URL).status_code == 401


# Validation runs before any quota or DB work, so no DB is needed.
@pytest.mark.parametrize(
    "body",
    [
        {},
        {"text": "   "},
        {"images": [{"media_type": "image/gif", "data_base64": "AAAA"}]},
        {"images": [{"media_type": "image/png", "data_base64": "not base64!"}]},
        {"images": [{"media_type": "image/png", "data_base64": "AAAA"}] * 4},
        {"text": "x" * 6001},
    ],
)
def test_invalid_input_is_rejected(client: TestClient, body: dict) -> None:
    res = client.post(URL, json=body, headers=auth_header(uuid.uuid4()))
    assert res.status_code == 422


def test_unconfigured_assistant_returns_503(client: TestClient) -> None:
    app.dependency_overrides[get_analyzer] = lambda: None
    try:
        res = client.post(URL, json={"text": "flat"}, headers=auth_header(uuid.uuid4()))
    finally:
        app.dependency_overrides.pop(get_analyzer)
    assert res.status_code == 503


class FailingAnalyzer:
    async def analyze(self, *args: object) -> ListingAnalysis:
        raise AnalyzerError


@pytest.fixture
def fake_claude() -> Iterator[None]:
    app.dependency_overrides[get_analyzer] = FakeAnalyzer
    yield
    app.dependency_overrides.pop(get_analyzer, None)


def _used(user_id: uuid.UUID) -> int:
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        return conn.execute(
            "select listing_checks_used from public.profiles where id = %s", (user_id,)
        ).fetchone()[0]


@requires_db
def test_three_checks_then_402(client: TestClient, test_user, fake_claude) -> None:
    headers = auth_header(test_user)
    for _ in range(3):
        res = client.post(
            URL, json={"text": "Studio in zografou, 450€"}, headers=headers
        )
        assert res.status_code == 201, res.text
    body = res.json()
    assert body["result"]["details"]["area_slug"] == "zografou"
    assert body["result"]["area"]["typical_studio_rent"] > 0

    res = client.post(URL, json={"text": "one more"}, headers=headers)
    assert res.status_code == 402
    assert _used(test_user) == 3

    listing = client.get(URL, headers=headers).json()
    assert (listing["limit"], listing["used"], listing["remaining"]) == (3, 3, 0)
    assert len(listing["checks"]) == 3


@requires_db
def test_concurrent_requests_cannot_overspend(
    client: TestClient, test_user, fake_claude
) -> None:
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute(
            "update public.profiles set listing_checks_used = 2 where id = %s",
            (test_user,),
        )
    headers = auth_header(test_user)
    with ThreadPoolExecutor(4) as pool:
        codes = list(
            pool.map(
                lambda _: (
                    client.post(URL, json={"text": "flat"}, headers=headers).status_code
                ),
                range(4),
            )
        )
    assert sorted(codes) == [201, 402, 402, 402]
    assert _used(test_user) == 3


@requires_db
def test_failed_answer_refunds_the_check(client: TestClient, test_user) -> None:
    app.dependency_overrides[get_analyzer] = FailingAnalyzer
    try:
        res = client.post(URL, json={"text": "flat"}, headers=auth_header(test_user))
    finally:
        app.dependency_overrides.pop(get_analyzer)
    assert res.status_code == 502
    assert _used(test_user) == 0


@requires_db
def test_repeated_idempotency_key_spends_one_check(
    client: TestClient, test_user, fake_claude
) -> None:
    headers = {**auth_header(test_user), "Idempotency-Key": str(uuid.uuid4())}
    first = client.post(URL, json={"text": "flat"}, headers=headers)
    second = client.post(URL, json={"text": "flat"}, headers=headers)
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert _used(test_user) == 1


@requires_db
def test_checks_are_private(client: TestClient, make_user, fake_claude) -> None:
    alice, bob = make_user(), make_user()
    check = client.post(URL, json={"text": "flat"}, headers=auth_header(alice)).json()
    assert (
        client.get(f"{URL}/{check['id']}", headers=auth_header(alice)).status_code
        == 200
    )
    assert (
        client.get(f"{URL}/{check['id']}", headers=auth_header(bob)).status_code == 404
    )
    assert client.get(URL, headers=auth_header(bob)).json()["checks"] == []


@requires_db
def test_department_adds_commute_and_canteen(
    client: TestClient, test_user, fake_claude
) -> None:
    unis = client.get("/api/v1/universities").json()
    nkua = next(u for u in unis if u["slug"] == "nkua")
    dept = next(d for d in nkua["departments"] if d["campus_slug"] == "nkua-zografou")
    res = client.post(
        URL,
        json={"department_id": dept["id"], "text": "Studio in zografou, 400€"},
        headers=auth_header(test_user),
    )
    area = res.json()["result"]["area"]
    assert area["commute_minutes"] is not None
    assert area["canteen"]["university"] == nkua["short_name"]


@requires_db
def test_images_are_accepted_but_not_stored(
    client: TestClient, test_user, fake_claude
) -> None:
    png = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 100).decode()
    res = client.post(
        URL,
        json={"images": [{"media_type": "image/png", "data_base64": png}]},
        headers=auth_header(test_user),
    )
    assert res.status_code == 201
    assert res.json()["image_count"] == 1
    assert png not in res.text


class CrashingAnalyzer:
    async def analyze(self, *args: object) -> ListingAnalysis:
        raise RuntimeError("unexpected")


@requires_db
def test_any_failure_after_spending_refunds_the_check(
    client: TestClient, test_user
) -> None:
    app.dependency_overrides[get_analyzer] = CrashingAnalyzer
    try:
        with pytest.raises(RuntimeError):
            client.post(URL, json={"text": "flat"}, headers=auth_header(test_user))
    finally:
        app.dependency_overrides.pop(get_analyzer)
    assert _used(test_user) == 0


@requires_db
def test_response_carries_remaining_checks(
    client: TestClient, test_user, fake_claude
) -> None:
    headers = {**auth_header(test_user), "Idempotency-Key": str(uuid.uuid4())}
    assert (
        client.post(URL, json={"text": "flat"}, headers=headers).json()["remaining"]
        == 2
    )
    # A replayed key spends nothing, and says so.
    assert (
        client.post(URL, json={"text": "flat"}, headers=headers).json()["remaining"]
        == 2
    )


def test_limits_are_public(client: TestClient) -> None:
    res = client.get("/api/v1/assistant/limits")
    assert res.json() == {
        "checks_per_account": 3,
        "max_images": 3,
        "max_text_chars": 6000,
    }


@requires_db
def test_replay_works_even_when_the_assistant_is_down(
    client: TestClient, test_user, fake_claude
) -> None:
    headers = {**auth_header(test_user), "Idempotency-Key": str(uuid.uuid4())}
    first = client.post(URL, json={"text": "flat"}, headers=headers)
    app.dependency_overrides[get_analyzer] = lambda: None
    second = client.post(URL, json={"text": "flat"}, headers=headers)
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]


class CancelledAnalyzer:
    async def analyze(self, *args: object) -> ListingAnalysis:
        raise asyncio.CancelledError


@requires_db
def test_cancelled_request_refunds_the_check(client: TestClient, test_user) -> None:
    app.dependency_overrides[get_analyzer] = CancelledAnalyzer
    try:
        # TestClient surfaces the cancelled request as concurrent.futures'.
        with pytest.raises(futures.CancelledError):
            client.post(URL, json={"text": "flat"}, headers=auth_header(test_user))
    finally:
        app.dependency_overrides.pop(get_analyzer)
    assert _used(test_user) == 0


def _pending(user_id: uuid.UUID, key: uuid.UUID, age: str = "0 seconds") -> None:
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute(
            "insert into public.listing_checks (user_id, lang, idempotency_key, created_at) "
            "values (%s, 'en', %s, now() - %s::interval)",
            (user_id, key, age),
        )


@requires_db
def test_retry_while_answering_spends_nothing(
    client: TestClient, test_user, fake_claude
) -> None:
    key = uuid.uuid4()
    _pending(test_user, key)  # the first request is still waiting on Claude
    headers = {**auth_header(test_user), "Idempotency-Key": str(key)}
    res = client.post(URL, json={"text": "flat"}, headers=headers)
    assert res.status_code == 409
    assert _used(test_user) == 0
    # Pending checks aren't shown anywhere yet.
    assert client.get(URL, headers=auth_header(test_user)).json()["checks"] == []


@requires_db
def test_stale_pending_check_is_released(
    client: TestClient, test_user, fake_claude
) -> None:
    key = uuid.uuid4()
    _pending(test_user, key, "10 minutes")  # its worker died after spending
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute(
            "update public.profiles set listing_checks_used = 1 where id = %s",
            (test_user,),
        )
    headers = {**auth_header(test_user), "Idempotency-Key": str(key)}
    res = client.post(URL, json={"text": "flat"}, headers=headers)
    assert res.status_code == 201
    assert _used(test_user) == 1  # refunded, then spent once for this answer


@requires_db
def test_no_checks_left_frees_the_reservation(
    client: TestClient, test_user, fake_claude
) -> None:
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute(
            "update public.profiles set listing_checks_used = 3 where id = %s",
            (test_user,),
        )
    res = client.post(URL, json={"text": "flat"}, headers=auth_header(test_user))
    assert res.status_code == 402
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        count = conn.execute(
            "select count(*) from public.listing_checks where user_id = %s",
            (test_user,),
        ).fetchone()[0]
    assert count == 0


@requires_db
def test_stale_pending_check_with_another_key_is_released(
    client: TestClient, test_user, fake_claude
) -> None:
    _pending(test_user, uuid.uuid4(), "10 minutes")  # worker died; student edited
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute(
            "update public.profiles set listing_checks_used = 1 where id = %s",
            (test_user,),
        )
    res = client.post(URL, json={"text": "edited flat"}, headers=auth_header(test_user))
    assert res.status_code == 201
    assert _used(test_user) == 1
