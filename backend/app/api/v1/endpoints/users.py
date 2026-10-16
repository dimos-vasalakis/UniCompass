from fastapi import APIRouter, HTTPException

from app.core.security import CurrentUserDep
from app.schemas.profile import Profile, ProfileUpdate
from app.services.cache import cache_delete, cache_get, cache_set
from app.services.supabase import get_supabase_admin

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=Profile)
async def read_me(user: CurrentUserDep) -> Profile:
    key = f"profile:{user.id}"
    if cached := await cache_get(key):
        return Profile(**cached)

    res = (
        get_supabase_admin()
        .table("profiles")
        .select("*")
        .eq("id", user.id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(404, "Profile not found")

    profile = Profile(**res.data)
    await cache_set(key, profile.model_dump(), ttl_seconds=300)
    return profile


@router.patch("/me", response_model=Profile)
async def update_me(body: ProfileUpdate, user: CurrentUserDep) -> Profile:
    res = (
        get_supabase_admin()
        .table("profiles")
        .update(body.model_dump(exclude_none=True))
        .eq("id", user.id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Profile not found")
    await cache_delete(f"profile:{user.id}")
    return Profile(**res.data[0])
