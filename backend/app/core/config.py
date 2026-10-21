from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "UniCompass API"
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"
    cors_origins: list[str] = ["http://localhost:3000"]

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    database_url: str = ""  # transaction pooler, used by the app
    direct_url: str = ""  # direct connection, used by Alembic

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_premium_price_id: str = ""

    resend_api_key: str = ""
    email_from: str = "UniCompass <hello@example.com>"

    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""

    sentry_dsn: str = ""

    # Listing Check assistant. Every account gets listing_check_limit checks, ever.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5-5"
    listing_check_limit: int = 3
    # Dev/CI only: answer listing checks with a canned result instead of calling
    # Claude (ignored when ENVIRONMENT=production).
    listing_check_fake: bool = False

    # Only used by scripts/compute_travel_times.py, never at request time.
    google_maps_api_key: str = ""


def is_unset(url: str) -> bool:
    """Empty, or still the <placeholder> value from .env.example."""
    return not url or "<" in url


def sqlalchemy_url(url: str) -> str:
    """Use the psycopg 3 driver for plain postgres:// URIs copied from Supabase."""
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
