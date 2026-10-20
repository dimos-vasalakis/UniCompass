import asyncio
import time
import uuid
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient

from app.core import security
from app.core.security import get_current_user
from tests.conftest import make_token

USER = uuid.uuid4()


def creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_valid_token_yields_user() -> None:
    user = asyncio.run(get_current_user(creds(make_token(USER))))
    assert user.id == USER
    assert user.email == f"{USER}@test.local"


@pytest.mark.parametrize(
    "token",
    [
        "not-a-jwt",
        make_token(USER, secret="some-other-secret-that-is-32-bytes!!"),
        make_token(USER, aud="anon"),
        make_token(USER, exp=int(time.time()) - 60),
    ],
    ids=["garbage", "wrong-secret", "wrong-audience", "expired"],
)
def test_bad_tokens_are_rejected(token: str) -> None:
    with pytest.raises(HTTPException) as exc:
        asyncio.run(get_current_user(creds(token)))
    assert exc.value.status_code == 401


def test_es256_token_uses_jwks_even_with_hs256_secret_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Supabase projects on asymmetric signing keys still have a legacy secret.
    key = ec.generate_private_key(ec.SECP256R1())
    token = jwt.encode(
        {"sub": str(USER), "aud": "authenticated", "exp": int(time.time()) + 60},
        key,
        algorithm="ES256",
    )
    jwks = SimpleNamespace(
        get_signing_key_from_jwt=lambda _: SimpleNamespace(key=key.public_key())
    )
    monkeypatch.setattr(security, "_jwks_client", lambda: jwks)

    assert asyncio.run(get_current_user(creds(token))).id == USER


def test_missing_token_is_rejected() -> None:
    with pytest.raises(HTTPException) as exc:
        asyncio.run(get_current_user(None))
    assert exc.value.status_code == 401


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/v1/users/me"),
        ("patch", "/api/v1/users/me"),
        ("post", "/api/v1/billing/checkout"),
        ("post", "/api/v1/match/save"),
        ("get", "/api/v1/match/saved"),
    ],
)
def test_protected_endpoints_need_auth(
    client: TestClient, method: str, path: str
) -> None:
    res = client.request(
        method, path, json={}, headers={"Authorization": "Bearer nope"}
    )
    assert res.status_code == 401
