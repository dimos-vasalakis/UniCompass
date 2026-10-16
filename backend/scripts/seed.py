"""Load backend/data/<city>.json into the database (idempotent).

    python -m scripts.seed            # athens
    python -m scripts.seed athens

Upserts by slug, so it's safe to re-run after editing the JSON. Travel times
are filled with distance-based estimates only where no row exists yet, so
real Google data from compute_travel_times.py is never overwritten.
"""

import json
import sys
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import get_settings, sqlalchemy_url
from app.models import (
    Campus,
    City,
    Department,
    Neighborhood,
    TransitHub,
    TravelTime,
    University,
)
from app.services.geo import estimate_transit_minutes

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def upsert(session: Session, model, rows: list[dict], key: list[str]) -> None:
    if not rows:
        return
    stmt = insert(model).values(rows)
    update_cols = {c: stmt.excluded[c] for c in rows[0] if c not in key}
    session.execute(stmt.on_conflict_do_update(index_elements=key, set_=update_cols))


def ids_by_slug(session: Session, model) -> dict[str, object]:
    return dict(session.execute(select(model.slug, model.id)).all())


def seed(city_slug: str) -> None:
    data = json.loads((DATA_DIR / f"{city_slug}.json").read_text())
    engine = create_engine(sqlalchemy_url(get_settings().direct_url))

    with Session(engine) as session, session.begin():
        upsert(session, City, [data["city"]], ["slug"])
        city_id = ids_by_slug(session, City)[city_slug]

        upsert(
            session,
            University,
            [{**u, "city_id": city_id} for u in data["universities"]],
            ["slug"],
        )
        uni_ids = ids_by_slug(session, University)

        upsert(
            session,
            Campus,
            [
                {
                    "slug": c["slug"],
                    "university_id": uni_ids[c["university"]],
                    "name": c["name"],
                    "lat": c["lat"],
                    "lng": c["lng"],
                }
                for c in data["campuses"]
            ],
            ["slug"],
        )
        campus_ids = ids_by_slug(session, Campus)

        upsert(
            session,
            Department,
            [
                {
                    "university_id": uni_ids[c["university"]],
                    "campus_id": campus_ids[c["slug"]],
                    "name": name,
                }
                for c in data["campuses"]
                for name in c["departments"]
            ],
            ["campus_id", "name"],
        )

        upsert(
            session,
            TransitHub,
            [{**h, "city_id": city_id} for h in data["transit_hubs"]],
            ["slug"],
        )
        hub_ids = ids_by_slug(session, TransitHub)

        upsert(
            session,
            Neighborhood,
            [
                {
                    **{k: v for k, v in n.items() if k != "scores"},
                    **n["scores"],
                    "city_id": city_id,
                }
                for n in data["neighborhoods"]
            ],
            ["slug"],
        )
        hood_ids = ids_by_slug(session, Neighborhood)

        estimates = []
        for n in data["neighborhoods"]:
            for dest, ids, col in (
                (data["campuses"], campus_ids, "campus_id"),
                (data["transit_hubs"], hub_ids, "hub_id"),
            ):
                for d in dest:
                    estimates.append(
                        {
                            "neighborhood_id": hood_ids[n["slug"]],
                            col: ids[d["slug"]],
                            "transit_minutes": estimate_transit_minutes(
                                n["lat"], n["lng"], d["lat"], d["lng"]
                            ),
                            "source": "estimate",
                        }
                    )
        for col in ("campus_id", "hub_id"):
            rows = [r for r in estimates if col in r]
            session.execute(
                insert(TravelTime)
                .values(rows)
                .on_conflict_do_nothing(
                    index_elements=["neighborhood_id", col],
                    index_where=TravelTime.__table__.c[col].isnot(None),
                )
            )

    print(
        f"Seeded {city_slug}: {len(data['neighborhoods'])} neighborhoods, "
        f"{len(data['campuses'])} campuses, {len(data['transit_hubs'])} hubs, "
        f"{len(estimates)} travel-time pairs (estimates only where missing)."
    )


if __name__ == "__main__":
    seed(sys.argv[1] if len(sys.argv) > 1 else "athens")
