"""init: profiles, cities, universities, RLS, signup trigger

Revision ID: 0001
Revises:
Create Date: 2026-10-16
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Raw SQL because RLS policies, grants and the auth.users trigger
# aren't expressible in SQLAlchemy models.
UPGRADE_SQL = """
-- Profiles: one row per auth user
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'high_school' check (role in ('high_school', 'university')),
  is_premium boolean not null default false,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

-- Users may edit their own non-billing fields; billing fields are written by the backend (service role).
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

revoke update (is_premium, stripe_customer_id) on public.profiles from authenticated;

-- Create a profile automatically on sign-up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Reference data: cities and universities (public read)
create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  region text
);

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city_id uuid not null references public.cities (id) on delete cascade
);

alter table public.cities enable row level security;
alter table public.universities enable row level security;

create policy "Cities are public" on public.cities for select using (true);
create policy "Universities are public" on public.universities for select using (true);
"""

DOWNGRADE_SQL = """
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.universities;
drop table if exists public.cities;
drop table if exists public.profiles;
"""


def upgrade() -> None:
    op.execute(UPGRADE_SQL)


def downgrade() -> None:
    op.execute(DOWNGRADE_SQL)
