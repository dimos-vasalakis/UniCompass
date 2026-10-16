"""profile full_name on signup: copy name from auth metadata (form, Google, GitHub)

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-17
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _trigger_fn(full_name_expr: str) -> str:
    return f"""
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, {full_name_expr});
  return new;
end;
$$;
"""


def upgrade() -> None:
    # Sign-up form sends `full_name`; Google sends `full_name`/`name`; GitHub `name`.
    op.execute(
        _trigger_fn(
            "nullif(coalesce(new.raw_user_meta_data ->> 'full_name', "
            "new.raw_user_meta_data ->> 'name'), '')"
        )
    )


def downgrade() -> None:
    op.execute(_trigger_fn("null"))
