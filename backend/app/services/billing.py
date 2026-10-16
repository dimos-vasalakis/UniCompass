import logging
import uuid
from functools import lru_cache

import stripe
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Profile
from app.services.cache import cache_delete

logger = logging.getLogger(__name__)


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
            # Payment mode doesn't create a Customer by default; we want one so
            # stripe_customer_id is set (receipts, refunds, future purchases).
            "customer_creation": "always",
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
        # StripeObjects aren't dicts in stripe>=12: use attributes, not .get().
        raw_user_id = getattr(session, "client_reference_id", None)
        try:
            user_id = uuid.UUID(raw_user_id) if raw_user_id else None
        except ValueError:
            user_id = None
        if user_id is None:
            # Not from our checkout (e.g. a Payment Link). Acknowledge it so
            # Stripe doesn't retry for days, but leave a trace to investigate.
            logger.warning(
                "Ignoring %s %s: client_reference_id %r is not a user id",
                event.type,
                getattr(event, "id", "?"),
                raw_user_id,
            )
            return
        await db.execute(
            update(Profile)
            .where(Profile.id == user_id)
            .values(
                is_premium=True,
                stripe_customer_id=getattr(session, "customer", None),
            )
        )
        await db.commit()
        await cache_delete(f"profile:{user_id}")
