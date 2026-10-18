"""Fill nearby_places with the closest supermarkets and gyms from OpenStreetMap.

    python -m scripts.compute_nearby

No API key needed: one Overpass query covers every neighborhood, then the
closest few of each kind are kept per neighborhood (straight-line distance;
the API turns it into a walking estimate). Re-running replaces the old rows.
Run after seeding, and again now and then: shops open and close.
"""

import time

import httpx
from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings, sqlalchemy_url
from app.models import NearbyPlace, Neighborhood
from app.services.geo import haversine_km

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
USER_AGENT = "UniCompass/1.0 (student housing guide)"
MARGIN_DEG = 0.025  # ~2.5 km around the outermost neighborhoods
# kind -> (OSM filter, how far, how many to keep)
KINDS = {
    "supermarket": ('["shop"="supermarket"]', 1.5, 3),
    "gym": ('["leisure"="fitness_centre"]', 2.0, 3),
}


def fetch_places(south: float, west: float, north: float, east: float) -> list[dict]:
    bbox = f"({south},{west},{north},{east})"
    query = (
        "[out:json][timeout:120];("
        + "".join(f"nwr{flt}{bbox};" for flt, _, _ in KINDS.values())
        + ");out center tags;"
    )
    for attempt in range(6):
        url = OVERPASS_URLS[attempt % len(OVERPASS_URLS)]
        try:
            res = httpx.post(
                url,
                data={"data": query},
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
                timeout=150,
            )
            res.raise_for_status()
            return res.json()["elements"]
        except httpx.HTTPError as e:
            print(f"Overpass attempt {attempt + 1} failed ({e}); retrying…")
            time.sleep(10 * (attempt + 1))
    raise SystemExit("Overpass is unavailable, try again later.")


def kind_of(tags: dict) -> str | None:
    if tags.get("shop") == "supermarket":
        return "supermarket"
    if tags.get("leisure") == "fitness_centre":
        return "gym"
    return None


def main() -> None:
    engine = create_engine(sqlalchemy_url(get_settings().direct_url))

    with Session(engine) as session:
        hoods = session.scalars(select(Neighborhood)).all()
        lats, lngs = [h.lat for h in hoods], [h.lng for h in hoods]
        elements = fetch_places(
            min(lats) - MARGIN_DEG,
            min(lngs) - MARGIN_DEG,
            max(lats) + MARGIN_DEG,
            max(lngs) + MARGIN_DEG,
        )

        places = []
        for el in elements:
            tags = el.get("tags", {})
            pos = el if el["type"] == "node" else el.get("center")
            kind = kind_of(tags)
            name = tags.get("name") or tags.get("brand") or tags.get("operator")
            if not (pos and kind and name):
                continue  # nameless shops aren't useful to a student
            places.append(
                {
                    "kind": kind,
                    "osm_id": f"{el['type']}/{el['id']}",
                    "name": name,
                    "lat": pos["lat"],
                    "lng": pos["lon"],
                }
            )
        print(f"{len(places)} named places from OpenStreetMap")

        # A bad Overpass answer must not wipe good data: refuse empty kinds.
        for kind in KINDS:
            if not any(p["kind"] == kind for p in places):
                raise SystemExit(f"Overpass returned no {kind}s; keeping old data.")

        total = 0
        # One commit at the end: all neighborhoods or none.
        for hood in hoods:
            session.execute(
                delete(NearbyPlace).where(NearbyPlace.neighborhood_id == hood.id)
            )
            for kind, (_, max_km, keep) in KINDS.items():
                ranked = sorted(
                    (
                        (haversine_km(hood.lat, hood.lng, p["lat"], p["lng"]), p)
                        for p in places
                        if p["kind"] == kind
                    ),
                    key=lambda t: t[0],
                )
                for km, p in [t for t in ranked if t[0] <= max_km][:keep]:
                    session.add(
                        NearbyPlace(
                            neighborhood_id=hood.id,
                            distance_m=round(km * 1000),
                            **p,
                        )
                    )
                    total += 1

        session.commit()

    print(f"Stored {total} nearby places for {len(hoods)} neighborhoods.")


if __name__ == "__main__":
    main()
