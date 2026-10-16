import resend

from app.core.config import get_settings


def send_email(to: str, subject: str, html: str) -> None:
    settings = get_settings()
    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {"from": settings.email_from, "to": [to], "subject": subject, "html": html}
    )


def send_welcome_email(to: str) -> None:
    send_email(
        to,
        "Καλώς ήρθες στο UniCompass!",
        "<p>Congrats on passing the Panhellenic exams! "
        "We'll help you settle into your new city.</p>",
    )
