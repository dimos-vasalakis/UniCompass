"""Sanity checks for data/*.json: run on every edit, no database needed."""

import json
from pathlib import Path

import pytest

from app.services.matching import SCORE_FACTORS

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CITY_FILES = sorted(p for p in DATA_DIR.glob("*.json") if ".el." not in p.name)
POINT_FACTORS = {*SCORE_FACTORS, "rent", "transport", None}
HUB_KINDS = {"ktel", "airport", "port", "rail"}
ZONES = {"center", "east", "north", "south", "west", "piraeus"}
# Generous box around Attica: catches swapped lat/lng and typos.
LAT_RANGE, LNG_RANGE = (37.6, 38.3), (23.4, 24.2)


@pytest.fixture(scope="module", params=CITY_FILES, ids=lambda p: p.stem)
def data(request) -> dict:
    return json.loads(request.param.read_text())


def in_attica(item: dict) -> bool:
    return LAT_RANGE[0] <= item["lat"] <= LAT_RANGE[1] and (
        LNG_RANGE[0] <= item["lng"] <= LNG_RANGE[1]
    )


def unique(values: list) -> bool:
    return len(values) == len(set(values))


def test_there_is_city_data() -> None:
    assert CITY_FILES, "no data/*.json files"


def test_slugs_are_unique(data) -> None:
    for key in ("universities", "campuses", "transit_hubs", "neighborhoods"):
        slugs = [x["slug"] for x in data[key]]
        assert unique(slugs), f"duplicate slug in {key}"


def test_campuses_reference_real_universities(data) -> None:
    unis = {u["slug"] for u in data["universities"]}
    for c in data["campuses"]:
        assert c["university"] in unis, c["slug"]
        assert c["departments"], f"{c['slug']} has no departments"
        assert unique(c["departments"]), f"duplicate department in {c['slug']}"
        assert in_attica(c), f"{c['slug']} coordinates outside Attica"


def test_every_university_has_a_campus(data) -> None:
    with_campus = {c["university"] for c in data["campuses"]}
    assert {u["slug"] for u in data["universities"]} == with_campus


def test_student_canteens(data) -> None:
    unis = {u["slug"] for u in data["universities"]}
    canteens = data["student_canteens"]
    assert unique([c["slug"] for c in canteens])
    for c in canteens:
        assert c["university"] in unis, c["slug"]
        assert c["name"].strip() and c["name_el"].strip(), c["slug"]
        assert in_attica(c), f"{c['slug']} coordinates outside Attica"
        assert isinstance(c["approximate"], bool), c["slug"]
        # Only a precise position can come with a street address.
        assert c["approximate"] or c["address"], c["slug"]


def test_hubs(data) -> None:
    for h in data["transit_hubs"]:
        assert h["kind"] in HUB_KINDS, h["slug"]
        assert h["serves"].strip(), h["slug"]
        assert in_attica(h), h["slug"]


def test_neighborhoods(data) -> None:
    for n in data["neighborhoods"]:
        where = n["slug"]
        assert n["slug"] == n["slug"].lower() and " " not in n["slug"], where
        assert n["zone"] in ZONES, where
        assert in_attica(n), f"{where} coordinates outside Attica"
        assert 150 <= n["typical_studio_rent"] <= 2000, where
        assert set(n["scores"]) == set(SCORE_FACTORS), where
        assert all(1 <= v <= 5 for v in n["scores"].values()), where
        assert n["description"].strip(), where
        assert n["pros"] and n["cons"], f"{where} needs at least one pro and one con"
        for point in n["pros"] + n["cons"]:
            assert point["text"].strip(), where
            assert point["factor"] in POINT_FACTORS, f"{where}: {point['factor']!r}"
        assert isinstance(n["sources"], list), where


def test_neighborhood_names_are_unique(data) -> None:
    assert unique([n["name"] for n in data["neighborhoods"]])


@pytest.fixture(scope="module")
def greek(data) -> dict:
    path = DATA_DIR / f"{data['city']['slug']}.el.json"
    assert path.exists(), f"missing {path.name}"
    return json.loads(path.read_text())


def has_greek(text: str) -> bool:
    return any("\u0370" <= ch <= "\u03ff" or "\u1f00" <= ch <= "\u1fff" for ch in text)


def mixed_script(text: str) -> bool:
    """A Latin letter glued to a Greek one, e.g. a typo'd 'Nαυπηγών'."""
    import re

    return bool(re.search(r"[A-Za-z][\u0370-\u03ff]|[\u0370-\u03ff][A-Za-z]", text))


def test_greek_covers_every_item(data, greek) -> None:
    assert set(greek["universities"]) == {u["slug"] for u in data["universities"]}
    assert set(greek["campuses"]) == {c["slug"] for c in data["campuses"]}
    assert set(greek["transit_hubs"]) == {h["slug"] for h in data["transit_hubs"]}
    assert set(greek["neighborhoods"]) == {n["slug"] for n in data["neighborhoods"]}
    departments = {d for c in data["campuses"] for d in c["departments"]}
    assert set(greek["departments"]) == departments, "unused or missing departments"


def test_greek_points_line_up_with_english(data, greek) -> None:
    for n in data["neighborhoods"]:
        el = greek["neighborhoods"][n["slug"]]
        assert len(el["pros"]) == len(n["pros"]), f"{n['slug']}: pros out of step"
        assert len(el["cons"]) == len(n["cons"]), f"{n['slug']}: cons out of step"


def test_greek_texts_are_greek(data, greek) -> None:
    texts = [*greek["universities"].values(), *greek["campuses"].values()]
    texts += list(greek["departments"].values())
    for h in greek["transit_hubs"].values():
        texts += [h["name"], h["serves"]]
    for n in greek["neighborhoods"].values():
        texts += [n["description"], *n["pros"], *n["cons"]]
    for t in texts:
        assert has_greek(t), f"not Greek: {t!r}"
        assert not mixed_script(t), f"mixed Latin/Greek letters: {t!r}"
