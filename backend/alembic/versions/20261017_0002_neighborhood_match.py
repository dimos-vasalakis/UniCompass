"""neighborhood match: campuses, departments, neighborhoods, hubs, travel times

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-17
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Reference data is public-read; saved matches are private to their owner.
RLS_SQL = """
alter table public.campuses enable row level security;
alter table public.departments enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.transit_hubs enable row level security;
alter table public.travel_times enable row level security;
alter table public.saved_matches enable row level security;
-- Supabase exposes public tables over its REST API; no policies = no access.
alter table public.alembic_version enable row level security;

create policy "Campuses are public" on public.campuses for select using (true);
create policy "Departments are public" on public.departments for select using (true);
create policy "Neighborhoods are public" on public.neighborhoods for select using (true);
create policy "Transit hubs are public" on public.transit_hubs for select using (true);
create policy "Travel times are public" on public.travel_times for select using (true);

create policy "Users can read own saved matches"
  on public.saved_matches for select using (auth.uid() = user_id);
create policy "Users can delete own saved matches"
  on public.saved_matches for delete using (auth.uid() = user_id);
"""


def upgrade() -> None:
    op.create_table(
        "neighborhoods",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("city_id", sa.UUID(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("name_el", sa.Text(), nullable=False),
        sa.Column("zone", sa.Text(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("typical_studio_rent", sa.SmallInteger(), nullable=False),
        sa.Column("safety", sa.SmallInteger(), nullable=False),
        sa.Column("quiet", sa.SmallInteger(), nullable=False),
        sa.Column("nightlife", sa.SmallInteger(), nullable=False),
        sa.Column("green", sa.SmallInteger(), nullable=False),
        sa.Column("amenities", sa.SmallInteger(), nullable=False),
        sa.Column("student_life", sa.SmallInteger(), nullable=False),
        sa.Column(
            "pros",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "cons",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "sources",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["city_id"],
            ["cities.id"],
            name=op.f("neighborhoods_city_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("neighborhoods_pkey")),
        sa.UniqueConstraint("slug", name=op.f("neighborhoods_slug_key")),
    )
    op.create_table(
        "transit_hubs",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("city_id", sa.UUID(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("serves", sa.Text(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.CheckConstraint(
            "kind in ('ktel', 'airport', 'port', 'rail')",
            name=op.f("transit_hubs_kind_check"),
        ),
        sa.ForeignKeyConstraint(
            ["city_id"],
            ["cities.id"],
            name=op.f("transit_hubs_city_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("transit_hubs_pkey")),
        sa.UniqueConstraint("slug", name=op.f("transit_hubs_slug_key")),
    )
    op.create_table(
        "campuses",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("university_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["universities.id"],
            name=op.f("campuses_university_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("campuses_pkey")),
        sa.UniqueConstraint("slug", name=op.f("campuses_slug_key")),
    )
    op.create_table(
        "departments",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("university_id", sa.UUID(), nullable=False),
        sa.Column("campus_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["campus_id"],
            ["campuses.id"],
            name=op.f("departments_campus_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["universities.id"],
            name=op.f("departments_university_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("departments_pkey")),
        sa.UniqueConstraint(
            "campus_id", "name", name=op.f("departments_campus_id_key")
        ),
    )
    op.create_table(
        "travel_times",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("neighborhood_id", sa.UUID(), nullable=False),
        sa.Column("campus_id", sa.UUID(), nullable=True),
        sa.Column("hub_id", sa.UUID(), nullable=True),
        sa.Column("transit_minutes", sa.SmallInteger(), nullable=False),
        sa.Column("route_summary", sa.Text(), nullable=True),
        sa.Column("source", sa.Text(), server_default="estimate", nullable=False),
        sa.CheckConstraint(
            "source in ('estimate', 'google')", name=op.f("travel_times_source_check")
        ),
        sa.CheckConstraint(
            "(campus_id is null) <> (hub_id is null)",
            name=op.f("travel_times_one_destination_check"),
        ),
        sa.ForeignKeyConstraint(
            ["campus_id"],
            ["campuses.id"],
            name=op.f("travel_times_campus_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["hub_id"],
            ["transit_hubs.id"],
            name=op.f("travel_times_hub_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["neighborhood_id"],
            ["neighborhoods.id"],
            name=op.f("travel_times_neighborhood_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("travel_times_pkey")),
    )
    op.create_table(
        "saved_matches",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column(
            "preferences", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["departments.id"],
            name=op.f("saved_matches_department_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["auth.users.id"],
            name=op.f("saved_matches_user_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("saved_matches_pkey")),
    )
    op.create_index(
        op.f("ix_saved_matches_user_id"), "saved_matches", ["user_id"], unique=False
    )
    op.create_index(
        "travel_times_neighborhood_campus_key",
        "travel_times",
        ["neighborhood_id", "campus_id"],
        unique=True,
        postgresql_where=sa.text("campus_id is not null"),
    )
    op.create_index(
        "travel_times_neighborhood_hub_key",
        "travel_times",
        ["neighborhood_id", "hub_id"],
        unique=True,
        postgresql_where=sa.text("hub_id is not null"),
    )
    op.add_column("cities", sa.Column("slug", sa.Text(), nullable=False))
    op.create_unique_constraint(op.f("cities_slug_key"), "cities", ["slug"])
    op.add_column("universities", sa.Column("slug", sa.Text(), nullable=False))
    op.add_column("universities", sa.Column("short_name", sa.Text(), nullable=False))
    op.create_unique_constraint(op.f("universities_slug_key"), "universities", ["slug"])
    op.execute(RLS_SQL)


def downgrade() -> None:
    op.drop_constraint(op.f("universities_slug_key"), "universities", type_="unique")
    op.drop_column("universities", "short_name")
    op.drop_column("universities", "slug")
    op.drop_constraint(op.f("cities_slug_key"), "cities", type_="unique")
    op.drop_column("cities", "slug")
    op.drop_index("travel_times_neighborhood_hub_key", table_name="travel_times")
    op.drop_index("travel_times_neighborhood_campus_key", table_name="travel_times")
    op.drop_index(op.f("ix_saved_matches_user_id"), table_name="saved_matches")
    op.drop_table("saved_matches")
    op.drop_table("travel_times")
    op.drop_table("departments")
    op.drop_table("campuses")
    op.drop_table("transit_hubs")
    op.drop_table("neighborhoods")
