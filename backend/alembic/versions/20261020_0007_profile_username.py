"""profile username: chosen by OAuth users after their first sign-in

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-20
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("alter table public.profiles add column username text")
    op.execute(
        "alter table public.profiles add constraint profiles_username_format "
        "check (username ~ '^[A-Za-z0-9_.-]{3,20}$')"
    )
    op.execute(
        "create unique index profiles_username_key on public.profiles (lower(username))"
    )
    op.execute("grant update (username) on public.profiles to authenticated")


def downgrade() -> None:
    op.execute("drop index public.profiles_username_key")
    op.execute("alter table public.profiles drop column username")
