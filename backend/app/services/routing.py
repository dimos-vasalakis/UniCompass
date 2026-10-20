"""Door-to-door options from a neighborhood to a campus (pure: no I/O).

Metro trips are found with Dijkstra over (station, line) states, so changing
lines at an interchange is an explicit step. Times are estimates.
"""

import heapq
import itertools

from app.core.lang import Lang, pick
from app.schemas.route import RouteOption, RouteStep
from app.services.geo import STREET_FACTOR, haversine_km, walk_minutes
from app.services.metro import load_metro

MIN_PER_STOP = 2.5
TRANSFER_MIN = 4.0
WAIT_MIN = 3.0
MAX_STATION_WALK_MIN = 25  # farther than this and the station isn't a real option
CANDIDATE_STATIONS = 3  # nearest stations tried at each end
MAX_WALK_TRIP_MIN = 40


def walk_option(
    a: tuple[float, float], b: tuple[float, float], campus_name: str
) -> RouteOption | None:
    meters = haversine_km(*a, *b) * 1000
    minutes = walk_minutes(meters)
    if minutes > MAX_WALK_TRIP_MIN:
        return None
    return RouteOption(
        mode="walk",
        minutes=minutes,
        steps=[
            RouteStep(
                kind="walk",
                minutes=minutes,
                to=campus_name,
                to_kind="campus",
                meters=round(meters * STREET_FACTOR),
            )
        ],
    )


def _nearest(stations: list[dict], lat: float, lng: float) -> list[tuple[float, dict]]:
    ranked = sorted(
        ((haversine_km(lat, lng, s["lat"], s["lng"]), s) for s in stations),
        key=lambda t: t[0],
    )
    return [
        t
        for t in ranked[:CANDIDATE_STATIONS]
        if walk_minutes(t[0] * 1000) <= MAX_STATION_WALK_MIN
    ]


def _lines_at(lines: dict[str, dict]) -> dict[str, list[str]]:
    on: dict[str, list[str]] = {}
    for lid, line in lines.items():
        for slug in line["stations"]:
            on.setdefault(slug, []).append(lid)
    return on


def _ride(lines: dict[str, dict], on: dict[str, list[str]], origin: str, dest: str):
    """Cheapest (minutes, [(line, station), ...]) from `origin` to `dest`, or None."""
    start = [(WAIT_MIN, (origin, lid)) for lid in on[origin]]
    best: dict[tuple[str, str], float] = {}
    prev: dict[tuple[str, str], tuple[str, str] | None] = {}
    tick = itertools.count()  # tiebreaker: entries never compare nodes/parents
    heap = [(c, next(tick), s, None) for c, s in start]
    heapq.heapify(heap)
    while heap:
        cost, _, node, parent = heapq.heappop(heap)
        if node in best:
            continue
        best[node], prev[node] = cost, parent
        slug, lid = node
        if slug == dest:
            path = [node]
            while prev[path[-1]] is not None:
                path.append(prev[path[-1]])
            return cost, path[::-1]
        seq = lines[lid]["stations"]
        i = seq.index(slug)
        for j in (i - 1, i + 1):
            if 0 <= j < len(seq):
                heapq.heappush(
                    heap, (cost + MIN_PER_STOP, next(tick), (seq[j], lid), node)
                )
        for other in on[slug]:
            if other != lid:
                heapq.heappush(
                    heap, (cost + TRANSFER_MIN, next(tick), (slug, other), node)
                )
    return None


def _legs(lines: dict[str, dict], path: list[tuple[str, str]]):
    """Compress the node path into ride legs (one per line) and transfer legs."""
    legs: list[dict] = []
    for a, b in itertools.pairwise(path):
        if a[1] == b[1]:
            if legs and legs[-1]["type"] == "ride" and legs[-1]["line"] == a[1]:
                legs[-1]["to"] = b[0]
                legs[-1]["stops"] += 1
            else:
                legs.append(
                    {"type": "ride", "line": a[1], "from": a[0], "to": b[0], "stops": 1}
                )
        else:
            legs.append({"type": "transfer", "at": a[0], "from": a[1], "to": b[1]})
    return legs


def metro_option(
    a: tuple[float, float],
    b: tuple[float, float],
    campus_name: str,
    lang: Lang,
    city: str = "athens",
) -> RouteOption | None:
    data = load_metro(city)
    stations = data["stations"]
    by_slug = {s["slug"]: s for s in stations}
    lines = {line["slug"]: line for line in data["lines"]}

    def sname(slug: str) -> str:
        return pick(lang, by_slug[slug]["name"], by_slug[slug].get("name_el"))

    on = _lines_at(lines)
    best = None
    for da, sa in _nearest(stations, *a):
        for db_, sb in _nearest(stations, *b):
            if sa["slug"] == sb["slug"]:
                continue
            ride = _ride(lines, on, sa["slug"], sb["slug"])
            if ride is None:
                continue
            total = walk_minutes(da * 1000) + ride[0] + walk_minutes(db_ * 1000)
            if best is None or total < best[0]:
                best = (total, sa, da, sb, db_, ride)
    if best is None:
        return None
    _, sa, da, sb, db_, (_, path) = best

    def line_fields(lid: str) -> dict:
        line = lines[lid]
        return {
            "line_code": line["code"],
            "line_color": line["color"],
            "line_hex": line["hex"],
            "line_name": pick(lang, line["name"], line.get("name_el")),
        }

    steps = [
        RouteStep(
            kind="walk",
            minutes=walk_minutes(da * 1000),
            to=sname(sa["slug"]),
            to_kind="station",
            meters=round(da * 1000 * STREET_FACTOR),
        )
    ]
    for leg in _legs(lines, path):
        if leg["type"] == "ride":
            seq = lines[leg["line"]]["stations"]
            forward = seq.index(leg["to"]) > seq.index(leg["from"])
            steps.append(
                RouteStep(
                    kind="ride",
                    minutes=round(leg["stops"] * MIN_PER_STOP),
                    from_station=sname(leg["from"]),
                    to_station=sname(leg["to"]),
                    direction=sname(seq[-1] if forward else seq[0]),
                    stops=leg["stops"],
                    **line_fields(leg["line"]),
                )
            )
        else:
            old = lines[leg["from"]]
            steps.append(
                RouteStep(
                    kind="transfer",
                    minutes=round(TRANSFER_MIN),
                    station=sname(leg["at"]),
                    from_line_code=old["code"],
                    from_line_color=old["color"],
                    from_line_hex=old["hex"],
                    **line_fields(leg["to"]),
                )
            )
    # Waiting for the first train counts towards the first ride.
    next(s for s in steps if s.kind == "ride").minutes += round(WAIT_MIN)
    steps.append(
        RouteStep(
            kind="walk",
            minutes=walk_minutes(db_ * 1000),
            to=campus_name,
            to_kind="campus",
            meters=round(db_ * 1000 * STREET_FACTOR),
        )
    )
    return RouteOption(mode="metro", minutes=sum(s.minutes for s in steps), steps=steps)
