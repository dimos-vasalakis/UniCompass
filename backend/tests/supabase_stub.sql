-- Minimal stand-in for the bits of Supabase our migrations touch, so they can
-- run against plain Postgres in Docker. See README "Backend tests".
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role authenticated nologin;
create role anon nologin;
