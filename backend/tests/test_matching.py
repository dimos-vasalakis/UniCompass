import uuid

import pytest
from pydantic import ValidationError

from app.schemas.match import MatchRequest
from app.services.matching import AreaInput, match

DEPT = uuid.uuid4()


def area(
    slug: str, *, rent: int, commute: int, home: int | None = None, **scores
) -> AreaInput:
    base = dict.fromkeys(
        ("safety", "quiet", "nightlife", "green", "amenities", "student_life"), 3
    )
    return AreaInput(
        slug=slug,
        name=slug.title(),
        name_el=slug,
        zone="center",
        lat=37.98,
        lng=23.73,
        description="",
        typical_studio_rent=rent,
        scores={**base, **scores},
        pros=[
            {"text": "cheap", "factor": "rent"},
            {"text": "metro", "factor": "transport"},
            {"text": "safe", "factor": "safety"},
        ],
        cons=[{"text": "loud", "factor": "quiet"}, {"text": "hilly", "factor": None}],
        commute_minutes=commute,
        commute_estimated=False,
        home_minutes=home,
        home_estimated=False if home is not None else None,
    )


AREAS = [
    area("cheap-far", rent=350, commute=60, safety=2),
    area("pricey-near", rent=750, commute=10, safety=5),
    area("middle", rent=500, commute=30, safety=4),
    area("party", rent=520, commute=25, nightlife=5, quiet=1),
    area("quiet", rent=480, commute=35, quiet=5, nightlife=1),
]


def req(**kw) -> MatchRequest:
    return MatchRequest(department_id=DEPT, **kw)


def slugs(results) -> list[str]:
    return [r.slug for r in results]


def test_returns_top_three_by_default() -> None:
    results, within = match(AREAS, req())
    assert len(results) == 3
    assert within == len(AREAS)


def test_weights_reorder_results() -> None:
    by_rent, _ = match(AREAS, req(weights={"rent": 5}))
    by_commute, _ = match(AREAS, req(weights={"commute": 5}))
    assert by_rent[0].slug == "cheap-far"
    assert by_commute[0].slug == "pricey-near"


def test_single_factor_scores_100_for_the_best_area() -> None:
    results, _ = match(AREAS, req(weights={"rent": 5}))
    assert results[0].match == 100


def test_hard_limits_filter() -> None:
    results, within = match(AREAS, req(max_rent=500, max_commute=40))
    assert within == 2
    assert set(slugs(results)) == {"middle", "quiet"}


def test_limits_can_leave_fewer_than_three() -> None:
    results, within = match(AREAS, req(max_rent=360))
    assert slugs(results) == ["cheap-far"]
    assert within == 1


def test_no_areas() -> None:
    assert match([], req()) == ([], 0)


def test_drivers_are_largest_good_contributions() -> None:
    results, _ = match(AREAS, req(weights={"nightlife": 5, "commute": 2, "rent": 1}))
    top = results[0]
    assert top.slug == "party"
    assert top.drivers[0] == "nightlife"
    # A factor the area is bad at is never listed as a reason it matched.
    assert all(top.factor_scores[d] >= 0.6 for d in top.drivers)


def test_pros_and_cons_put_top_priorities_first() -> None:
    results, _ = match(AREAS, req(weights={"safety": 5, "commute": 3, "quiet": 4}))
    top = results[0]
    assert [p.text for p in top.pros] == ["safe", "metro", "cheap"]
    assert [c.text for c in top.cons] == ["loud", "hilly"]


def test_home_factor_used_only_with_a_hub() -> None:
    areas = [
        area("near-home", rent=500, commute=30, home=10),
        area("far-home", rent=500, commute=30, home=70),
    ]
    with_hub, _ = match(areas, req(weights={"home": 5}, home_hub_slug="piraeus-port"))
    assert with_hub[0].slug == "near-home"
    assert with_hub[0].home_minutes == 10

    without_hub, _ = match(areas, req(weights={"home": 5}))
    assert without_hub[0].home_minutes is None
    assert "home" not in without_hub[0].drivers


def test_weights_outside_0_5_are_rejected() -> None:
    with pytest.raises(ValidationError):
        req(weights={"rent": 6})
    with pytest.raises(ValidationError):
        req(weights={"vibes": 3})
