# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

UniCompass helps students who passed the Greek Panhellenic exams move to their new university city. Monorepo: `frontend/` (Next.js, Vercel), `mobile/` (Expo SDK 58 + Expo Router, EAS builds; standalone package, env in `mobile/.env.local` as `EXPO_PUBLIC_*`, Supabase auth via the `unicompass://auth/callback` deep link, see `mobile/AGENTS.md`), `backend/` (FastAPI, Render via `render.yaml`), `backend/alembic/` (Postgres schema + RLS via Alembic). Stripe for payments, Resend for email, Upstash Redis for cache.

## Commands

Frontend (run from `frontend/`):
```bash
npm run dev      # http://localhost:3000
npm run build
npm run lint     # eslint
npm run typecheck
npm test         # vitest: src/**/*.test.ts (node) + src/**/*.test.tsx (jsdom, Testing Library)
npm run test:e2e # Playwright (e2e/); starts uvicorn + next itself, needs the seeded test DB
```

Backend (run from `backend/`, Python 3.12, venv in `backend/.venv`):
```bash
pip install -r requirements-dev.txt      # runtime deps (requirements.txt) + pytest + ruff
fastapi dev app/main.py                  # http://localhost:8000/docs (docs disabled when ENVIRONMENT=production)
pytest                                   # all tests
pytest tests/test_health.py::test_health # single test
ruff check . && ruff format .
```

Other:
```bash
docker compose up --build                                         # local stack (Postgres+stub, migrate+seed, API :8000, web :3000; no auth)
alembic upgrade head                                              # from backend/, uses DIRECT_URL
python -m scripts.seed                                            # load data/athens.json (idempotent)
TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/postgres pytest  # incl. DB tests (see docs/development.md)
alembic revision --autogenerate -m "msg"                          # after editing app/models
stripe listen --forward-to localhost:8000/api/v1/billing/webhook  # local Stripe webhooks
```

Env: copy `frontend/.env.example` → `.env.local` and `backend/.env.example` → `.env`. Backend settings live in `app/core/config.py` (pydantic-settings, all default to empty strings so the app boots without secrets).

## Tests & CI

`.github/workflows/ci.yml`: backend (ruff, `alembic upgrade` + `alembic check` + down/up round-trip, seed, pytest on a Postgres service), frontend (lint, typecheck, vitest, build), then e2e (Playwright, desktop + phone). `backend/tests/supabase_stub.sql` stands in for Supabase (auth schema, `anon`/`authenticated` roles **with Supabase's default table grants**), so `test_rls.py` catches grants that look restrictive but aren't. Column-level `revoke` does not undo a table-level grant: restrict columns with an explicit `grant update (cols)` allow-list (see migration `0004`). DB tests use `requires_db` and the `make_user` fixture (inserts `auth.users`, the trigger creates the profile). `frontend/src/lib/factors.test.ts` parses the backend's `Factor` literal and `data/athens.json`, so renaming a factor/zone on one side fails CI. E2E fails on any unexpected browser console error (`e2e/fixtures.ts`).

## Next.js version caveat

`frontend/AGENTS.md`: this is Next.js 16 with breaking changes vs. older versions — read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing Next.js code and heed deprecation notices. Notably, middleware is `src/proxy.ts` exporting `proxy()` (not `middleware.ts`). `next dev` re-adds the AGENTS.md block; don't strip it from diffs.

## Architecture

**Auth spans three systems.** Supabase Auth (Google/GitHub OAuth or email magic link) runs in the frontend. `src/app/(auth)/login` sends users to `/auth/callback?next=…`, which exchanges the code for a session cookie and redirects only to same-site relative paths (open-redirect guard). `src/proxy.ts` → `lib/supabase/proxy.ts` refreshes the session on every request and redirects unauthenticated users away from `PROTECTED_PREFIXES` (currently `/dashboard`) to `/login?next=…`. Sign-up (`/signup`) and sign-in (`/login`) share `components/AuthForm.tsx`; email sign-in uses `shouldCreateUser: false` so unknown emails are pointed to sign-up, and migration `0003` copies `full_name`/`name` from auth metadata into `profiles`. `lib/supabase/config.ts` exports `supabaseConfigured`: with placeholder keys the proxy, header, `apiFetch` and auth pages skip Supabase instead of crashing (public pages keep working). Three Supabase clients exist in `lib/supabase/`: `client.ts` (browser), `server.ts` (server components/route handlers), `proxy.ts` (request proxy) — use the one matching the runtime.

**Frontend → backend.** `lib/api/client.ts` `apiFetch()` prefixes `NEXT_PUBLIC_API_URL` + `/api/v1` and forwards the Supabase access token as a Bearer header. The backend's `app/core/security.py` verifies it by the token's own `alg` header: HS256 with `SUPABASE_JWT_SECRET`, otherwise JWKS from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (ES256/RS256; this project issues ES256), audience `authenticated`. Protected endpoints take `user: CurrentUserDep`.

**Backend is fully async.** Every endpoint and dependency is `async def`; never call blocking I/O directly. Wrap it in `asyncio.to_thread` instead (as `security.py` does for the JWKS fetch). DB access is async SQLAlchemy via the `DbSession` dependency (`app/core/db.py`). The app connects as the `postgres` role through the pooler, which bypasses RLS, so every query must filter by `user.id` itself. Stripe uses `StripeClient` with `HTTPXClient` and the `*_async` methods; Resend is called directly over `httpx` (no SDK); Upstash uses `upstash_redis.asyncio`. `services/supabase.py::get_supabase_admin()` is an async service-role client kept for Auth admin/Storage only, not for table queries. Routers live in `app/api/v1/endpoints/` and are registered in `app/api/v1/router.py`; settings/clients are cached singletons.

**Database & migrations.** Two URLs: `DATABASE_URL` (Supavisor transaction pooler, :6543) for the app's SQLAlchemy engine in `app/core/db.py` (prepared statements disabled, required by the pooler), and `DIRECT_URL` (:5432) used only by `alembic/env.py`. `config.sqlalchemy_url()` rewrites `postgresql://` to `postgresql+psycopg://`, so raw Supabase URIs work. SQLAlchemy models live in `app/models/`; `auth.users` is a stub table there just so FKs resolve, and `env.py`'s `include_object` limits autogenerate to the `public` schema. RLS policies, grants and the signup trigger aren't in the models: write them as raw `op.execute` SQL in revisions (see `0001`). Alembic's `env.py` stays synchronous (psycopg supports both modes).

**RLS & billing fields.** `profiles` rows are auto-created by a trigger on `auth.users` insert. Users may update their own profile directly via Supabase, but `is_premium` and `stripe_customer_id` have UPDATE revoked from `authenticated` — only the backend writes them. Premium is a one-time Stripe Checkout payment (`mode: payment`): `POST /billing/checkout` sets `client_reference_id = user.id`, and the `checkout.session.completed` webhook flips `is_premium`. `cities`/`universities` are public-read reference data.

**Neighborhood match (the core feature).** `data/athens.json` is the source of truth for areas, universities, campuses, departments and hubs; `scripts/seed.py` upserts it by slug and fills `travel_times` with distance estimates (`source='estimate'`) only where rows are missing; `scripts/compute_travel_times.py` overwrites them with Google Routes data (`source='google'`). `services/matching.py` is pure (no I/O): 1–5 scores map to 0–1, rent/commute/home are inverted min–max across the city, weighted by the 0–5 sliders, filtered by `max_rent`/`max_commute`, top 3 returned with `drivers` (largest contributions where the area scores ≥0.6) and pros/cons re-ordered by the student's priorities (`factor: "transport"` follows the commute/home weight). `services/places.py` loads data and caches it in Upstash under `places:v2:*` (6h TTL, keys include the language, bump the prefix if cached shapes change). `/match/save` recomputes server-side rather than trusting client results, and takes an optional `Idempotency-Key` header (unique per user, migration `0008`) so a double-clicked Save stores one row; `/match/saved/{id}` reads/deletes one (`/dashboard/saved/[id]` in the frontend). Frontend: `/match` is a client flow (`MatchFlow.tsx`) fed by a server loader; server pages call `getPublic()` (`lib/api/server.ts`, `"use cache"`) only after `await connection()` / inside Suspense so `next build` never needs the API.

**Daily life.** `student_canteens` (φοιτητικές λέσχες) are curated in `data/athens.json` (`approximate: true` = pin is just the campus, no street address) and seeded; `nearby_places` (supermarkets/gyms) is filled only by `scripts/compute_nearby.py`, so it's empty until that runs. Distances are computed at read time in `services/places.py` (walk if ≤1.5 km, else a transit estimate); `/match` results get `daily_life` attached (only the student's own university's canteen, none if it has none).

**Listing Check (AI assistant).** `/assistant` (public page; visitors without an account get a sign-up prompt, not the form) → `POST /assistant/listing-checks`: the student sends up to 3 screenshots (resized to JPEG in the browser, `lib/listingImage.ts`) and/or pasted text, and `services/listing_check.py` makes one Claude call (`beta.messages.parse` with structured output, `ANTHROPIC_MODEL`, refusal `fallbacks="default"`) with a prompt-cached table of every area. Numbers shown (typical rent, % vs area, commute, canteen, metro) are recomputed from our data in `area_facts()`, never taken from the model. Quota: each account gets `LISTING_CHECK_LIMIT` (3) checks ever, in `profiles.listing_checks_used` (migration `0009`; not in the authenticated UPDATE allow-list). The request first inserts a pending row (`result` NULL, migration `0010`) that reserves its `Idempotency-Key`, so a retry arriving mid-answer gets 409 (the frontend waits and retries) rather than a second paid call; pending rows are hidden from reads, and any of the user's pending rows older than 5 minutes (a dead worker's) are released on their next request, whatever the key. Then one conditional `UPDATE … RETURNING` spends a check atomically before the call; any failure after that refunds it, including cancellation (`release_check` deletes the pending row and refunds in its own session under `asyncio.shield`, and refunds nothing if the answer was already committed); an answer of "not a listing" doesn't. The frontend reads the limits from public `GET /assistant/limits`, never hard-coded. Images are never stored. Tests and local dev use `FakeAnalyzer` (dependency override, or `LISTING_CHECK_FAKE=true` outside production), so nothing calls the real API.

**Languages (English/Greek).** The language is a `locale` cookie (default `en`), set by `components/LanguageToggle.tsx`, which then calls `router.refresh()`; URLs don't change. The root layout reads it inside a `<Suspense>` (`LocaleShell`), so the whole app renders per request. UI text lives in `frontend/src/lib/i18n/en.ts` (source of truth) and `el.ts`, which must have the same shape and `{placeholders}` (`i18n.test.ts` checks); server components use `getDictionary()`/`getLocale()`, client components `useDict()`/`useLocale()`, and `fmt()` fills placeholders. Data text comes from the API with `?lang=el` (every public endpoint and `/match`, `/match/save`): Greek lives in `backend/data/athens.el.json` (names, departments, hubs, neighborhood descriptions and pros/cons, in the same order as the English), is seeded into `*_el` columns (and `text_el` inside the pros/cons JSONB), and falls back to English where missing. Cache keys include the language. Saved matches keep the language they were saved in. Adding a pro/con or department in `athens.json` fails `test_data.py` until the Greek is added. The language is set by the `setLocale` Server Action (cookie + re-render in one round trip, which also invalidates the client router cache); `LocaleProvider` switches client text instantly meanwhile. Dev-only hints in `ApiUnavailable` stay English.

**Caching.** `GET /users/me` caches the profile in Upstash under `profile:{user_id}` (5 min); any write path that changes a profile must `cache_delete` that key (`PATCH /users/me` and the Stripe webhook both do). Unreachable/unconfigured Postgres returns 503 `Database unavailable` (handler in `main.py`, guard in `get_db`), and server pages use `tryGetPublic()` to show `ApiUnavailable` instead of erroring. All cache helpers no-op when Upstash isn't configured and swallow Upstash errors, so the API works without it.
