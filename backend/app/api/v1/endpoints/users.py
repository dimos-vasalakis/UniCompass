from fastapi import APIRouter, HTTPException

from app.core.db import DbSession
from app.core.security import CurrentUserDep
from app.models import Profile as ProfileModel
from app.schemas.profile import Profile, ProfileUpdate
from app.services.cache import cache_delete, cache_get, cache_set

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=Profile)
async def read_me(user: CurrentUserDep, db: DbSession) -> Profile:
    key = f"profile:{user.id}"
    if cached := await cache_get(key):
        return Profile(**cached)

    row = await db.get(ProfileModel, user.id)
    if row is None:
        raise HTTPException(404, "Profile not found")

    profile = Profile.model_validate(row)
    await cache_set(key, profile.model_dump(mode="json"), ttl_seconds=300)
    return profile


@router.patch("/me", response_model=Profile)
async def update_me(
    body: ProfileUpdate, user: CurrentUserDep, db: DbSession
) -> Profile:
    row = await db.get(ProfileModel, user.id)
    if row is None:
        raise HTTPException(404, "Profile not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    await db.commit()
    await cache_delete(f"profile:{user.id}")
    return Profile.model_validate(row)
