from fastapi import APIRouter, HTTPException

from app.core.db import DbSession
from app.core.lang import LangParam
from app.schemas.places import (
    HubOut,
    NeighborhoodDetail,
    NeighborhoodSummary,
    UniversityOut,
)
from app.services import places

router = APIRouter(tags=["places"])


@router.get("/universities", response_model=list[UniversityOut])
async def universities(db: DbSession, lang: LangParam = "en") -> list[UniversityOut]:
    return await places.list_universities(db, lang)


@router.get("/hubs", response_model=list[HubOut])
async def hubs(db: DbSession, lang: LangParam = "en") -> list[HubOut]:
    return await places.list_hubs(db, lang)


@router.get("/neighborhoods", response_model=list[NeighborhoodSummary])
async def neighborhoods(db: DbSession) -> list[NeighborhoodSummary]:
    return await places.list_neighborhoods(db)


@router.get("/neighborhoods/{slug}", response_model=NeighborhoodDetail)
async def neighborhood(
    slug: str, db: DbSession, lang: LangParam = "en"
) -> NeighborhoodDetail:
    detail = await places.get_neighborhood(db, slug, lang)
    if detail is None:
        raise HTTPException(404, "Neighborhood not found")
    return detail
