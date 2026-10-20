from pydantic import BaseModel


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
    path: list[tuple[float, float]]  # (lat, lng) of every station, in line order


class MetroOut(BaseModel):
    """The metro station closest to a neighborhood and the lines serving it."""

    station: MetroStationOut
    lines: list[MetroLineOut]
    distance_m: int
    walk_minutes: int
    in_area: bool  # False: the area has no station of its own, this is the nearest
