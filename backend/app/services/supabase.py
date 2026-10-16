from supabase import AsyncClient, acreate_client

from app.core.config import get_settings

_admin: AsyncClient | None = None


async def get_supabase_admin() -> AsyncClient:
    """Service-role client for Auth admin / Storage. Bypasses RLS — server-side only.

    Database queries go through SQLAlchemy (app.core.db), not this client.
    """
    global _admin
    if _admin is None:
        settings = get_settings()
        _admin = await acreate_client(
            settings.supabase_url, settings.supabase_service_role_key
        )
    return _admin
