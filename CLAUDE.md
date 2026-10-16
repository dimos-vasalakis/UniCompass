# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

UniCompass helps students who passed the Greek Panhellenic exams move to their new university city. Monorepo: `frontend/` (Next.js, Vercel), `backend/` (FastAPI, Render via `render.yaml`), `backend/alembic/` (Postgres schema + RLS via Alembic). Stripe for payments, Resend for email, Upstash Redis for cache.

## Commands

Frontend (run from `frontend/`):
```bash
npm run dev      # http://localhost:3000
npm run build
npm run lint     # eslint
```

Backend (run from `backend/`, Python 3.12, venv in `backend/.venv`):
```bash
pip install -r requirements.txt          # includes pytest + ruff
fastapi dev app/main.py                  # http://localhost:8000/docs (docs disabled when ENVIRONMENT=production)
pytest                                   # all tests
pytest tests/test_health.py::test_health # single test
ruff check . && ruff format .
```

Other:
```bash
alembic upgrade head                                              # from backend/, uses DIRECT_URL
python -m scripts.seed                                            # load data/athens.json (idempotent)
TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/postgres pytest  # incl. DB tests (see README)
alembic revision --autogenerate -m "msg"                          # after editing app/models
stripe listen --forward-to localhost:8000/api/v1/billing/webhook  # local Stripe webhooks
```

Env: copy `frontend/.env.example` → `.env.local` and `backend/.env.example` → `.env`. Backend settings live in `app/core/config.py` (pydantic-settings, all default to empty strings so the app boots without secrets).

## Next.js version caveat

`frontend/AGENTS.md`: this is Next.js 16 with breaking changes vs. older versions — read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing Next.js code and heed deprecation notices. Notably, middleware is `src/proxy.ts` exporting `proxy()` (not `middleware.ts`). `next dev` re-adds the AGENTS.md block; don't strip it from diffs.

## Architecture

**Auth spans three systems.** Supabase Auth (Google/GitHub OAuth or email magic link) runs in the frontend. `src/app/(auth)/login` sends users to `/auth/callback?next=…`, which exchanges the code for a session cookie and redirects only to same-site relative paths (open-redirect guard). `src/proxy.ts` → `lib/supabase/proxy.ts` refreshes the session on every request and redirects unauthenticated users away from `PROTECTED_PREFIXES` (currently `/dashboard`) to `/login?next=…`. Three Supabase clients exist in `lib/supabase/`: `client.ts` (browser), `server.ts` (server components/route handlers), `proxy.ts` (request proxy) — use the one matching the runtime.

**Frontend → backend.** `lib/api/client.ts` `apiFetch()` prefixes `NEXT_PUBLIC_API_URL` + `/api/v1` and forwards the Supabase access token as a Bearer header. The backend's `app/core/security.py` verifies it: HS256 with `SUPABASE_JWT_SECRET` if set, otherwise JWKS from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (ES256/RS256), audience `authenticated`. Protected endpoints take `user: CurrentUserDep`.

**Backend is fully async.** Every endpoint and dependency is `async def`; never call blocking I/O directly. Wrap it in `asyncio.to_thread` instead (as `security.py` does for the JWKS fetch). DB access is async SQLAlchemy via the `DbSession` dependency (`app/core/db.py`). The app connects as the `postgres` role through the pooler, which bypasses RLS, so every query must filter by `user.id` itself. Stripe uses `StripeClient` with `HTTPXClient` and the `*_async` methods; Resend is called directly over `httpx` (no SDK); Upstash uses `upstash_redis.asyncio`. `services/supabase.py::get_supabase_admin()` is an async service-role client kept for Auth admin/Storage only, not for table queries. Routers live in `app/api/v1/endpoints/` and are registered in `app/api/v1/router.py`; settings/clients are cached singletons.

**Database & migrations.** Two URLs: `DATABASE_URL` (Supavisor transaction pooler, :6543) for the app's SQLAlchemy engine in `app/core/db.py` (prepared statements disabled, required by the pooler), and `DIRECT_URL` (:5432) used only by `alembic/env.py`. `config.sqlalchemy_url()` rewrites `postgresql://` to `postgresql+psycopg://`, so raw Supabase URIs work. SQLAlchemy models live in `app/models/`; `auth.users` is a stub table there just so FKs resolve, and `env.py`'s `include_object` limits autogenerate to the `public` schema. RLS policies, grants and the signup trigger aren't in the models: write them as raw `op.execute` SQL in revisions (see `0001`). Alembic's `env.py` stays synchronous (psycopg supports both modes).

**RLS & billing fields.** `profiles` rows are auto-created by a trigger on `auth.users` insert. Users may update their own profile directly via Supabase, but `is_premium` and `stripe_customer_id` have UPDATE revoked from `authenticated` — only the backend writes them. Premium is a one-time Stripe Checkout payment (`mode: payment`): `POST /billing/checkout` sets `client_reference_id = user.id`, and the `checkout.session.completed` webhook flips `is_premium`. `cities`/`universities` are public-read reference data.

**Neighborhood match (the core feature).** `data/athens.json` is the source of truth for areas, universities, campuses, departments and hubs; `scripts/seed.py` upserts it by slug and fills `travel_times` with distance estimates (`source='estimate'`) only where rows are missing; `scripts/compute_travel_times.py` overwrites them with Google Routes data (`source='google'`). `services/matching.py` is pure (no I/O): 1–5 scores map to 0–1, rent/commute/home are inverted min–max across the city, weighted by the 0–5 sliders, filtered by `max_rent`/`max_commute`, top 3 returned with `drivers` (largest contributions where the area scores ≥0.6) and pros/cons re-ordered by the student's priorities (`factor: "transport"` follows the commute/home weight). `services/places.py` loads data and caches it in Upstash under `places:v1:*` (6h TTL, bump the prefix if cached shapes change). `/match/save` recomputes server-side rather than trusting client results. Frontend: `/match` is a client flow (`MatchFlow.tsx`) fed by a server loader; server pages call `getPublic()` (`lib/api/server.ts`, `"use cache"`) only after `await connection()` / inside Suspense so `next build` never needs the API.

**Caching.** `GET /users/me` caches the profile in Upstash under `profile:{user_id}` (5 min); any write path that changes a profile must `cache_delete` that key (`PATCH /users/me` and the Stripe webhook both do). All cache helpers no-op when Upstash isn't configured and swallow Upstash errors, so the API works without it.
