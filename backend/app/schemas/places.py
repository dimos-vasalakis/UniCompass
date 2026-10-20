import uuid
from typing import Literal

from pydantic import BaseModel

from app.schemas.daily_life import CanteenOut, NearbyPlaceOut
from app.schemas.match import Point


class CampusOut(BaseModel):
    slug: str
    name: str
    lat: float
    lng: float


class DepartmentOut(BaseModel):
    id: uuid.UUID
    name: str
    campus_slug: str


class UniversityOut(BaseModel):
    slug: str
    name: str
    short_name: str
    campuses: list[CampusOut]
    departments: list[DepartmentOut]


class HubOut(BaseModel):
    slug: str
    name: str
    kind: Literal["ktel", "airport", "port", "rail"]
    serves: str
    lat: float
    lng: float


class MetroStationOut(BaseModel):
    slug: str
    name: str
    lat: float
    lng: float


class MetroLineOut(BaseModel):
    slug: str
    code: str  # M1, M2, M3
    color: str  # green, red, blue
    hex: str
    name: str
    from_station: str
    to_station: str


class MetroOut(BaseModel):
    """The metro station closest to a neighborhood and the lines serving it."""

    station: MetroStationOut
    lines: list[MetroLineOut]
    distance_m: int
    walk_minutes: int
    in_area: bool  # False: the area has no station of its own, this is the nearest


class Scores(BaseModel):
    safety: int
    quiet: int
    nightlife: int
    green: int
    amenities: int
    student_life: int


class NeighborhoodSummary(BaseModel):
    slug: str
    name: str
    name_el: str
    zone: str
    lat: float
    lng: float
    typical_studio_rent: int
    scores: Scores


class TravelTimeOut(BaseModel):
    destination_slug: str
    destination_name: str
    destination_type: Literal["campus", "hub"]
    group: str  # university short name for campuses, hub kind for hubs
    minutes: int
    estimated: bool


class NeighborhoodBase(NeighborhoodSummary):
    """The cacheable part of a detail page: it only changes when the seed does."""

    description: str
    pros: list[Point]
    cons: list[Point]
    sources: list[str]
    metro: MetroOut | None
    travel_times: list[TravelTimeOut]


class NeighborhoodDetail(NeighborhoodBase):
    # False until scripts/compute_nearby.py has run: then empty lists mean
    # "not loaded", not "nothing nearby".
    nearby_loaded: bool
    supermarkets: list[NearbyPlaceOut]
    gyms: list[NearbyPlaceOut]
    canteens: list[CanteenOut]  # nearest first
