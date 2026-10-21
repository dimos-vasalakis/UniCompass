import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.daily_life import CanteenOut
from app.schemas.metro import MetroOut

MAX_IMAGES = 3
MAX_IMAGE_BYTES = 1_500_000  # decoded; the frontend resizes to ≤1568px JPEG first
MAX_TEXT_CHARS = 6000

ImageType = Literal["image/jpeg", "image/png", "image/webp"]
Verdict = Literal["good", "fair", "overpriced", "suspicious", "not_a_listing"]


class ListingImage(BaseModel):
    media_type: ImageType
    data_base64: str = Field(max_length=MAX_IMAGE_BYTES * 4 // 3 + 4)


class ListingCheckRequest(BaseModel):
    # The student's department, so the commute and canteen are theirs. Optional.
    department_id: uuid.UUID | None = None
    text: str | None = Field(default=None, max_length=MAX_TEXT_CHARS)
    images: list[ListingImage] = Field(default_factory=list, max_length=MAX_IMAGES)


class ListingDetails(BaseModel):
    """What Claude read from the listing; null when the listing doesn't say."""

    rent_eur: int | None
    size_m2: int | None
    floor: str | None
    heating: str | None
    furnished: bool | None
    bills_included: bool | None
    deposit_months: float | None
    address_text: str | None
    # One of the slugs we gave Claude, or null if the area isn't clear.
    area_slug: str | None


class ListingTexts(BaseModel):
    """The written part of the answer, in one language."""

    summary: str
    pros: list[str]
    cons: list[str]
    red_flags: list[str]
    questions_for_landlord: list[str]


class ListingAnalysis(BaseModel):
    """Claude's structured answer (output_format of the Messages API call).

    The text comes in both languages from the one call, so the result follows
    the language toggle at any time, like the rest of the site."""

    is_listing: bool
    details: ListingDetails
    verdict: Verdict
    en: ListingTexts
    el: ListingTexts
    # Always Greek: landlords are Greek, whatever the student's UI language.
    landlord_message_el: str


class AreaFacts(BaseModel):
    """Numbers from our own data, never from the model."""

    slug: str
    name: str
    name_el: str
    typical_studio_rent: int
    price_vs_area_pct: int | None  # +15 = 15% above the area's typical rent
    commute_minutes: int | None
    commute_estimated: bool | None
    canteen: CanteenOut | None = None
    metro: MetroOut | None = None


class ListingCheckResult(ListingAnalysis):
    area: AreaFacts | None = None

    @model_validator(mode="before")
    @classmethod
    def _single_language(cls, data: Any) -> Any:
        """Checks stored before both languages existed have one flat set of texts."""
        if isinstance(data, dict) and "summary" in data and "en" not in data:
            fields = ListingTexts.model_fields
            texts = {k: data.pop(k) for k in list(data) if k in fields}
            data = {**data, "en": texts, "el": texts}
        return data


class ListingCheckOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    lang: str
    department_id: uuid.UUID | None
    input_text: str | None
    image_count: int
    result: ListingCheckResult


class ListingCheckCreated(ListingCheckOut):
    remaining: int  # checks left after this one (unchanged for a replayed key)


class ListingCheckLimits(BaseModel):
    """Public, so the sign-up pitch and the form use the backend's real limits."""

    checks_per_account: int
    max_images: int
    max_text_chars: int


class ListingChecksOut(BaseModel):
    limit: int
    used: int
    remaining: int
    checks: list[ListingCheckOut]
