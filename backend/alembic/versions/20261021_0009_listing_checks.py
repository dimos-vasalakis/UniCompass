"""listing_checks + profiles.listing_checks_used: the Listing Check assistant

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-21
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Not added to the authenticated UPDATE allow-list (0004, 0007): only the
    # backend spends or refunds checks.
    op.execute(
        "alter table public.profiles "
        "add column listing_checks_used smallint not null default 0"
    )
    op.execute(
        """
        create table public.listing_checks (
          id uuid primary key default gen_random_uuid(),
          user_id uuid not null references auth.users (id) on delete cascade,
          department_id uuid references public.departments (id) on delete set null,
          lang text not null,
          input_text text,
          image_count smallint not null default 0,
          result jsonb not null,
          idempotency_key uuid,
          created_at timestamptz not null default now()
        )
        """
    )
    op.execute(
        "create index ix_listing_checks_user_id on public.listing_checks (user_id)"
    )
    # NULLs are distinct, so checks made without a key never conflict.
    op.execute(
        "create unique index listing_checks_user_idempotency_key "
        "on public.listing_checks (user_id, idempotency_key)"
    )
    # Owners can read their checks via Supabase; writes only go through the API.
    op.execute("alter table public.listing_checks enable row level security")
    op.execute(
        'create policy "Users can read own listing checks" '
        "on public.listing_checks for select using (auth.uid() = user_id)"
    )


def downgrade() -> None:
    op.execute("drop table public.listing_checks")
    op.execute("alter table public.profiles drop column listing_checks_used")
