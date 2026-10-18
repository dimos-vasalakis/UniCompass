import psycopg

from scripts.seed import seed
from tests.conftest import TEST_DATABASE_URL, requires_db

pytestmark = requires_db

TABLES = (
    "neighborhoods",
    "campuses",
    "departments",
    "transit_hubs",
    "travel_times",
    "student_canteens",
)


def counts() -> dict[str, int]:
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        return {
            t: conn.execute(f"select count(*) from public.{t}").fetchone()[0]
            for t in TABLES
        }


def test_seed_is_idempotent() -> None:
    before = counts()
    seed("athens")
    assert counts() == before


def test_seed_keeps_google_travel_times() -> None:
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        tt_id, minutes, source = conn.execute(
            "select id, transit_minutes, source from public.travel_times limit 1"
        ).fetchone()
        conn.execute(
            "update public.travel_times set transit_minutes = 7, source = 'google' "
            "where id = %s",
            (tt_id,),
        )
    seed("athens")
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        row = conn.execute(
            "select transit_minutes, source from public.travel_times where id = %s",
            (tt_id,),
        ).fetchone()
        assert row == (7, "google")
        # Put the row back: other tests (and e2e) share this database.
        conn.execute(
            "update public.travel_times set transit_minutes = %s, source = %s "
            "where id = %s",
            (minutes, source, tt_id),
        )
