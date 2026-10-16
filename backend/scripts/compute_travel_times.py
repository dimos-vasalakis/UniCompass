"""Replace estimated travel times with real public-transport times from Google.

    python -m scripts.compute_travel_times

Needs GOOGLE_MAPS_API_KEY (Routes API enabled) in backend/.env. Uses the Route
Matrix API with TRANSIT mode, departing next weekday at 08:00 Athens time, one
request per neighborhood (≤100 elements per request is Google's TRANSIT limit).
Run once after seeding; re-run only when areas/campuses/hubs change.
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import get_settings, sqlalchemy_url
from app.models import Campus, Neighborhood, TransitHub, TravelTime

MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix"


def next_weekday_8am() -> str:
    now = datetime.now(ZoneInfo("Europe/Athens"))
    day = now + timedelta(days=1)
    while day.weekday() >= 5:
        day += timedelta(days=1)
    return day.replace(hour=8, minute=0, second=0, microsecond=0).isoformat()


def waypoint(lat: float, lng: float) -> dict:
    return {"waypoint": {"location": {"latLng": {"latitude": lat, "longitude": lng}}}}


def main() -> None:
    settings = get_settings()
    if not settings.google_maps_api_key:
        raise SystemExit("Set GOOGLE_MAPS_API_KEY in backend/.env first.")

    engine = create_engine(sqlalchemy_url(settings.direct_url))
    departure = next_weekday_8am()

    with Session(engine) as session, httpx.Client(timeout=60) as client:
        hoods = session.scalars(select(Neighborhood)).all()
        dests = [("campus_id", c) for c in session.scalars(select(Campus))] + [
            ("hub_id", h) for h in session.scalars(select(TransitHub))
        ]
        updated = 0

        for hood in hoods:
            res = client.post(
                MATRIX_URL,
                headers={
                    "X-Goog-Api-Key": settings.google_maps_api_key,
                    "X-Goog-FieldMask": "originIndex,destinationIndex,duration,condition",
                },
                json={
                    "origins": [waypoint(hood.lat, hood.lng)],
                    "destinations": [waypoint(d.lat, d.lng) for _, d in dests],
                    "travelMode": "TRANSIT",
                    "departureTime": departure,
                },
            )
            res.raise_for_status()

            for el in res.json():
                if el.get("condition") != "ROUTE_EXISTS" or "duration" not in el:
                    continue
                col, dest = dests[el["destinationIndex"]]
                minutes = round(int(el["duration"].rstrip("s")) / 60)
                stmt = insert(TravelTime).values(
                    neighborhood_id=hood.id,
                    **{col: dest.id},
                    transit_minutes=minutes,
                    source="google",
                )
                session.execute(
                    stmt.on_conflict_do_update(
                        index_elements=["neighborhood_id", col],
                        index_where=TravelTime.__table__.c[col].isnot(None),
                        set_={"transit_minutes": minutes, "source": "google"},
                    )
                )
                updated += 1
            session.commit()
            print(f"{hood.slug}: done")

    print(f"Updated {updated} travel times from Google (departure {departure}).")


if __name__ == "__main__":
    main()
