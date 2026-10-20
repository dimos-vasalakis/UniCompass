import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.schemas.daily_life import DailyLife
from app.schemas.metro import MetroOut

Factor = Literal[
    "safety",
    "commute",
    "rent",
    "quiet",
    "nightlife",
    "green",
    "amenities",
    "student_life",
    "home",
]
FACTORS: tuple[Factor, ...] = Factor.__args__  # type: ignore[attr-defined]
Weight = Annotated[int, Field(ge=0, le=5)]


class Point(BaseModel):
    text: str
    factor: str | None = None


class MatchRequest(BaseModel):
    department_id: uuid.UUID
    # 0 = don't care … 5 = very important. Missing factors count as 0.
    weights: dict[Factor, Weight] = Field(default_factory=dict)
    home_hub_slug: str | None = None
    max_rent: int | None = Field(default=None, gt=0)
    max_commute: int | None = Field(default=None, gt=0)

    def weight(self, factor: Factor) -> int:
        return self.weights.get(factor, 0)


class MatchArea(BaseModel):
    slug: str
    name: str
    name_el: str
    zone: str
    lat: float
    lng: float
    description: str
    match: int  # 0–100
    drivers: list[Factor]
    factor_scores: dict[Factor, float]  # 0–1, higher is better
    typical_studio_rent: int
    commute_minutes: int
    commute_estimated: bool
    home_minutes: int | None
    home_estimated: bool | None
    pros: list[Point]
    cons: list[Point]
    daily_life: DailyLife | None = None
    metro: MetroOut | None = None


class MatchResponse(BaseModel):
    results: list[MatchArea]
    considered: int  # areas in the city
    within_limits: int  # areas left after max_rent / max_commute


class SavedMatchOut(BaseModel):
    id: uuid.UUID
    department_id: uuid.UUID
    department: str
    university: str  # short name
    created_at: datetime
    preferences: MatchRequest
    results: list[MatchArea]
