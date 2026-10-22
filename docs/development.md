# Development guide

Architecture, data, tests and migrations. For configuration and deployment see [setup.md](setup.md).

## How it fits together

1. **Sign-in.** Users sign in on the frontend through Supabase Auth: Google, GitHub or an email magic link. `/auth/callback` swaps the code for a session cookie, and `src/proxy.ts` refreshes it and protects `/dashboard`.
2. **API calls.** The frontend sends the Supabase access token to the backend as `Authorization: Bearer …`. The backend verifies it with Supabase's JWKS (or the legacy HS256 secret).
3. **Database access.** The backend talks to Postgres directly with async SQLAlchemy through the pooler. That connection bypasses RLS, so every query filters by the user's id itself. Users can edit only `full_name`/`role`/`username` of their own profile through Supabase directly; billing fields like `is_premium` are written only by the backend's Stripe webhook, and the listing-check counter only by the backend.
4. **Caching.** Reference data (areas, universities, hubs, canteens, campus routes) is cached in Upstash for 6 hours, keyed by language, and profiles for 5 minutes. Nearby supermarkets and gyms are never cached. Reseeding clears the cache.
5. **Listing check.** `/assistant` is a public page: visitors without an account see a sign-up button (`/signup?next=/assistant`), signed-in users get the form. The browser shrinks screenshots to JPEG, then `POST /api/v1/assistant/listing-checks` spends one check, makes one Claude call (`services/listing_check.py`, structured output) and stores the answer. The figures shown (area rent, % vs the area, commute, canteen, metro) come from our own data, not from the model. Past checks open at `/dashboard/checks/<id>`.
6. **Map.** `src/components/MatchMap.tsx` builds the Leaflet map imperatively in one effect (react-leaflet's `MapContainer` crashed when React re-ran effects). It is used on the match results and on every area page. Pins: numbered areas, campus, hub, supermarkets, gyms, canteens and the nearest metro station (Μ); tapping a station draws its lines. Supermarkets and gyms show no walking times, because the student's home isn't known. On match results the view fits only the areas, campus and hub; an area page fits every pin. "Full guide" links carry `?campus=<slug>`, which adds the route section (`RouteGuide.tsx`) to the area page.

```
frontend/                 Next.js app
  src/app/                routes: /, /match, /neighborhoods, /assistant, /login, /signup, /auth/callback, /dashboard, /pricing
  src/components/         shared UI (AuthForm, MatchMap, MetroCard, RouteGuide, score bars, language toggle, …)
  src/lib/i18n/           English/Greek dictionaries and locale helpers
  src/lib/supabase/       browser, server and proxy Supabase clients
  src/lib/api/            fetch helpers for the backend
  src/proxy.ts            session refresh + protected routes
  e2e/                    Playwright tests
mobile/                    Expo app (src/app routes, src/lib Supabase + API client)
backend/                  FastAPI app
  app/api/v1/endpoints/   health, users, billing (+ Stripe webhook), places, match, assistant
  app/core/               settings, DB engine, JWT verification
  app/services/           matching, metro, routing (pure), places, billing, cache, email, listing_check (Claude)
  app/models/, schemas/   SQLAlchemy models, Pydantic API models
  alembic/                migrations
  data/athens.json        area/university/hub/canteen data (athens.el.json: Greek text)
  data/metro/athens.json  metro lines and stations
  scripts/                seed, compute_travel_times, compute_nearby, clear_cache
render.yaml               Render blueprint
```

## Docker

`docker-compose.yml` runs the stack locally: `db` (Postgres 16 with `backend/tests/supabase_stub.sql`, host port `55432`), `migrate` (one-off `alembic upgrade head` + seed), `api` (`:8000`, `LISTING_CHECK_FAKE=true`) and `web` (`:3000`).

```bash
docker compose up --build        # everything
docker compose down -v           # stop and wipe the database
```

- There's no Supabase Auth in this setup, so sign-in is off. Use the non-Docker setup with a real Supabase project to work on auth.
- The browser calls the API on `localhost:8000`, while the web container's server components use `INTERNAL_API_URL=http://api:8000` (`lib/api/server.ts`).
- `NEXT_PUBLIC_*` values are build args of `frontend/Dockerfile`: change them in `docker-compose.yml` and rebuild.
- `frontend/Dockerfile` builds Next's standalone server (`NEXT_OUTPUT=standalone`). Vercel ignores the Dockerfile and builds as before.
- Compose takes host ports 3000, 8000 and 55432, the same ones the host dev servers, Playwright and the test database use: stop it before running those.
- The mobile app isn't containerized: run `npx expo start` on the host so Expo Go can reach Metro over your network.

## Tests

CI (`.github/workflows/ci.yml`) runs everything on each push to `main` and on each PR: backend lint, migrations, seed and pytest; mobile lint and typecheck; frontend lint, typecheck, Vitest and build; then Playwright end-to-end tests on desktop and phone.

**Backend**

```bash
cd backend
ruff check . && ruff format .
pytest                      # unit tests; DB tests skip without a test database
```

DB tests (API, RLS/grants, seed, Stripe webhook) need a migrated, seeded Postgres. A throwaway one in Docker (or any local Postgres 16 on port 55432: run `tests/supabase_stub.sql` against it first). Stop `docker compose` first: its `db` uses the same port, and it keeps its data, so it isn't a clean test database.

```bash
docker run -d --name unicompass-pg-test -e POSTGRES_PASSWORD=test -p 55432:5432 \
  -v "$PWD/tests/supabase_stub.sql:/docker-entrypoint-initdb.d/00_stub.sql:ro" postgres:16
export DIRECT_URL=postgresql://postgres:test@localhost:55432/postgres
alembic upgrade head && python -m scripts.seed
TEST_DATABASE_URL=$DIRECT_URL pytest
```

`tests/supabase_stub.sql` recreates Supabase's `auth` schema and its default grants to `anon`/`authenticated`. That way `tests/test_rls.py` proves the policies really restrict access.

**Frontend**

```bash
cd frontend
npm run lint && npm run typecheck
npm test           # Vitest: *.test.ts in Node, *.test.tsx components in jsdom (Testing Library)
npm run test:e2e   # Playwright; starts the API and Next.js itself, needs the test DB above
```

Put component tests next to the component (`Something.test.tsx`). Playwright writes an HTML report to `frontend/playwright-report/`; open it with `npx playwright show-report`. In CI it's uploaded as an artifact when e2e fails.

## Athens data

`backend/data/athens.json` is the source of truth for areas, universities, campuses, departments and transit hubs. After editing it:

```bash
python -m scripts.seed                   # upsert by slug (safe to re-run); also clears the cache
python -m scripts.compute_travel_times   # real transit times from Google Routes
python -m scripts.compute_nearby         # nearest supermarkets/gyms from OpenStreetMap (no key)
python -m scripts.clear_cache            # drop cached reference data (Upstash) on its own
```

Until the Google script runs, travel times are distance-based estimates, and the UI marks them with `~`. Supermarkets and gyms stay empty until `compute_nearby` runs; re-run it now and then, as shops open and close. Student restaurants are curated in `athens.json` (`student_canteens`). A match shows only the chosen university's own restaurant, and none if that university has none.

**Metro.** `backend/data/metro/athens.json` lists the lines (M1 green, M2 red, M3 blue, stations in order) and every station with its coordinates. It is read straight from the file: no migration or seed step, and `test_metro.py` checks it. Each area gets its nearest station (flagged as "in the area" within 1 km), and the map draws a line as straight segments between its stations. Trips to a campus (`GET /neighborhoods/{slug}/route?campus=<slug>`) are found in `services/routing.py`: walking, metro with line changes (Dijkstra over station/line pairs; about 2.5 min per stop, 4 per change, 3 waiting) and the stored bus estimate. Check the coordinates and line orders against an official map when you edit it.

**Greek.** `backend/data/athens.el.json` holds the Greek names, departments, hubs, area descriptions and pros/cons, in the same order as the English. `seed` loads them into `*_el` columns and English is the fallback where one is missing. Adding a department, pro or con in `athens.json` fails `test_data.py` until its Greek is added.

## Languages

The language is a `locale` cookie (English by default), switched by the header toggle; URLs don't change. UI text lives in `frontend/src/lib/i18n/en.ts` (source of truth) and `el.ts`, which must have the same keys and `{placeholders}` (checked by `i18n.test.ts`). Data text comes from the API with `?lang=el`. The cookie is per host, so `example.com` and `www.example.com` don't share a language or a login: pick one canonical host (Vercel redirects the other) and use it in the Supabase Site URL.

## Database migrations

```bash
cd backend
alembic upgrade head
alembic revision --autogenerate -m "add x"   # after changing app/models
```

Autogenerate only covers tables and columns. Write RLS policies, grants and triggers by hand with `op.execute(...)` (see `0001`). To limit which columns users may update, grant an explicit column list (`grant update (cols)`). A column-level `revoke` doesn't override Supabase's table-level grant (see `0004`).
