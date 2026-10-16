import uuid
from functools import lru_cache

import stripe
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Profile
from app.services.cache import cache_delete


@lru_cache
def _client() -> stripe.StripeClient:
    return stripe.StripeClient(
        get_settings().stripe_secret_key, http_client=stripe.HTTPXClient()
    )


async def create_checkout_session(user_id: uuid.UUID, email: str | None) -> str:
    settings = get_settings()
    session = await _client().checkout.sessions.create_async(
        params={
            "mode": "payment",
            "line_items": [{"price": settings.stripe_premium_price_id, "quantity": 1}],
            "customer_email": email,
            "client_reference_id": str(user_id),
            "success_url": f"{settings.frontend_url}/dashboard?checkout=success",
            "cancel_url": f"{settings.frontend_url}/pricing?checkout=cancelled",
        }
    )
    return session.url


def construct_event(payload: bytes, signature: str) -> stripe.Event:
    # Pure signature check, no I/O — fine to call from async code.
    return stripe.Webhook.construct_event(
        payload, signature, get_settings().stripe_webhook_secret
    )


async def handle_event(event: stripe.Event, db: AsyncSession) -> None:
    if event.type == "checkout.session.completed":
        session = event.data.object
        user_id = session.get("client_reference_id")
        if user_id:
            await db.execute(
                update(Profile)
                .where(Profile.id == uuid.UUID(user_id))
                .values(is_premium=True, stripe_customer_id=session.get("customer"))
            )
            await db.commit()
            await cache_delete(f"profile:{user_id}")
