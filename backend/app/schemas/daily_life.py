from typing import Literal

from pydantic import BaseModel


class NearbyPlaceOut(BaseModel):
    name: str
    lat: float
    lng: float
    walk_minutes: int


class CanteenOut(BaseModel):
    slug: str
    name: str
    name_el: str
    university: str  # short name
    address: str | None
    lat: float
    lng: float
    approximate: bool
    mode: Literal["walk", "transit"]
    minutes: int  # always an estimate


class DailyLife(BaseModel):
    """Nearest supermarket, gym and student restaurant, for the result cards."""

    nearby_loaded: bool = True  # False: supermarket/gym data hasn't been loaded
    supermarket: NearbyPlaceOut | None = None
    gym: NearbyPlaceOut | None = None
    canteen: CanteenOut | None = None
