import os
import uuid
from collections.abc import Callable, Iterator

import jwt
import pytest
from fastapi.testclient import TestClient

# DB tests need a migrated + seeded Postgres (see README "Backend tests"):
#   TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/postgres pytest
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
TEST_JWT_SECRET = "test-secret-at-least-32-bytes-long!!"
TEST_STRIPE_WEBHOOK_SECRET = "whsec_test_secret"

# Must be set before app settings are first read.
if TEST_DATABASE_URL:
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    os.environ["DIRECT_URL"] = TEST_DATABASE_URL
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET
os.environ["STRIPE_WEBHOOK_SECRET"] = TEST_STRIPE_WEBHOOK_SECRET
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


@pytest.fixture
def make_user() -> Iterator[Callable[..., uuid.UUID]]:
    """Create auth.users rows (the signup trigger creates their profiles)."""
    import psycopg
    from psycopg.types.json import Jsonb

    created: list[uuid.UUID] = []

    def _make(full_name: str | None = None) -> uuid.UUID:
        user_id = uuid.uuid4()
        meta = {"full_name": full_name} if full_name else {}
        with psycopg.connect(TEST_DATABASE_URL) as conn:
            conn.execute(
                "insert into auth.users (id, email, raw_user_meta_data) "
                "values (%s, %s, %s)",
                (user_id, f"{user_id}@test.local", Jsonb(meta)),
            )
        created.append(user_id)
        return user_id

    yield _make

    with psycopg.connect(TEST_DATABASE_URL) as conn:
        for user_id in created:
            conn.execute("delete from auth.users where id = %s", (user_id,))


@pytest.fixture
def test_user(make_user: Callable[..., uuid.UUID]) -> uuid.UUID:
    return make_user()


def make_token(
    user_id: uuid.UUID, *, secret: str = TEST_JWT_SECRET, **claims: object
) -> str:
    payload = {
        "sub": str(user_id),
        "aud": "authenticated",
        "email": f"{user_id}@test.local",
        **claims,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def auth_header(user_id: uuid.UUID, **claims: object) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(user_id, **claims)}"}
