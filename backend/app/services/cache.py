import asyncio
import json
import logging
from functools import lru_cache
from typing import Any

from upstash_redis.asyncio import Redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Upstash calls normally take ~100ms. The client has no timeout of its own, so
# cap each call: a slow cache should cost a miss, not the request.
TIMEOUT_SECONDS = 1.0


@lru_cache
def get_redis() -> Redis | None:
    settings = get_settings()
    if not (settings.upstash_redis_rest_url and settings.upstash_redis_rest_token):
        return None  # Caching disabled (e.g. local dev without Upstash).
    return Redis(
        url=settings.upstash_redis_rest_url,
        token=settings.upstash_redis_rest_token,
        # The default retries a failed call once after sleeping 3s, which turned
        # every broken cache call into a 3s stall. A miss is cheaper.
        rest_retries=0,
    )


# The cache is an optimisation: if Upstash is down or unconfigured, every
# helper degrades to a miss / no-op instead of failing the request.


async def cache_get(key: str) -> Any | None:
    redis = get_redis()
    if redis is None:
        return None
    try:
        raw = await asyncio.wait_for(redis.get(key), TIMEOUT_SECONDS)
    except Exception:
        logger.warning("cache_get failed for %s", key, exc_info=True)
        return None
    return json.loads(raw) if raw is not None else None


async def cache_set(key: str, value: Any, ttl_seconds: int = 3600) -> None:
    redis = get_redis()
    if redis is None:
        return
    try:
        await asyncio.wait_for(
            redis.set(key, json.dumps(value), ex=ttl_seconds), TIMEOUT_SECONDS
        )
    except Exception:
        logger.warning("cache_set failed for %s", key, exc_info=True)


async def cache_delete(key: str) -> None:
    redis = get_redis()
    if redis is None:
        return
    try:
        await asyncio.wait_for(redis.delete(key), TIMEOUT_SECONDS)
    except Exception:
        logger.warning("cache_delete failed for %s", key, exc_info=True)
