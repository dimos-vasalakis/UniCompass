import stripe

from app.core.config import get_settings
from app.services.supabase import get_supabase_admin


def _client() -> stripe.StripeClient:
    return stripe.StripeClient(get_settings().stripe_secret_key)


def create_checkout_session(user_id: str, email: str | None) -> str:
    settings = get_settings()
    session = _client().checkout.sessions.create(
        params={
            "mode": "payment",
            "line_items": [{"price": settings.stripe_premium_price_id, "quantity": 1}],
            "customer_email": email,
            "client_reference_id": user_id,
            "success_url": f"{settings.frontend_url}/dashboard?checkout=success",
            "cancel_url": f"{settings.frontend_url}/pricing?checkout=cancelled",
        }
    )
    return session.url


def construct_event(payload: bytes, signature: str) -> stripe.Event:
    return stripe.Webhook.construct_event(
        payload, signature, get_settings().stripe_webhook_secret
    )


def handle_event(event: stripe.Event) -> None:
    if event.type == "checkout.session.completed":
        session = event.data.object
        user_id = session.get("client_reference_id")
        if user_id:
            get_supabase_admin().table("profiles").update(
                {"is_premium": True, "stripe_customer_id": session.get("customer")}
            ).eq("id", user_id).execute()
