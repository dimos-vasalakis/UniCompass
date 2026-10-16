import os
import uuid
from collections.abc import Iterator

import jwt
import pytest
from fastapi.testclient import TestClient

# Integration tests need a migrated + seeded Postgres:
#   TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/postgres pytest
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
TEST_JWT_SECRET = "test-secret-at-least-32-bytes-long!!"

if TEST_DATABASE_URL:
    # Must be set before app settings are first read.
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    os.environ["DIRECT_URL"] = TEST_DATABASE_URL
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET
os.environ["UPSTASH_REDIS_REST_URL"] = ""
os.environ["UPSTASH_REDIS_REST_TOKEN"] = ""

from app.main import app

requires_db = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason="set TEST_DATABASE_URL to run DB tests"
)


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    # One client = one event loop for the whole session, so pooled async
    # DB connections stay on the loop they were created on.
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def test_user() -> Iterator[uuid.UUID]:
    """A user row in auth.users (FK target) plus a matching access token."""
    import psycopg

    user_id = uuid.uuid4()
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute(
            "insert into auth.users (id, email) values (%s, %s)",
            (user_id, f"{user_id}@test.local"),
        )
    yield user_id
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute("delete from auth.users where id = %s", (user_id,))


def auth_header(user_id: uuid.UUID) -> dict[str, str]:
    token = jwt.encode(
        {"sub": str(user_id), "aud": "authenticated", "email": "t@test.local"},
        TEST_JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}
