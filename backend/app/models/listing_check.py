import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, SmallInteger, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ListingCheck(Base):
    """One answer from the Listing Check assistant. The screenshots aren't kept."""

    __tablename__ = "listing_checks"
    __table_args__ = (
        Index(
            "listing_checks_user_idempotency_key",
            "user_id",
            "idempotency_key",
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), index=True
    )
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL")
    )
    lang: Mapped[str] = mapped_column(Text)
    input_text: Mapped[str | None] = mapped_column(Text)
    image_count: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    # NULL while Claude is answering: the row reserves the idempotency key.
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    idempotency_key: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
