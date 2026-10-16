-- Minimal stand-in for the bits of Supabase our migrations touch, so they can
-- run against plain Postgres (Docker locally, a service container in CI).
-- See README "Backend tests".
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role authenticated nologin;
create role anon nologin;
grant usage on schema auth to anon, authenticated;

-- Supabase's defaults: API roles get full table privileges in `public`, and RLS
-- policies are what actually restrict them. Mirroring this lets tests catch
-- grants/policies that look restrictive but aren't.
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
