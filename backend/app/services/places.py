"""Read-side queries for reference data (cached in Upstash)."""

import uuid

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.lang import Lang, pick, points
from app.models import (
    Campus,
    Department,
    NearbyPlace,
    Neighborhood,
    StudentCanteen,
    TransitHub,
    TravelTime,
    University,
)
from app.schemas.daily_life import CanteenOut, DailyLife, NearbyPlaceOut
from app.schemas.match import MatchArea
from app.schemas.places import (
    HubOut,
    NeighborhoodBase,
    NeighborhoodDetail,
    NeighborhoodSummary,
    Scores,
    TravelTimeOut,
    UniversityOut,
)
from app.services.cache import cache_get, cache_set
from app.services.geo import (
    WALKABLE_KM,
    estimate_transit_minutes,
    haversine_km,
    walk_minutes,
)
from app.services.matching import SCORE_FACTORS, AreaInput
from app.services.metro import nearest_station

# Bump when the shape of cached values changes. Reference data only changes
# when scripts/seed.py or compute_travel_times.py runs; TTL bounds staleness.
PREFIX = "places:v3"
TTL = 6 * 3600


def _scores(n: Neighborhood) -> Scores:
    return Scores(**{f: getattr(n, f) for f in SCORE_FACTORS})


def _summary(n: Neighborhood) -> NeighborhoodSummary:
    return NeighborhoodSummary(
        slug=n.slug,
        name=n.name,
        name_el=n.name_el,
        zone=n.zone,
        lat=n.lat,
        lng=n.lng,
        typical_studio_rent=n.typical_studio_rent,
        scores=_scores(n),
    )


async def list_universities(db: AsyncSession, lang: Lang) -> list[UniversityOut]:
    key = f"{PREFIX}:universities:{lang}"
    if cached := await cache_get(key):
        return [UniversityOut(**u) for u in cached]

    unis = (await db.scalars(select(University).order_by(University.name))).all()
    campuses = (await db.scalars(select(Campus).order_by(Campus.name))).all()
    depts = (await db.scalars(select(Department).order_by(Department.name))).all()
    campus_slug = {c.id: c.slug for c in campuses}

    out = [
        UniversityOut(
            slug=u.slug,
            name=pick(lang, u.name, u.name_el),
            short_name=u.short_name,
            campuses=[
                {
                    "slug": c.slug,
                    "name": pick(lang, c.name, c.name_el),
                    "lat": c.lat,
                    "lng": c.lng,
                }
                for c in campuses
                if c.university_id == u.id
            ],
            departments=[
                {
                    "id": d.id,
                    "name": pick(lang, d.name, d.name_el),
                    "campus_slug": campus_slug[d.campus_id],
                }
                for d in depts
                if d.university_id == u.id
            ],
        )
        for u in unis
    ]
    await cache_set(key, [u.model_dump(mode="json") for u in out], TTL)
    return out


async def list_hubs(db: AsyncSession, lang: Lang) -> list[HubOut]:
    key = f"{PREFIX}:hubs:{lang}"
    if cached := await cache_get(key):
        return [HubOut(**h) for h in cached]

    hubs = (
        await db.scalars(select(TransitHub).order_by(TransitHub.kind, TransitHub.name))
    ).all()
    out = [
        HubOut(
            slug=h.slug,
            name=pick(lang, h.name, h.name_el),
            kind=h.kind,
            serves=pick(lang, h.serves, h.serves_el),
            lat=h.lat,
            lng=h.lng,
        )
        for h in hubs
    ]
    await cache_set(key, [h.model_dump(mode="json") for h in out], TTL)
    return out


async def list_canteens(db: AsyncSession) -> list[dict]:
    """Every student restaurant, as plain dicts (cached)."""
    key = f"{PREFIX}:canteens"
    if cached := await cache_get(key):
        return cached

    rows = (
        await db.execute(
            select(StudentCanteen, University).join(
                University, StudentCanteen.university_id == University.id
            )
        )
    ).all()
    out = [
        {
            "slug": c.slug,
            "name": c.name,
            "name_el": c.name_el,
            "university": u.short_name,
            "university_slug": u.slug,
            "address": c.address,
            "lat": c.lat,
            "lng": c.lng,
            "approximate": c.approximate,
        }
        for c, u in rows
    ]
    await cache_set(key, out, TTL)
    return out


def _canteens_near(
    canteens: list[dict], lat: float, lng: float, university_slug: str | None = None
) -> list[CanteenOut]:
    """Nearest first. With a university, only its canteens (none if it has none), else all."""
    pool = (
        [c for c in canteens if c["university_slug"] == university_slug]
        if university_slug
        else canteens
    )
    out = []
    for c in sorted(pool, key=lambda c: haversine_km(lat, lng, c["lat"], c["lng"])):
        km = haversine_km(lat, lng, c["lat"], c["lng"])
        walk = km <= WALKABLE_KM
        out.append(
            CanteenOut(
                **{k: v for k, v in c.items() if k != "university_slug"},
                mode="walk" if walk else "transit",
                minutes=walk_minutes(km * 1000)
                if walk
                else estimate_transit_minutes(lat, lng, c["lat"], c["lng"]),
            )
        )
    return out


async def list_neighborhoods(db: AsyncSession) -> list[NeighborhoodSummary]:
    key = f"{PREFIX}:neighborhoods"
    if cached := await cache_get(key):
        return [NeighborhoodSummary(**n) for n in cached]

    hoods = (await db.scalars(select(Neighborhood).order_by(Neighborhood.name))).all()
    out = [_summary(n) for n in hoods]
    await cache_set(key, [n.model_dump(mode="json") for n in out], TTL)
    return out


async def _nearby_places(
    db: AsyncSession, slugs: list[str]
) -> tuple[dict[str, list[NearbyPlace]], bool]:
    """Closest first, per neighborhood slug, plus whether compute_nearby.py has
    run at all. One query, and never cached: the script writes straight to
    Postgres and can't invalidate Upstash."""
    loaded = exists().where(NearbyPlace.id.is_not(None)).label("loaded")
    rows = (
        await db.execute(
            select(Neighborhood.slug, NearbyPlace, loaded)
            .outerjoin(NearbyPlace, NearbyPlace.neighborhood_id == Neighborhood.id)
            .where(Neighborhood.slug.in_(slugs))
            .order_by(NearbyPlace.distance_m)
        )
    ).all()
    out: dict[str, list[NearbyPlace]] = {slug: [] for slug in slugs}
    for slug, place, _ in rows:
        if place is not None:
            out[slug].append(place)
    return out, any(row[2] for row in rows)


def _place_out(p: NearbyPlace) -> NearbyPlaceOut:
    return NearbyPlaceOut(
        name=p.name, lat=p.lat, lng=p.lng, walk_minutes=walk_minutes(p.distance_m)
    )


async def _neighborhood_base(
    db: AsyncSession, slug: str, lang: Lang
) -> NeighborhoodBase | None:
    key = f"{PREFIX}:neighborhood:{lang}:{slug}"
    if cached := await cache_get(key):
        return NeighborhoodBase(**cached)

    n = await db.scalar(select(Neighborhood).where(Neighborhood.slug == slug))
    if n is None:
        return None

    campus_rows = (
        await db.execute(
            select(TravelTime, Campus, University)
            .join(Campus, TravelTime.campus_id == Campus.id)
            .join(University, Campus.university_id == University.id)
            .where(TravelTime.neighborhood_id == n.id)
            .order_by(TravelTime.transit_minutes)
        )
    ).all()
    hub_rows = (
        await db.execute(
            select(TravelTime, TransitHub)
            .join(TransitHub, TravelTime.hub_id == TransitHub.id)
            .where(TravelTime.neighborhood_id == n.id)
            .order_by(TravelTime.transit_minutes)
        )
    ).all()

    travel = [
        TravelTimeOut(
            destination_slug=c.slug,
            destination_name=pick(lang, c.name, c.name_el),
            destination_type="campus",
            group=u.short_name,
            minutes=t.transit_minutes,
            estimated=t.source == "estimate",
        )
        for t, c, u in campus_rows
    ] + [
        TravelTimeOut(
            destination_slug=h.slug,
            destination_name=pick(lang, h.name, h.name_el),
            destination_type="hub",
            group=h.kind,
            minutes=t.transit_minutes,
            estimated=t.source == "estimate",
        )
        for t, h in hub_rows
    ]

    out = NeighborhoodBase(
        **_summary(n).model_dump(),
        description=pick(lang, n.description, n.description_el),
        pros=points(lang, n.pros),
        cons=points(lang, n.cons),
        sources=n.sources,
        metro=nearest_station(n.lat, n.lng, lang),
        travel_times=travel,
    )
    await cache_set(key, out.model_dump(mode="json"), TTL)
    return out


async def get_neighborhood(
    db: AsyncSession, slug: str, lang: Lang
) -> NeighborhoodDetail | None:
    base = await _neighborhood_base(db, slug, lang)
    if base is None:
        return None

    by_slug, loaded = await _nearby_places(db, [slug])
    nearby = by_slug[slug]
    return NeighborhoodDetail(
        **base.model_dump(),
        nearby_loaded=loaded,
        supermarkets=[_place_out(p) for p in nearby if p.kind == "supermarket"],
        gyms=[_place_out(p) for p in nearby if p.kind == "gym"],
        canteens=_canteens_near(await list_canteens(db), base.lat, base.lng)[:3],
    )


MAP_GYMS = 2
MAP_CANTEENS = 3


async def attach_daily_life(
    db: AsyncSession, areas: list[MatchArea], university_slug: str
) -> None:
    """Fill `daily_life` on match results; the canteen is the student's own university's."""
    if not areas:
        return
    nearby, loaded = await _nearby_places(db, [a.slug for a in areas])
    canteens = await list_canteens(db)
    for area in areas:
        mine = nearby[area.slug]
        canteen = _canteens_near(canteens, area.lat, area.lng, university_slug)
        gyms = [_place_out(p) for p in mine if p.kind == "gym"]
        area.daily_life = DailyLife(
            nearby_loaded=loaded,
            supermarket=next(
                (_place_out(p) for p in mine if p.kind == "supermarket"), None
            ),
            gym=gyms[0] if gyms else None,
            canteen=canteen[0] if canteen else None,
            gyms=gyms[:MAP_GYMS],
            canteens=canteen[:MAP_CANTEENS],
        )


async def get_department(
    db: AsyncSession, department_id: uuid.UUID
) -> Department | None:
    return await db.get(Department, department_id)


async def load_match_inputs(
    db: AsyncSession, campus_id: uuid.UUID, hub_slug: str | None, lang: Lang
) -> list[AreaInput]:
    """Every area in the campus's city, with commute (and home trip) minutes."""
    key = f"{PREFIX}:match-inputs:{lang}:{campus_id}:{hub_slug or '-'}"
    if cached := await cache_get(key):
        return [AreaInput(**a) for a in cached]

    campus = await db.get(Campus, campus_id)
    if campus is None:
        return []
    university = await db.get(University, campus.university_id)

    rows = (
        await db.execute(
            select(Neighborhood, TravelTime)
            .join(TravelTime, TravelTime.neighborhood_id == Neighborhood.id)
            .where(
                Neighborhood.city_id == university.city_id,
                TravelTime.campus_id == campus_id,
            )
        )
    ).all()

    home: dict[uuid.UUID, TravelTime] = {}
    if hub_slug:
        hub_rows = (
            await db.execute(
                select(TravelTime)
                .join(TransitHub, TravelTime.hub_id == TransitHub.id)
                .where(TransitHub.slug == hub_slug)
            )
        ).scalars()
        home = {t.neighborhood_id: t for t in hub_rows}

    out = []
    for n, t in rows:
        h = home.get(n.id)
        out.append(
            AreaInput(
                slug=n.slug,
                name=n.name,
                name_el=n.name_el,
                zone=n.zone,
                lat=n.lat,
                lng=n.lng,
                description=pick(lang, n.description, n.description_el),
                typical_studio_rent=n.typical_studio_rent,
                scores={f: getattr(n, f) for f in SCORE_FACTORS},
                pros=points(lang, n.pros),
                cons=points(lang, n.cons),
                commute_minutes=t.transit_minutes,
                commute_estimated=t.source == "estimate",
                home_minutes=h.transit_minutes if h else None,
                home_estimated=(h.source == "estimate") if h else None,
            )
        )
    await cache_set(key, [a.__dict__ for a in out], TTL)
    return out
