import json

from app.services.metro import DATA, nearest_station

CITY = json.loads((DATA / "athens.json").read_text())
LINE_COLORS = {"green", "red", "blue"}


def test_metro_data_is_consistent() -> None:
    slugs = [s["slug"] for s in CITY["stations"]]
    assert len(slugs) == len(set(slugs))
    for line in CITY["lines"]:
        assert line["color"] in LINE_COLORS
        assert set(line["stations"]) <= set(slugs), line["slug"]
        assert len(line["stations"]) == len(set(line["stations"]))
    assert {s for line in CITY["lines"] for s in line["stations"]} == set(slugs)


def test_area_with_a_station() -> None:
    # Syntagma square: M2 + M3
    m = nearest_station(37.9755, 23.7348, "en")
    assert m is not None
    assert m.station.slug == "syntagma"
    assert m.in_area
    assert {line.color for line in m.lines} == {"red", "blue"}


def test_area_without_a_station_gets_the_nearest() -> None:
    # Pagrati has none: Evangelismos / Syntagma are the closest
    m = nearest_station(37.968, 23.747, "en")
    assert m is not None
    assert m.station.slug in {"evangelismos", "syntagma", "akropoli"}
    assert m.distance_m > 0 and m.walk_minutes >= 1


def test_far_area_is_not_in_area() -> None:
    m = nearest_station(38.1, 23.9, "en")
    assert m is not None and not m.in_area


def test_greek_names() -> None:
    m = nearest_station(37.9755, 23.7348, "el")
    assert m is not None
    assert m.station.name == "Σύνταγμα"
    assert {line.name for line in m.lines} == {"Κόκκινη γραμμή", "Μπλε γραμμή"}


def test_every_neighborhood_gets_a_station() -> None:
    hoods = json.loads((DATA.parent / "athens.json").read_text())["neighborhoods"]
    for h in hoods:
        m = nearest_station(h["lat"], h["lng"], "en")
        assert m is not None and m.lines, h["slug"]
