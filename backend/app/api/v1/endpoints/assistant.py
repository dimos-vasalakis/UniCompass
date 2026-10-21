import base64
import binascii
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert

from app.core.config import get_settings
from app.core.db import DbSession
from app.core.lang import LangParam
from app.core.security import CurrentUserDep
from app.models import ListingCheck
from app.schemas.listing_check import (
    MAX_IMAGE_BYTES,
    MAX_IMAGES,
    MAX_TEXT_CHARS,
    ListingCheckCreated,
    ListingCheckLimits,
    ListingCheckOut,
    ListingCheckRequest,
    ListingChecksOut,
)
from app.services import listing_check, places
from app.services.listing_check import Analyzer, AnalyzerError, get_analyzer

router = APIRouter(prefix="/assistant", tags=["assistant"])

STILL_CHECKING = "Still checking this listing"
# A pending row older than this belongs to a worker that died mid-answer. Must
# exceed the longest Claude call (2 attempts × listing_check.TIMEOUT_SECONDS),
# and the frontend's 409 polling must outlast it.
STALE_PENDING = timedelta(minutes=5)

AnalyzerDep = Annotated[Analyzer | None, Depends(get_analyzer)]


def _out(row: ListingCheck) -> ListingCheckOut:
    return ListingCheckOut(
        id=row.id,
        created_at=row.created_at,
        lang=row.lang,
        department_id=row.department_id,
        input_text=row.input_text,
        image_count=row.image_count,
        result=row.result,
    )


def _validate(body: ListingCheckRequest) -> None:
    if not (body.text and body.text.strip()) and not body.images:
        raise HTTPException(422, "Send the listing text or at least one screenshot")
    for img in body.images:
        try:
            raw = base64.b64decode(img.data_base64, validate=True)
        except binascii.Error:
            raise HTTPException(422, "Invalid image data") from None
        if len(raw) > MAX_IMAGE_BYTES:
            raise HTTPException(422, "Image too large")


async def _get_check(
    db: DbSession, user_id: uuid.UUID, **where: object
) -> ListingCheck | None:
    query = select(ListingCheck).where(ListingCheck.user_id == user_id)
    for column, value in where.items():
        query = query.where(getattr(ListingCheck, column) == value)
    return await db.scalar(query)


@router.get("/limits", response_model=ListingCheckLimits)
async def limits() -> ListingCheckLimits:
    return ListingCheckLimits(
        checks_per_account=get_settings().listing_check_limit,
        max_images=MAX_IMAGES,
        max_text_chars=MAX_TEXT_CHARS,
    )


@router.get("/listing-checks", response_model=ListingChecksOut)
async def list_checks(user: CurrentUserDep, db: DbSession) -> ListingChecksOut:
    limit = get_settings().listing_check_limit
    used = await listing_check.checks_used(db, user.id)
    rows = await db.scalars(
        select(ListingCheck)
        .where(ListingCheck.user_id == user.id, ListingCheck.result.is_not(None))
        .order_by(ListingCheck.created_at.desc())
    )
    return ListingChecksOut(
        limit=limit,
        used=used,
        remaining=max(limit - used, 0),
        checks=[_out(r) for r in rows],
    )


@router.get("/listing-checks/{check_id}", response_model=ListingCheckOut)
async def get_check(
    check_id: uuid.UUID, user: CurrentUserDep, db: DbSession
) -> ListingCheckOut:
    row = await _get_check(db, user.id, id=check_id)
    if row is None or row.result is None:
        raise HTTPException(404, "Listing check not found")
    return _out(row)


async def _created(
    db: DbSession, user_id: uuid.UUID, row: ListingCheck
) -> ListingCheckCreated:
    used = await listing_check.checks_used(db, user_id)
    remaining = max(get_settings().listing_check_limit - used, 0)
    return ListingCheckCreated(**_out(row).model_dump(), remaining=remaining)


@router.post(
    "/listing-checks",
    response_model=ListingCheckCreated,
    status_code=status.HTTP_201_CREATED,
)
async def create_check(
    body: ListingCheckRequest,
    user: CurrentUserDep,
    db: DbSession,
    analyzer: AnalyzerDep,
    lang: LangParam = "en",
    idempotency_key: Annotated[uuid.UUID | None, Header()] = None,
) -> ListingCheckCreated:
    _validate(body)

    # Pending rows left behind by a worker that died mid-answer, whatever their
    # key: free them and give back the checks they spent.
    stale = await db.scalars(
        select(ListingCheck.id).where(
            ListingCheck.user_id == user.id,
            ListingCheck.result.is_(None),
            ListingCheck.created_at < datetime.now(UTC) - STALE_PENDING,
        )
    )
    for stale_id in stale.all():
        await listing_check.release_check(stale_id, user.id)

    # A retried or double-clicked submit sends the same key: hand back the
    # first answer without spending another check. The client makes a new key
    # whenever the listing or department changes.
    if idempotency_key is not None:
        existing = await _get_check(db, user.id, idempotency_key=idempotency_key)
        if existing is not None and existing.result is not None:
            return await _created(db, user.id, existing)
        if existing is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, STILL_CHECKING)
    limit = get_settings().listing_check_limit
    # Cheap early answer; spend_check below is the race-safe check.
    if await listing_check.checks_used(db, user.id) >= limit:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "No checks left")
    if analyzer is None:
        raise HTTPException(503, "Assistant unavailable")

    ctx = await listing_check.load_context(db, body.department_id, lang)
    if ctx is None:
        raise HTTPException(404, "Department not found")
    # Only used for the student's own canteen, which needs a department.
    canteens = await places.list_canteens(db) if ctx.university_slug else []

    # Reserve the key before spending or calling Claude: a retry that arrives
    # mid-answer finds this pending row and gets 409, never a second paid call.
    check_id = await db.scalar(
        insert(ListingCheck)
        .values(
            user_id=user.id,
            department_id=body.department_id,
            lang=lang,
            input_text=body.text,
            image_count=len(body.images),
            idempotency_key=idempotency_key,
        )
        .on_conflict_do_nothing(index_elements=["user_id", "idempotency_key"])
        .returning(ListingCheck.id)
    )
    await db.commit()
    if check_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, STILL_CHECKING)

    if not await listing_check.spend_check(db, user.id, limit):
        await db.execute(delete(ListingCheck).where(ListingCheck.id == check_id))
        await db.commit()
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, "No checks left")
    # From here on, any failure drops the pending row and gives the check back.
    try:
        analysis = await analyzer.analyze(body, ctx, lang)
        result = listing_check.build_result(analysis, ctx, canteens, lang)
        stored = await db.scalar(
            update(ListingCheck)
            .where(ListingCheck.id == check_id)
            .values(result=result.model_dump(mode="json"))
            .returning(ListingCheck.id)
        )
        await db.commit()
    except BaseException as e:  # incl. CancelledError: the check must come back
        await listing_check.release_check(check_id, user.id)
        if isinstance(e, AnalyzerError):
            raise HTTPException(
                502, "The assistant couldn't answer, try again"
            ) from None
        raise

    if stored is None:
        # Taken for a dead worker's row and already released (and refunded) by
        # another request: nothing to store the answer on.
        raise HTTPException(502, "The assistant couldn't answer, try again")
    row = await _get_check(db, user.id, id=check_id)
    return await _created(db, user.id, row)
