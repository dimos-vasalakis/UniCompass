import uuid

from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_me_requires_auth(client: TestClient) -> None:
    assert client.get("/api/v1/users/me").status_code == 401


def test_save_match_requires_auth(client: TestClient) -> None:
    res = client.post("/api/v1/match/save", json={"department_id": str(uuid.uuid4())})
    assert res.status_code == 401
