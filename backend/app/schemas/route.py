from typing import Literal

from pydantic import BaseModel


class RouteStep(BaseModel):
    """One leg of a trip. Which fields are set depends on `kind`."""

    kind: Literal["walk", "ride", "transfer", "transit"]
    minutes: int
    # walk: where to and how far; `to_kind` says whether that is a metro station or the campus
    to: str | None = None
    to_kind: Literal["station", "campus"] | None = None
    meters: int | None = None
    # ride: the line, where you board and get off, which way it runs (its terminal)
    # and how many stops that is. transfer: the line you change to at `station`.
    line_code: str | None = None
    line_color: str | None = None
    line_hex: str | None = None
    line_name: str | None = None
    from_station: str | None = None
    to_station: str | None = None
    direction: str | None = None
    stops: int | None = None
    station: str | None = None
    from_line_code: str | None = None
    from_line_color: str | None = None
    from_line_hex: str | None = None


class RouteOption(BaseModel):
    mode: Literal["walk", "metro", "transit"]
    minutes: int
    estimated: bool = True
    steps: list[RouteStep]


class RouteCampus(BaseModel):
    slug: str
    name: str
    lat: float
    lng: float


class RouteOut(BaseModel):
    campus: RouteCampus
    options: list[RouteOption]  # fastest first
