"""daily life: student canteens (λέσχες) and nearby supermarkets/gyms

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-18
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RLS_SQL = """
alter table public.student_canteens enable row level security;
alter table public.nearby_places enable row level security;

create policy "Student canteens are public" on public.student_canteens
  for select using (true);
create policy "Nearby places are public" on public.nearby_places
  for select using (true);
"""


def upgrade() -> None:
    op.create_table(
        "student_canteens",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("university_id", sa.UUID(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("name_el", sa.Text(), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column(
            "approximate", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["universities.id"],
            name=op.f("student_canteens_university_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("student_canteens_pkey")),
        sa.UniqueConstraint("slug", name=op.f("student_canteens_slug_key")),
    )
    op.create_table(
        "nearby_places",
        sa.Column(
            "id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False
        ),
        sa.Column("neighborhood_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("osm_id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("distance_m", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "kind in ('supermarket', 'gym')", name=op.f("nearby_places_kind_check")
        ),
        sa.ForeignKeyConstraint(
            ["neighborhood_id"],
            ["neighborhoods.id"],
            name=op.f("nearby_places_neighborhood_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("nearby_places_pkey")),
        sa.UniqueConstraint(
            "neighborhood_id", "osm_id", name=op.f("nearby_places_neighborhood_id_key")
        ),
    )
    op.execute(RLS_SQL)


def downgrade() -> None:
    op.drop_table("nearby_places")
    op.drop_table("student_canteens")
