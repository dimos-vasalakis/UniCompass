import json
from functools import lru_cache
from typing import Any

from upstash_redis.asyncio import Redis

from app.core.config import get_settings


@lru_cache
def get_redis() -> Redis:
    settings = get_settings()
    return Redis(
        url=settings.upstash_redis_rest_url,
        token=settings.upstash_redis_rest_token,
    )


async def cache_get(key: str) -> Any | None:
    raw = await get_redis().get(key)
    return json.loads(raw) if raw is not None else None


async def cache_set(key: str, value: Any, ttl_seconds: int = 3600) -> None:
    await get_redis().set(key, json.dumps(value), ex=ttl_seconds)


async def cache_delete(key: str) -> None:
    await get_redis().delete(key)
