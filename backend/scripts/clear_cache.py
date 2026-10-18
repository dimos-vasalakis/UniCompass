"""Drop cached reference data (Upstash `places:*`) so the API serves fresh rows.

    python -m scripts.clear_cache

scripts.seed calls this itself: without it, text cached before a reseed (for
example English fallbacks cached before the Greek was loaded) keeps being
served for up to the cache TTL. No-op when Upstash isn't configured.
"""

from upstash_redis import Redis

from app.core.config import get_settings
from app.services.places import PREFIX


def clear_places_cache() -> int:
    settings = get_settings()
    if not (settings.upstash_redis_rest_url and settings.upstash_redis_rest_token):
        return 0
    redis = Redis(
        url=settings.upstash_redis_rest_url, token=settings.upstash_redis_rest_token
    )
    deleted, cursor = 0, 0
    while True:
        cursor, keys = redis.scan(cursor, match=f"{PREFIX}:*", count=200)
        if keys:
            deleted += redis.delete(*keys)
        if int(cursor) == 0:
            return deleted


if __name__ == "__main__":
    print(f"Cleared {clear_places_cache()} cached entries.")
