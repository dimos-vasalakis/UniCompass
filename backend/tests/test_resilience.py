"""The API should degrade clearly when Postgres or Upstash are unavailable."""

import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.core.config import get_settings, is_unset
from app.core.db import get_db
from app.main import app
from app.services import cache


@pytest.mark.parametrize(
    ("url", "unset"),
    [
        ("", True),
        (
            "postgresql://postgres.<project-ref>:pw@aws-0-<region>.pooler.supabase.com:6543/postgres",
            True,
        ),
        ("postgresql://postgres:pw@localhost:5432/postgres", False),
    ],
)
def test_is_unset(url: str, unset: bool) -> None:
    assert is_unset(url) is unset


def test_unconfigured_database_returns_503(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "database_url", "")
    res = client.get("/api/v1/hubs")
    assert res.status_code == 503
    assert "DATABASE_URL" in res.json()["detail"]


def test_unreachable_database_returns_503_with_cors(client: TestClient) -> None:
    async def broken_db():
        raise OperationalError("select 1", {}, Exception("could not connect"))
        yield  # pragma: no cover

    app.dependency_overrides[get_db] = broken_db
    try:
        res = client.get("/api/v1/hubs", headers={"Origin": "http://localhost:3000"})
    finally:
        app.dependency_overrides.pop(get_db)
    assert res.status_code == 503
    assert res.json() == {"detail": "Database unavailable"}
    # The browser can only read the error if CORS headers survive.
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_cache_is_a_noop_without_upstash() -> None:
    assert cache.get_redis() is None
    assert asyncio.run(cache.cache_get("k")) is None
    asyncio.run(cache.cache_set("k", {"a": 1}))
    asyncio.run(cache.cache_delete("k"))


class BrokenRedis:
    async def get(self, key):
        raise ConnectionError("upstash down")

    set = delete = get


def test_cache_errors_are_swallowed(monkeypatch) -> None:
    monkeypatch.setattr(cache, "get_redis", lambda: BrokenRedis())
    assert asyncio.run(cache.cache_get("k")) is None
    asyncio.run(cache.cache_set("k", 1))
    asyncio.run(cache.cache_delete("k"))


class MemoryRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value

    async def delete(self, key):
        self.store.pop(key, None)


def test_cache_round_trip(monkeypatch) -> None:
    redis = MemoryRedis()
    monkeypatch.setattr(cache, "get_redis", lambda: redis)
    asyncio.run(cache.cache_set("k", {"a": [1, 2]}))
    assert asyncio.run(cache.cache_get("k")) == {"a": [1, 2]}
    asyncio.run(cache.cache_delete("k"))
    assert asyncio.run(cache.cache_get("k")) is None
