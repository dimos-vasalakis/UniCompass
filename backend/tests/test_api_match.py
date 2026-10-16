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
