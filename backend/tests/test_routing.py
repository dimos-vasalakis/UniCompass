import json

from app.services.metro import DATA
from app.services.routing import metro_option, walk_option

CITY = json.loads((DATA.parent / "athens.json").read_text())
HOODS = {h["slug"]: (h["lat"], h["lng"]) for h in CITY["neighborhoods"]}
CAMPUSES = {c["slug"]: (c["lat"], c["lng"]) for c in CITY["campuses"]}


def kinds(option) -> list[str]:
    return [s.kind for s in option.steps]


def test_single_line_metro_trip() -> None:
    o = metro_option(HOODS["kallithea"], CAMPUSES["aueb-patision"], "AUEB", "en")
    assert o and o.mode == "metro"
    assert kinds(o) == ["walk", "ride", "walk"]
    ride = o.steps[1]
    assert (ride.line_code, ride.from_station, ride.direction) == (
        "M1",
        "Kallithea",
        "Kifisia",
    )
    assert ride.stops and ride.stops > 1
    assert o.minutes == sum(s.minutes for s in o.steps)


def test_trip_with_a_line_change() -> None:
    o = metro_option(HOODS["peristeri"], CAMPUSES["ntua-patision"], "NTUA", "en")
    assert o
    assert kinds(o) == ["walk", "ride", "transfer", "ride", "walk"]
    first, change, second = o.steps[1], o.steps[2], o.steps[3]
    assert first.line_code == "M2" and second.line_code == "M1"
    assert change.station == "Attiki"
    assert (change.from_line_code, change.line_code) == ("M2", "M1")
    assert first.to_station == change.station == second.from_station


def test_greek_names() -> None:
    o = metro_option(HOODS["kallithea"], CAMPUSES["aueb-patision"], "ΟΠΑ", "el")
    assert o
    assert o.steps[0].to == "Καλλιθέα"
    assert o.steps[1].line_name == "Πράσινη γραμμή"


def test_no_metro_option_when_the_campus_is_far_from_stations() -> None:
    assert metro_option(HOODS["pagrati"], CAMPUSES["nkua-zografou"], "x", "en") is None


def test_walk_option_only_when_close() -> None:
    near = walk_option(HOODS["zografou"], CAMPUSES["ntua-zografou"], "NTUA")
    assert near and near.mode == "walk" and near.minutes <= 40
    assert walk_option(HOODS["kifisia"], CAMPUSES["nkua-center"], "x") is None
