import uuid
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status
from sqlalchemy import Row, Select, delete, select
from sqlalchemy.dialects.postgresql import insert

from app.core.db import DbSession
from app.core.lang import Lang, LangParam, pick
from app.core.security import CurrentUserDep
from app.models import Department, SavedMatch, University
from app.schemas.match import (
    MatchRequest,
    MatchResponse,
    SavedMatchOut,
)
from app.services import places
from app.services.matching import match as run_match
from app.services.metro import nearest_station

router = APIRouter(prefix="/match", tags=["match"])


async def _run(body: MatchRequest, db: DbSession, lang: Lang) -> MatchResponse:
    department = await places.get_department(db, body.department_id)
    if department is None:
        raise HTTPException(404, "Department not found")

    areas = await places.load_match_inputs(
        db, department.campus_id, body.home_hub_slug, lang
    )
    results, within = run_match(areas, body)
    university = await db.get(University, department.university_id)
    await places.attach_daily_life(db, results, university.slug)
    for area in results:
        area.metro = nearest_station(area.lat, area.lng, lang)
    return MatchResponse(results=results, considered=len(areas), within_limits=within)


@router.post("", response_model=MatchResponse)
async def match(
    body: MatchRequest, db: DbSession, lang: LangParam = "en"
) -> MatchResponse:
    return await _run(body, db, lang)


def _saved_query(user_id: uuid.UUID) -> Select:
    return (
        select(SavedMatch, Department.name, Department.name_el, University.short_name)
        .join(Department, Department.id == SavedMatch.department_id)
        .join(University, University.id == Department.university_id)
        .where(SavedMatch.user_id == user_id)
    )


def _saved_out(row: Row, lang: Lang) -> SavedMatchOut:
    saved, dept_name, dept_name_el, uni_short = row
    return SavedMatchOut(
        id=saved.id,
        department_id=saved.department_id,
        department=pick(lang, dept_name, dept_name_el),
        university=uni_short,
        created_at=saved.created_at,
        preferences=saved.preferences,
        results=saved.result,
    )


async def _get_saved(
    db: DbSession, user_id: uuid.UUID, match_id: uuid.UUID, lang: Lang
) -> SavedMatchOut:
    row = (
        await db.execute(_saved_query(user_id).where(SavedMatch.id == match_id))
    ).one_or_none()
    if row is None:
        raise HTTPException(404, "Saved match not found")
    return _saved_out(row, lang)


@router.post("/save", response_model=SavedMatchOut, status_code=status.HTTP_201_CREATED)
async def save_match(
    body: MatchRequest,
    user: CurrentUserDep,
    db: DbSession,
    lang: LangParam = "en",
    idempotency_key: Annotated[uuid.UUID | None, Header()] = None,
) -> SavedMatchOut:
    # A retried or double-clicked Save sends the same key: hand back the first row.
    if idempotency_key is not None:
        existing = await db.scalar(
            select(SavedMatch.id).where(
                SavedMatch.user_id == user.id,
                SavedMatch.idempotency_key == idempotency_key,
            )
        )
        if existing is not None:
            return await _get_saved(db, user.id, existing, lang)

    # Recompute server-side rather than trusting results sent by the client.
    response = await _run(body, db, lang)
    match_id = uuid.uuid4()
    await db.execute(
        insert(SavedMatch)
        .values(
            id=match_id,
            user_id=user.id,
            department_id=body.department_id,
            preferences=body.model_dump(mode="json"),
            result=[r.model_dump(mode="json") for r in response.results],
            idempotency_key=idempotency_key,
        )
        # Two concurrent requests with one key: the loser returns the winner's row.
        .on_conflict_do_nothing(index_elements=["user_id", "idempotency_key"])
    )
    await db.commit()
    if idempotency_key is not None:
        match_id = await db.scalar(
            select(SavedMatch.id).where(
                SavedMatch.user_id == user.id,
                SavedMatch.idempotency_key == idempotency_key,
            )
        )
    return await _get_saved(db, user.id, match_id, lang)


@router.get("/saved", response_model=list[SavedMatchOut])
async def saved_matches(
    user: CurrentUserDep, db: DbSession, lang: LangParam = "en"
) -> list[SavedMatchOut]:
    rows = await db.execute(
        _saved_query(user.id).order_by(SavedMatch.created_at.desc())
    )
    return [_saved_out(row, lang) for row in rows]


@router.get("/saved/{match_id}", response_model=SavedMatchOut)
async def saved_match(
    match_id: uuid.UUID, user: CurrentUserDep, db: DbSession, lang: LangParam = "en"
) -> SavedMatchOut:
    return await _get_saved(db, user.id, match_id, lang)


@router.delete("/saved/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saved_match(
    match_id: uuid.UUID, user: CurrentUserDep, db: DbSession
) -> None:
    deleted = await db.scalar(
        delete(SavedMatch)
        .where(SavedMatch.id == match_id, SavedMatch.user_id == user.id)
        .returning(SavedMatch.id)
    )
    if deleted is None:
        raise HTTPException(404, "Saved match not found")
    await db.commit()
