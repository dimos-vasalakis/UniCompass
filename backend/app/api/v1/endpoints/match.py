import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.db import DbSession
from app.core.security import CurrentUserDep
from app.models import SavedMatch, University
from app.schemas.match import (
    MatchRequest,
    MatchResponse,
    SavedMatchOut,
)
from app.services import places
from app.services.matching import match as run_match

router = APIRouter(prefix="/match", tags=["match"])


async def _run(body: MatchRequest, db: DbSession) -> MatchResponse:
    department = await places.get_department(db, body.department_id)
    if department is None:
        raise HTTPException(404, "Department not found")

    areas = await places.load_match_inputs(db, department.campus_id, body.home_hub_slug)
    results, within = run_match(areas, body)
    university = await db.get(University, department.university_id)
    await places.attach_daily_life(db, results, university.slug)
    return MatchResponse(results=results, considered=len(areas), within_limits=within)


@router.post("", response_model=MatchResponse)
async def match(body: MatchRequest, db: DbSession) -> MatchResponse:
    return await _run(body, db)


@router.post("/save", response_model=SavedMatchOut, status_code=status.HTTP_201_CREATED)
async def save_match(
    body: MatchRequest, user: CurrentUserDep, db: DbSession
) -> SavedMatchOut:
    # Recompute server-side rather than trusting results sent by the client.
    response = await _run(body, db)
    row = SavedMatch(
        id=uuid.uuid4(),
        user_id=user.id,
        department_id=body.department_id,
        preferences=body.model_dump(mode="json"),
        result=[r.model_dump(mode="json") for r in response.results],
    )
    db.add(row)
    await db.commit()
    return SavedMatchOut(
        id=row.id, department_id=row.department_id, results=response.results
    )


@router.get("/saved", response_model=list[SavedMatchOut])
async def saved_matches(user: CurrentUserDep, db: DbSession) -> list[SavedMatchOut]:
    rows = await db.scalars(
        select(SavedMatch)
        .where(SavedMatch.user_id == user.id)
        .order_by(SavedMatch.created_at.desc())
    )
    return [
        SavedMatchOut(id=r.id, department_id=r.department_id, results=r.result)
        for r in rows
    ]
