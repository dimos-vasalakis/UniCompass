"""Metro stations and lines (pure: data/metro/*.json, no I/O after first load)."""

import json
from functools import cache
from pathlib import Path

from app.core.lang import Lang, pick
from app.schemas.places import MetroLineOut, MetroOut, MetroStationOut
from app.services.geo import haversine_km, walk_minutes

DATA = Path(__file__).resolve().parent.parent.parent / "data" / "metro"
# Within this straight-line distance the area "has" a station of its own.
IN_AREA_KM = 1.0


@cache
def _load(city: str) -> dict:
    return json.loads((DATA / f"{city}.json").read_text())


def nearest_station(
    lat: float, lng: float, lang: Lang, city: str = "athens"
) -> MetroOut | None:
    data = _load(city)
    stations = {s["slug"]: s for s in data["stations"]}
    if not stations:
        return None
    best = min(
        stations.values(), key=lambda s: haversine_km(lat, lng, s["lat"], s["lng"])
    )
    km = haversine_km(lat, lng, best["lat"], best["lng"])

    def name(slug: str) -> str:
        return pick(lang, stations[slug]["name"], stations[slug].get("name_el"))

    lines = [
        MetroLineOut(
            slug=line["slug"],
            code=line["code"],
            color=line["color"],
            hex=line["hex"],
            name=pick(lang, line["name"], line.get("name_el")),
            from_station=name(line["stations"][0]),
            to_station=name(line["stations"][-1]),
        )
        for line in data["lines"]
        if best["slug"] in line["stations"]
    ]
    return MetroOut(
        station=MetroStationOut(
            slug=best["slug"], name=name(best["slug"]), lat=best["lat"], lng=best["lng"]
        ),
        lines=lines,
        distance_m=round(km * 1000),
        walk_minutes=walk_minutes(km * 1000),
        in_area=km <= IN_AREA_KM,
    )
