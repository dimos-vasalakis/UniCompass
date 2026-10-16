import stripe
from fastapi import APIRouter, Header, HTTPException, Request

from app.core.security import CurrentUserDep
from app.schemas.billing import CheckoutResponse
from app.services import billing

router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/checkout", response_model=CheckoutResponse)
def create_checkout(user: CurrentUserDep) -> CheckoutResponse:
    return CheckoutResponse(url=billing.create_checkout_session(user.id, user.email))


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request, stripe_signature: str = Header(alias="Stripe-Signature")
) -> dict[str, bool]:
    payload = await request.body()
    try:
        event = billing.construct_event(payload, stripe_signature)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise HTTPException(400, "Invalid webhook") from exc
    billing.handle_event(event)
    return {"received": True}
