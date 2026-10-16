"""Neighborhood scoring. Pure functions, no I/O: see tests/test_matching.py."""

from dataclasses import dataclass
from typing import Any

from app.schemas.match import FACTORS, Factor, MatchArea, MatchRequest, Point

SCORE_FACTORS: tuple[Factor, ...] = (
    "safety",
    "quiet",
    "nightlife",
    "green",
    "amenities",
    "student_life",
)
TOP_N = 3
# A factor counts as a "driver" of a match only if the area is genuinely good at it.
DRIVER_THRESHOLD = 0.6


@dataclass(frozen=True)
class AreaInput:
    slug: str
    name: str
    name_el: str
    zone: str
    lat: float
    lng: float
    description: str
    typical_studio_rent: int
    scores: dict[str, int]  # SCORE_FACTORS → 1–5
    pros: list[dict[str, Any]]
    cons: list[dict[str, Any]]
    commute_minutes: int
    commute_estimated: bool
    home_minutes: int | None = None
    home_estimated: bool | None = None


def _invert_minmax(values: list[float]) -> list[float]:
    """Lower is better → 1.0 for the minimum, 0.0 for the maximum."""
    lo, hi = min(values), max(values)
    if hi == lo:
        return [1.0] * len(values)
    return [(hi - v) / (hi - lo) for v in values]


def factor_scores(areas: list[AreaInput]) -> list[dict[Factor, float]]:
    """Normalise every factor to 0–1 (higher = better) across all areas."""
    rent = _invert_minmax([a.typical_studio_rent for a in areas])
    commute = _invert_minmax([a.commute_minutes for a in areas])
    homes = [a.home_minutes for a in areas]
    home = _invert_minmax(homes) if all(h is not None for h in homes) else None

    out: list[dict[Factor, float]] = []
    for i, a in enumerate(areas):
        s: dict[Factor, float] = {f: (a.scores[f] - 1) / 4 for f in SCORE_FACTORS}
        s["rent"] = rent[i]
        s["commute"] = commute[i]
        if home is not None:
            s["home"] = home[i]
        out.append(s)
    return out


def effective_weights(req: MatchRequest, has_home: bool) -> dict[Factor, int]:
    weights = {f: req.weight(f) for f in FACTORS}
    if not has_home:
        weights["home"] = 0
    if not any(weights.values()):
        # No preferences given: treat every available factor equally.
        weights = {f: 1 for f in FACTORS if f != "home" or has_home}
    return weights


def _point_weight(point: dict[str, Any], weights: dict[Factor, int]) -> int:
    factor = point.get("factor")
    if factor == "transport":
        return max(weights.get("commute", 0), weights.get("home", 0))
    return weights.get(factor, 0) if factor else 0


def _order_points(
    points: list[dict[str, Any]], weights: dict[Factor, int]
) -> list[Point]:
    """Points about the student's top priorities first; stable otherwise."""
    ranked = sorted(points, key=lambda p: -_point_weight(p, weights))
    return [Point(**p) for p in ranked]


def match(areas: list[AreaInput], req: MatchRequest) -> tuple[list[MatchArea], int]:
    """Return the top areas for this request and how many passed the hard limits."""
    if not areas:
        return [], 0

    has_home = req.home_hub_slug is not None and all(
        a.home_minutes is not None for a in areas
    )
    weights = effective_weights(req, has_home)
    total_weight = sum(weights.values())
    normalised = factor_scores(areas)

    candidates = []
    for area, scores in zip(areas, normalised, strict=True):
        if req.max_rent is not None and area.typical_studio_rent > req.max_rent:
            continue
        if req.max_commute is not None and area.commute_minutes > req.max_commute:
            continue
        contributions = {f: weights[f] * scores[f] for f in weights if weights[f]}
        score = sum(contributions.values()) / total_weight
        candidates.append((score, area, scores, contributions))

    candidates.sort(key=lambda c: (-c[0], c[1].commute_minutes))

    results = []
    for score, area, scores, contributions in candidates[:TOP_N]:
        drivers = [
            f
            for f, _ in sorted(contributions.items(), key=lambda kv: -kv[1])
            if scores[f] >= DRIVER_THRESHOLD
        ][:3]
        results.append(
            MatchArea(
                slug=area.slug,
                name=area.name,
                name_el=area.name_el,
                zone=area.zone,
                lat=area.lat,
                lng=area.lng,
                description=area.description,
                match=round(score * 100),
                drivers=drivers,
                factor_scores={f: round(v, 3) for f, v in scores.items()},
                typical_studio_rent=area.typical_studio_rent,
                commute_minutes=area.commute_minutes,
                commute_estimated=area.commute_estimated,
                home_minutes=area.home_minutes if has_home else None,
                home_estimated=area.home_estimated if has_home else None,
                pros=_order_points(area.pros, weights),
                cons=_order_points(area.cons, weights),
            )
        )
    return results, len(candidates)
