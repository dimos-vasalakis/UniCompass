"""Row-level security and grants, checked the way Supabase's API would hit them.

The stub in tests/supabase_stub.sql gives anon/authenticated Supabase's default
table privileges, so these tests prove the *policies and grants* restrict
access, not missing privileges.
"""

import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager

import psycopg
import pytest

from tests.conftest import TEST_DATABASE_URL, requires_db

pytestmark = requires_db


@contextmanager
def as_role(role: str, user_id: uuid.UUID | None = None) -> Iterator[psycopg.Cursor]:
    """A transaction acting as a Supabase API role; always rolled back."""
    with (
        psycopg.connect(TEST_DATABASE_URL) as conn,
        conn.transaction(force_rollback=True),
        conn.cursor() as cur,
    ):
        cur.execute(f"set local role {role}")
        if user_id:
            cur.execute(
                "select set_config('request.jwt.claim.sub', %s, true)",
                (str(user_id),),
            )
        yield cur


def denied(fn: Callable[[], object]) -> bool:
    try:
        fn()
    except psycopg.errors.InsufficientPrivilege:
        return True
    return False


def test_signup_creates_profile_with_name(make_user) -> None:
    user = make_user(full_name="Maria Papadopoulou")
    with as_role("authenticated", user) as cur:
        cur.execute("select full_name, is_premium from public.profiles")
        assert cur.fetchall() == [("Maria Papadopoulou", False)]


def test_users_only_see_their_own_profile(make_user) -> None:
    alice, bob = make_user(), make_user()
    with as_role("authenticated", alice) as cur:
        cur.execute("select id from public.profiles")
        assert [r[0] for r in cur.fetchall()] == [alice]
    with as_role("anon") as cur:
        cur.execute("select count(*) from public.profiles")
        assert cur.fetchone() == (0,)
    assert bob  # created, but invisible to alice and anon


def test_users_can_edit_name_and_role(test_user) -> None:
    with as_role("authenticated", test_user) as cur:
        cur.execute(
            "update public.profiles set full_name = 'New', role = 'university' "
            "where id = auth.uid()"
        )
        assert cur.rowcount == 1


@pytest.mark.parametrize(
    "assignment",
    [
        "is_premium = true",
        "stripe_customer_id = 'cus_fake'",
        "email = 'x@evil.gr'",
        "listing_checks_used = 0",
    ],
)
def test_users_cannot_edit_billing_or_email(test_user, assignment) -> None:
    with as_role("authenticated", test_user) as cur:
        assert denied(
            lambda: cur.execute(
                f"update public.profiles set {assignment} where id = auth.uid()"
            )
        )


def test_users_cannot_edit_someone_elses_profile(make_user) -> None:
    alice, bob = make_user(), make_user()
    with as_role("authenticated", alice) as cur:
        cur.execute(
            "update public.profiles set full_name = 'pwned' where id = %s", (bob,)
        )
        assert cur.rowcount == 0


@pytest.mark.parametrize(
    "table",
    [
        "cities",
        "universities",
        "campuses",
        "departments",
        "neighborhoods",
        "transit_hubs",
        "travel_times",
        "student_canteens",
    ],
)
def test_reference_data_is_public_read_only(table) -> None:
    with as_role("anon") as cur:
        cur.execute(f"select count(*) from public.{table}")
        assert cur.fetchone()[0] > 0
        cur.execute(f"update public.{table} set id = id")
        assert cur.rowcount == 0  # RLS: no update policy → no visible rows
        cur.execute(f"delete from public.{table}")
        assert cur.rowcount == 0


def test_nearby_places_are_public_read_only() -> None:
    # Filled by scripts/compute_nearby.py (OSM), so it may be empty in CI.
    with as_role("anon") as cur:
        cur.execute("select count(*) from public.nearby_places")
        cur.execute("delete from public.nearby_places")
        assert cur.rowcount == 0
    with (
        as_role("authenticated", uuid.uuid4()) as cur,
        pytest.raises(psycopg.errors.InsufficientPrivilege),
    ):
        cur.execute(
            "insert into public.nearby_places "
            "(neighborhood_id, kind, osm_id, name, lat, lng, distance_m) "
            "values (gen_random_uuid(), 'gym', 'node/1', 'x', 0, 0, 0)"
        )


def test_reference_data_cannot_be_inserted() -> None:
    with (
        as_role("authenticated", uuid.uuid4()) as cur,
        pytest.raises(psycopg.errors.InsufficientPrivilege),
    ):
        cur.execute("insert into public.cities (slug, name) values ('evil', 'Evil')")


def test_saved_matches_are_private(make_user) -> None:
    alice, bob = make_user(), make_user()
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        dept = conn.execute("select id from public.departments limit 1").fetchone()[0]
        conn.execute(
            "insert into public.saved_matches (user_id, department_id, preferences, result) "
            "values (%s, %s, '{}', '[]')",
            (alice, dept),
        )
    with as_role("authenticated", alice) as cur:
        cur.execute("select count(*) from public.saved_matches")
        assert cur.fetchone() == (1,)
    with as_role("authenticated", bob) as cur:
        cur.execute("select count(*) from public.saved_matches")
        assert cur.fetchone() == (0,)
        # Writes go through the API (server-side recompute), never directly.
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            cur.execute(
                "insert into public.saved_matches (user_id, department_id, preferences, result) "
                "values (%s, %s, '{}', '[]')",
                (bob, dept),
            )


def test_listing_checks_are_private(make_user) -> None:
    alice, bob = make_user(), make_user()
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute(
            "insert into public.listing_checks (user_id, lang, result) "
            "values (%s, 'en', '{}')",
            (alice,),
        )
    with as_role("authenticated", alice) as cur:
        cur.execute("select count(*) from public.listing_checks")
        assert cur.fetchone() == (1,)
    with as_role("authenticated", bob) as cur:
        cur.execute("select count(*) from public.listing_checks")
        assert cur.fetchone() == (0,)
        # Checks are created by the API only (it spends the quota).
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            cur.execute(
                "insert into public.listing_checks (user_id, lang, result) "
                "values (%s, 'en', '{}')",
                (bob,),
            )


def test_alembic_version_is_hidden_from_the_api() -> None:
    with as_role("anon") as cur:
        cur.execute("select count(*) from public.alembic_version")
        assert cur.fetchone() == (0,)
