"""listing_checks.result nullable: a pending row reserves the idempotency key

A retry that arrives while Claude is still answering finds the pending row and
gets 409, rather than spending a second check and making a second paid call.

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-21
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("alter table public.listing_checks alter column result drop not null")


def downgrade() -> None:
    op.execute("delete from public.listing_checks where result is null")
    op.execute("alter table public.listing_checks alter column result set not null")
