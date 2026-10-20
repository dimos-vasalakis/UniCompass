import uuid

import pytest
from fastapi.testclient import TestClient

from tests.conftest import auth_header, requires_db

pytestmark = requires_db


def department_id(client: TestClient, uni: str, campus: str, name: str) -> str:
    unis = client.get("/api/v1/universities").json()
    u = next(u for u in unis if u["slug"] == uni)
    return next(
        d["id"]
        for d in u["departments"]
        if d["campus_slug"] == campus and d["name"] == name
    )


def test_reference_endpoints_are_public(client: TestClient) -> None:
    unis = client.get("/api/v1/universities")
    assert unis.status_code == 200
    assert len(unis.json()) == 9

    hubs = client.get("/api/v1/hubs").json()
    assert {h["slug"] for h in hubs} >= {"piraeus-port", "ktel-kifisou", "airport"}

    hoods = client.get("/api/v1/neighborhoods").json()
    assert len(hoods) == 49


def test_neighborhood_detail(client: TestClient) -> None:
    res = client.get("/api/v1/neighborhoods/zografou")
    assert res.status_code == 200
    body = res.json()
    assert body["pros"] and body["cons"]
    assert any(t["destination_slug"] == "ntua-zografou" for t in body["travel_times"])
    metro = body["metro"]
    assert metro["station"]["name"] and metro["lines"]
    assert {l["color"] for l in metro["lines"]} <= {"green", "red", "blue"}
    # Nearest student restaurants come from athens.json, so they're always there.
    canteens = body["canteens"]
    assert canteens and len(canteens) <= 3
    assert [c["minutes"] for c in canteens] == sorted(c["minutes"] for c in canteens)
    assert body["supermarkets"] == sorted(
        body["supermarkets"], key=lambda p: p["walk_minutes"]
    )
    # Empty supermarket/gym lists only mean "nothing nearby" once OSM data is loaded.
    assert isinstance(body["nearby_loaded"], bool)
    if not body["nearby_loaded"]:
        assert body["supermarkets"] == [] and body["gyms"] == []
    assert client.get("/api/v1/neighborhoods/atlantis").status_code == 404


def test_match_ntua_commute_and_rent(client: TestClient) -> None:
    dept = department_id(
        client, "ntua", "ntua-zografou", "Electrical and Computer Engineering"
    )
    res = client.post(
        "/api/v1/match",
        json={"department_id": dept, "weights": {"commute": 5, "rent": 5}},
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["results"]) == 3
    assert body["considered"] == 49
    top = [r["slug"] for r in body["results"]]
    eastern = {
        "zografou",
        "kaisariani",
        "goudi",
        "vyronas",
        "ilisia",
        "ampelokipoi",
        "gyzi",
    }
    assert set(top) & eastern, top


def test_match_piraeus_with_port_home(client: TestClient) -> None:
    dept = department_id(client, "unipi", "unipi-main", "Maritime Studies")
    res = client.post(
        "/api/v1/match",
        json={
            "department_id": dept,
            "weights": {"commute": 4, "home": 5},
            "home_hub_slug": "piraeus-port",
        },
    )
    top = [r["slug"] for r in res.json()["results"]]
    assert set(top) & {"piraeus", "neo-faliro", "nikaia", "keratsini", "moschato"}, top
    assert res.json()["results"][0]["home_minutes"] is not None


def test_match_limits(client: TestClient) -> None:
    dept = department_id(client, "ntua", "ntua-zografou", "Civil Engineering")
    body = client.post(
        "/api/v1/match",
        json={"department_id": dept, "max_rent": 400, "max_commute": 30},
    ).json()
    assert body["within_limits"] == len(body["results"]) <= 3
    for r in body["results"]:
        assert r["typical_studio_rent"] <= 400 and r["commute_minutes"] <= 30


def test_match_unknown_department(client: TestClient) -> None:
    res = client.post("/api/v1/match", json={"department_id": str(uuid.uuid4())})
    assert res.status_code == 404


@pytest.mark.usefixtures("test_user")
def test_save_and_list(client: TestClient, test_user: uuid.UUID) -> None:
    dept = department_id(client, "aueb", "aueb-patision", "Informatics")
    headers = auth_header(test_user)
    saved = client.post(
        "/api/v1/match/save",
        json={"department_id": dept, "weights": {"safety": 5}},
        headers=headers,
    )
    assert saved.status_code == 201, saved.text
    assert len(saved.json()["results"]) == 3

    listed = client.get("/api/v1/match/saved", headers=headers).json()
    assert [m["id"] for m in listed] == [saved.json()["id"]]


def test_match_results_include_the_students_own_canteen(client: TestClient) -> None:
    dept = department_id(
        client, "ntua", "ntua-zografou", "Electrical and Computer Engineering"
    )
    res = client.post(
        "/api/v1/match", json={"department_id": dept, "weights": {"commute": 5}}
    )
    for area in res.json()["results"]:
        canteen = area["daily_life"]["canteen"]
        assert canteen["university"] == "NTUA (ΕΜΠ)"
        assert isinstance(area["daily_life"]["nearby_loaded"], bool)


def test_university_without_a_canteen_gets_none_not_anothers(
    client: TestClient,
) -> None:
    dept = department_id(client, "aueb", "aueb-patision", "Informatics")
    res = client.post(
        "/api/v1/match", json={"department_id": dept, "weights": {"commute": 5}}
    )
    for area in res.json()["results"]:
        assert area["daily_life"]["canteen"] is None


def test_nearby_places_are_never_served_stale(client: TestClient) -> None:
    """compute_nearby.py writes straight to Postgres, so reads must not be cached."""
    import psycopg

    from tests.conftest import TEST_DATABASE_URL

    before = client.get("/api/v1/neighborhoods/zografou").json()
    with psycopg.connect(TEST_DATABASE_URL, autocommit=True) as conn:
        row = conn.execute(
            "insert into public.nearby_places "
            "(neighborhood_id, kind, osm_id, name, lat, lng, distance_m) "
            "select id, 'supermarket', 'node/test', 'Test Market', lat, lng, 400 "
            "from public.neighborhoods where slug = 'zografou' returning id"
        ).fetchone()
        try:
            after = client.get("/api/v1/neighborhoods/zografou").json()
            assert after["nearby_loaded"] is True
            assert [p["name"] for p in after["supermarkets"]] == ["Test Market"]
            assert after["supermarkets"][0]["walk_minutes"] == 6  # 400 m
        finally:
            conn.execute("delete from public.nearby_places where id = %s", (row[0],))
    assert before["supermarkets"] == []


def test_greek_content_with_english_default(client: TestClient) -> None:
    en = client.get("/api/v1/neighborhoods/zografou").json()
    el = client.get("/api/v1/neighborhoods/zografou?lang=el").json()
    assert en["description"].startswith("The classic student district")
    assert el["description"].startswith("Η κλασική φοιτητική περιοχή")
    assert len(el["pros"]) == len(en["pros"])
    assert [p["factor"] for p in el["pros"]] == [p["factor"] for p in en["pros"]]
    assert el["scores"] == en["scores"] and el["slug"] == en["slug"]
    assert any(
        t["destination_name"] == "Πολυτεχνειούπολη Ζωγράφου" for t in el["travel_times"]
    )

    unis = client.get("/api/v1/universities?lang=el").json()
    assert {u["slug"]: u["name"] for u in unis}["ntua"] == "Εθνικό Μετσόβιο Πολυτεχνείο"
    assert all(d["name"] for u in unis for d in u["departments"])
    hubs = client.get("/api/v1/hubs?lang=el").json()
    assert {h["slug"]: h["name"] for h in hubs}["piraeus-port"] == "Λιμάνι Πειραιά"

    assert client.get("/api/v1/neighborhoods/zografou?lang=fr").status_code == 422


def test_match_results_follow_the_language(client: TestClient) -> None:
    dept = department_id(
        client, "ntua", "ntua-zografou", "Electrical and Computer Engineering"
    )
    body = {"department_id": dept, "weights": {"commute": 5}}
    en = client.post("/api/v1/match", json=body).json()["results"]
    el = client.post("/api/v1/match?lang=el", json=body).json()["results"]
    assert [a["slug"] for a in en] == [a["slug"] for a in el]
    assert all(a["description"] != b["description"] for a, b in zip(en, el))
    assert all(a["pros"][0]["text"] != b["pros"][0]["text"] for a, b in zip(en, el))
