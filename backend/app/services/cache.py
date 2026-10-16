import json
import logging
from functools import lru_cache
from typing import Any

from upstash_redis.asyncio import Redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache
def get_redis() -> Redis | None:
    settings = get_settings()
    if not (settings.upstash_redis_rest_url and settings.upstash_redis_rest_token):
        return None  # Caching disabled (e.g. local dev without Upstash).
    return Redis(
        url=settings.upstash_redis_rest_url,
        token=settings.upstash_redis_rest_token,
    )


# The cache is an optimisation: if Upstash is down or unconfigured, every
# helper degrades to a miss / no-op instead of failing the request.


async def cache_get(key: str) -> Any | None:
    redis = get_redis()
    if redis is None:
        return None
    try:
        raw = await redis.get(key)
    except Exception:
        logger.warning("cache_get failed for %s", key, exc_info=True)
        return None
    return json.loads(raw) if raw is not None else None


async def cache_set(key: str, value: Any, ttl_seconds: int = 3600) -> None:
    redis = get_redis()
    if redis is None:
        return
    try:
        await redis.set(key, json.dumps(value), ex=ttl_seconds)
    except Exception:
        logger.warning("cache_set failed for %s", key, exc_info=True)


async def cache_delete(key: str) -> None:
    redis = get_redis()
    if redis is None:
        return
    try:
        await redis.delete(key)
    except Exception:
        logger.warning("cache_delete failed for %s", key, exc_info=True)
