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

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_premium_price_id: str = ""

    resend_api_key: str = ""
    email_from: str = "UniCompass <hello@example.com>"

    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
