"""saved_matches.idempotency_key: a double-clicked Save stores one row, not two

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-20
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("alter table public.saved_matches add column idempotency_key uuid")
    # NULLs are distinct, so saves made without a key never conflict.
    op.execute(
        "create unique index saved_matches_user_idempotency_key "
        "on public.saved_matches (user_id, idempotency_key)"
    )


def downgrade() -> None:
    op.execute("drop index public.saved_matches_user_idempotency_key")
    op.execute("alter table public.saved_matches drop column idempotency_key")
