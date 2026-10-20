# UniCompass

Helps students who passed the Panhellenic exams settle into their new university city. A student picks their department and priorities (rent, commute, nightlife, safety…) and gets the three Athens neighborhoods that fit them best, with guides for each area, plus nearby supermarkets, gyms, the nearest metro station and the student restaurant (φοιτητική λέσχη) of their own university. Each guide also explains how to get to the campus: on foot, by metro (with line changes) and by bus. The site is available in English and Greek.

| Layer     | Tech                         | Hosting  |
| --------- | ---------------------------- | -------- |
| Frontend  | Next.js 16 (App Router)      | Vercel   |
| Mobile    | Expo SDK 58 (Expo Router)    | EAS      |
| Backend   | FastAPI (async, Python 3.12) | Render   |
| DB + Auth | Supabase (Postgres)          | Supabase |
| Payments  | Stripe (one-time Checkout)   |          |
| Email     | Resend                       |          |
| Cache     | Upstash Redis                |          |
| Errors    | Sentry (optional)            |          |

## Quick start

You need Node 20+, Python 3.12, and a Supabase project (or the Docker test DB below).

```bash
# Backend: http://localhost:8000/docs
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # see "Configuration"
alembic upgrade head            # create tables, RLS, grants
python -m scripts.seed          # load the Athens data
fastapi dev app/main.py

# Frontend: http://localhost:3000
cd frontend
cp .env.example .env.local
npm install
npm run dev

# Mobile: Expo (scan the QR code with Expo Go)
cd mobile
cp .env.example .env.local   # Supabase URL + anon key; API URL must be reachable from the phone
npm install
npx expo start
```

Everything defaults to empty, so the web apps boot without secrets. Public pages work without Supabase Auth, and the API works without Upstash. Endpoints that need the database return `503 Database unavailable` until `DATABASE_URL` is set.

## Configuration

### Environment variables

**`frontend/.env.local`** (on Vercel: Project → Settings → Environment Variables)

| Variable                             | Value                                                                 |
| ------------------------------------ | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | Supabase → Settings → API                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Supabase → Settings → API                                             |
| `NEXT_PUBLIC_API_URL`                | Backend origin, no `/api/v1` and no trailing slash (e.g. `https://<service>.onrender.com`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys                                        |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` | Sentry (optional; errors are not reported when empty)               |
| `SENTRY_AUTH_TOKEN`                  | Build-time only, for source map upload. Set it in Vercel, never commit |

`NEXT_PUBLIC_*` values are baked in at build time, so **redeploy on Vercel after changing them**.

**`backend/.env`** (on Render: service → Environment)

| Variable                                 | Value                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `ENVIRONMENT`                            | `development` locally, `production` on Render (turns off `/docs`)           |
| `FRONTEND_URL`, `CORS_ORIGINS`           | Your site's URL, e.g. `FRONTEND_URL=https://www.example.com`, `CORS_ORIGINS=["https://www.example.com","https://example.com"]`. List every host the site is served from: a missing one makes the browser block API calls ("Something went wrong finding areas") |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API                                                |
| `SUPABASE_JWT_SECRET`                    | Leave empty (tokens are checked with JWKS); only legacy HS256 projects need it |
| `DATABASE_URL`                           | Supabase → Connect → **transaction pooler** (`:6543`), used by the app       |
| `DIRECT_URL`                             | Supabase → Connect → **direct** (`:5432`), used only by Alembic              |
| `STRIPE_*`                               | Secret key, webhook signing secret, price ID of the premium product          |
| `RESEND_API_KEY`, `EMAIL_FROM`           | Resend                                                                       |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN`      | Upstash (optional)                                                           |
| `SENTRY_DSN`                             | Sentry (optional)                                                            |
| `GOOGLE_MAPS_API_KEY`                    | Only for `scripts/compute_travel_times.py`                                   |

Database URL gotchas:
- Paste the URIs exactly as Supabase shows them (`postgresql://…`). The app switches them to the psycopg driver itself. **Don't add `+asyncpg`**: it isn't installed, and every DB endpoint will return 500.
- The direct connection is IPv6-only unless you buy Supabase's IPv4 add-on. If Alembic can't connect, use the **session pooler** URI (pooler host, port `5432`) as `DIRECT_URL`.
- Stick to letters and digits in the database password. Characters like `@ # / ?` would need URL-encoding.

**`mobile/.env.local`** (not committed; Expo only exposes `EXPO_PUBLIC_*`)

| Variable | Notes |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | same project as the frontend |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | same anon key as the frontend |
| `EXPO_PUBLIC_API_URL` | backend URL; use your Render URL on a real phone, since `localhost` isn't reachable from it |

### Supabase dashboard

1. **Authentication → URL Configuration.** Set the Site URL to your production URL. Add `http://localhost:3000/auth/callback` and `https://<your-site>/auth/callback` to Redirect URLs. For the mobile app also add `unicompass://auth/callback` (and `exp://**` while testing in Expo Go).
2. **Authentication → Sign In / Providers.**
   - Email: on, with "Allow new users to sign up" enabled. `/signup` creates accounts through the magic link.
   - Google: create an OAuth client in Google Cloud Console → APIs & Services → Credentials (Web application).
     - **Authorized redirect URI:** Supabase's callback, `https://<project>.supabase.co/auth/v1/callback`, not your site's.
     - **Authorized JavaScript origins:** your site's URL and `http://localhost:3000`.
     - Paste the client ID and secret into Supabase.
   - GitHub: GitHub → Settings → Developer settings → OAuth Apps. Use the same Supabase callback URL, then paste the ID and secret into Supabase.
3. **Authentication → Emails → SMTP.** Supabase's built-in sender is for testing only and sends just a few emails per hour. For real use, point it at Resend:
   - Host `smtp.resend.com`, port `465`.
   - Username `resend`, password your Resend API key.
   - Verify your domain in Resend first.
4. **Don't edit tables, RLS or grants in the dashboard.** The Alembic migrations own the schema.

## Deployment

**Backend (Render).** Create the service from `render.yaml` (New → Blueprint), or by hand:
- Root directory `backend`, build command `pip install -r requirements.txt`.
- Start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Health check `/api/v1/health`.

Fill in the environment variables above. Run `alembic upgrade head`, `python -m scripts.seed` and `python -m scripts.compute_nearby` against the production database from your machine. Do this on every deploy that adds a migration: the seed fills the Greek (`*_el`) columns, and a database that is migrated but not re-seeded silently shows English. The free plan sleeps after about 15 minutes idle, so the first request after that takes around 50 seconds.

**Frontend (Vercel).** Import the repo with root directory `frontend` and set the environment variables.

**Checking a deploy:**
- `GET <api>/api/v1/health` → `{"status":"ok"}` means the server is up.
- `GET <api>/api/v1/neighborhoods` → a list of areas means the database is migrated and seeded.
- If the site says "We can't load the area data", check Vercel → Logs for an `[api] …` line:
  - `fetch failed`: wrong `NEXT_PUBLIC_API_URL`, or Render is down.
  - `503`: the database isn't reachable.
  - `500`: check Render's logs.

**Stripe webhook.** Add an endpoint at `<api>/api/v1/billing/webhook` for `checkout.session.completed`, then copy its signing secret into `STRIPE_WEBHOOK_SECRET`. Locally:

```bash
stripe listen --forward-to localhost:8000/api/v1/billing/webhook
```

## Mobile app

`mobile/` is a standalone Expo app (not an npm workspace) that talks to the same backend and Supabase project. Auth uses `supabase-js` with PKCE: Google/GitHub open a browser session and return through the `unicompass://auth/callback` deep link, and the magic link comes back the same way. `src/lib/api.ts` mirrors the web `apiFetch` (Bearer token). The UI is React Native, so screens are built separately from the web components.

```bash
cd mobile
npx expo start         # dev server; Expo Go on a phone
npm run lint && npm run typecheck
npx eas-cli@latest build --profile preview   # installable internal build (needs `eas login`)
```

Build profiles are in `mobile/eas.json`; the EAS project ID is in `mobile/app.json`. Store releases need an Apple Developer account and a Google Play Console account. Premium payments are not wired into the app yet (Apple/Google require in-app purchase for digital goods), so premium stays web-only for now.

## Tests

CI (`.github/workflows/ci.yml`) runs everything on each push to `main` and on each PR: backend lint, migrations, seed and pytest; mobile lint and typecheck; frontend lint, typecheck, Vitest and build; then Playwright end-to-end tests on desktop and phone.

**Backend**

```bash
cd backend
ruff check . && ruff format .
pytest                      # unit tests; DB tests skip without a test database
```

DB tests (API, RLS/grants, seed, Stripe webhook) need a migrated, seeded Postgres. A throwaway one in Docker (or any local Postgres 16 on port 55432: run `tests/supabase_stub.sql` against it first):

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

## How it fits together

1. **Sign-in.** Users sign in on the frontend through Supabase Auth: Google, GitHub or an email magic link. `/auth/callback` swaps the code for a session cookie, and `src/proxy.ts` refreshes it and protects `/dashboard`.
2. **API calls.** The frontend sends the Supabase access token to the backend as `Authorization: Bearer …`. The backend verifies it with Supabase's JWKS (or the legacy HS256 secret).
3. **Database access.** The backend talks to Postgres directly with async SQLAlchemy through the pooler. That connection bypasses RLS, so every query filters by the user's id itself. Users can edit only `full_name`/`role` of their own profile through Supabase directly; billing fields like `is_premium` are written only by the backend's Stripe webhook.
4. **Caching.** Reference data (areas, universities, hubs, canteens, campus routes) is cached in Upstash for 6 hours, keyed by language, and profiles for 5 minutes. Nearby supermarkets and gyms are never cached. Reseeding clears the cache.
5. **Map.** `src/components/MatchMap.tsx` builds the Leaflet map imperatively in one effect (react-leaflet's `MapContainer` crashed when React re-ran effects). It is used on the match results and on every area page. Pins: numbered areas, campus, hub, supermarkets, gyms, canteens and the nearest metro station (Μ); tapping a station draws its lines. Supermarkets and gyms show no walking times, because the student's home isn't known. On match results the view fits only the areas, campus and hub; an area page fits every pin. "Full guide" links carry `?campus=<slug>`, which adds the route section (`RouteGuide.tsx`) to the area page.

```
frontend/                 Next.js app
  src/app/                routes: /, /match, /neighborhoods, /login, /signup, /auth/callback, /dashboard, /pricing
  src/components/         shared UI (AuthForm, MatchMap, MetroCard, RouteGuide, score bars, language toggle, …)
  src/lib/i18n/           English/Greek dictionaries and locale helpers
  src/lib/supabase/       browser, server and proxy Supabase clients
  src/lib/api/            fetch helpers for the backend
  src/proxy.ts            session refresh + protected routes
  e2e/                    Playwright tests
mobile/                    Expo app (src/app routes, src/lib Supabase + API client)
backend/                  FastAPI app
  app/api/v1/endpoints/   health, users, billing (+ Stripe webhook), places, match
  app/core/               settings, DB engine, JWT verification
  app/services/           matching, metro, routing (pure), places, billing, cache, email
  app/models/, schemas/   SQLAlchemy models, Pydantic API models
  alembic/                migrations
  data/athens.json        area/university/hub/canteen data (athens.el.json: Greek text)
  data/metro/athens.json  metro lines and stations
  scripts/                seed, compute_travel_times, compute_nearby, clear_cache
render.yaml               Render blueprint
```
