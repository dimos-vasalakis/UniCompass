import httpx

from app.core.config import get_settings

RESEND_API_URL = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, html: str) -> None:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from,
                "to": [to],
                "subject": subject,
                "html": html,
            },
        )
        res.raise_for_status()


async def send_welcome_email(to: str) -> None:
    await send_email(
        to,
        "Καλώς ήρθες στο UniCompass!",
        "<p>Congrats on passing the Panhellenic exams! "
        "We'll help you settle into your new city.</p>",
    )
