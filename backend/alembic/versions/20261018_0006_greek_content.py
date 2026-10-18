"""Greek translations of reference data (nullable; English is the fallback)

Point texts (pros/cons) carry their Greek in a `text_el` key inside the JSONB.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-18
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLUMNS = [
    ("universities", "name_el"),
    ("campuses", "name_el"),
    ("departments", "name_el"),
    ("neighborhoods", "description_el"),
    ("transit_hubs", "name_el"),
    ("transit_hubs", "serves_el"),
]


def upgrade() -> None:
    for table, column in COLUMNS:
        op.add_column(table, sa.Column(column, sa.Text(), nullable=True))


def downgrade() -> None:
    for table, column in reversed(COLUMNS):
        op.drop_column(table, column)
