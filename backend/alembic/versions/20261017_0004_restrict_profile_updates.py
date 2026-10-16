"""restrict profile updates to full_name and role

0001 revoked column-level UPDATE on is_premium / stripe_customer_id, but
Supabase grants table-level UPDATE to `authenticated`, and a column-level
revoke does not override a table-level grant. Any signed-in user could set
is_premium = true via the Supabase API. Replace the table grant with an
explicit column allow-list. (Caught by tests/test_rls.py.)

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-17
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("revoke update on public.profiles from anon, authenticated")
    op.execute("grant update (full_name, role) on public.profiles to authenticated")


def downgrade() -> None:
    op.execute("revoke update (full_name, role) on public.profiles from authenticated")
    op.execute("grant update on public.profiles to anon, authenticated")
