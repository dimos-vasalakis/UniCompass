from fastapi import APIRouter, HTTPException

from app.core.db import DbSession
from app.schemas.places import (
    HubOut,
    NeighborhoodDetail,
    NeighborhoodSummary,
    UniversityOut,
)
from app.services import places

router = APIRouter(tags=["places"])


@router.get("/universities", response_model=list[UniversityOut])
async def universities(db: DbSession) -> list[UniversityOut]:
    return await places.list_universities(db)


@router.get("/hubs", response_model=list[HubOut])
async def hubs(db: DbSession) -> list[HubOut]:
    return await places.list_hubs(db)


@router.get("/neighborhoods", response_model=list[NeighborhoodSummary])
async def neighborhoods(db: DbSession) -> list[NeighborhoodSummary]:
    return await places.list_neighborhoods(db)


@router.get("/neighborhoods/{slug}", response_model=NeighborhoodDetail)
async def neighborhood(slug: str, db: DbSession) -> NeighborhoodDetail:
    detail = await places.get_neighborhood(db, slug)
    if detail is None:
        raise HTTPException(404, "Neighborhood not found")
    return detail
