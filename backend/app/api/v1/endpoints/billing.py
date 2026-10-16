from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.core.db import DbSession
from app.core.security import CurrentUserDep
from app.schemas.billing import CheckoutResponse
from app.services import billing

router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(user: CurrentUserDep) -> CheckoutResponse:
    url = await billing.create_checkout_session(user.id, user.email)
    return CheckoutResponse(url=url)


async def verified_event(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> stripe.Event:
    # Optional + manual 400 (not a 422 validation error) so a missing header
    # stops here instead of FastAPI carrying on to resolve the DB dependency.
    if not stripe_signature:
        raise HTTPException(400, "Missing Stripe-Signature header")
    try:
        return billing.construct_event(await request.body(), stripe_signature)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise HTTPException(400, "Invalid webhook") from exc


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    # Order matters: FastAPI resolves dependencies in sequence, so the
    # signature is checked before a DB session is opened for unsigned junk.
    event: Annotated[stripe.Event, Depends(verified_event)],
    db: DbSession,
) -> dict[str, bool]:
    await billing.handle_event(event, db)
    return {"received": True}
