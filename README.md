# UniCompass

Helps students who passed the Panhellenic exams settle into their new university city. A student picks their department and priorities (rent, commute, nightlife, safety…) and gets the three Athens neighborhoods that fit them best, with guides for each area.

| Layer     | Tech                         | Hosting  |
| --------- | ---------------------------- | -------- |
| Frontend  | Next.js 16 (App Router)      | Vercel   |
| Backend   | FastAPI (async, Python 3.12) | Render   |
| DB + Auth | Supabase (Postgres)          | Supabase |
| Payments  | Stripe (one-time Checkout)   |          |
| Email     | Resend                       |          |
| Cache     | Upstash Redis                |          |

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
```

Everything defaults to empty, so both apps boot without secrets. Public pages work without Supabase Auth, and the API works without Upstash. Endpoints that need the database return `503 Database unavailable` until `DATABASE_URL` is set.

## Configuration

### Environment variables

**`frontend/.env.local`** (on Vercel: Project → Settings → Environment Variables)

| Variable                             | Value                                                                 |
| ------------------------------------ | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | Supabase → Settings → API                                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Supabase → Settings → API                                             |
| `NEXT_PUBLIC_API_URL`                | Backend origin, no `/api/v1` and no trailing slash (e.g. `https://<service>.onrender.com`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys                                        |

`NEXT_PUBLIC_*` values are baked in at build time, so **redeploy on Vercel after changing them**.

**`backend/.env`** (on Render: service → Environment)

| Variable                                 | Value                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `ENVIRONMENT`                            | `development` locally, `production` on Render (turns off `/docs`)           |
| `FRONTEND_URL`, `CORS_ORIGINS`           | Your site's URL, e.g. `["https://your-app.vercel.app"]`                     |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API                                                |
| `SUPABASE_JWT_SECRET`                    | Leave empty (tokens are checked with JWKS); only legacy HS256 projects need it |
| `DATABASE_URL`                           | Supabase → Connect → **transaction pooler** (`:6543`), used by the app       |
| `DIRECT_URL`                             | Supabase → Connect → **direct** (`:5432`), used only by Alembic              |
| `STRIPE_*`                               | Secret key, webhook signing secret, price ID of the premium product          |
| `RESEND_API_KEY`, `EMAIL_FROM`           | Resend                                                                       |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN`      | Upstash (optional)                                                           |
| `GOOGLE_MAPS_API_KEY`                    | Only for `scripts/compute_travel_times.py`                                   |

Database URL gotchas:
- Paste the URIs exactly as Supabase shows them (`postgresql://…`). The app switches them to the psycopg driver itself. **Don't add `+asyncpg`**: it isn't installed, and every DB endpoint will return 500.
- The direct connection is IPv6-only unless you buy Supabase's IPv4 add-on. If Alembic can't connect, use the **session pooler** URI (pooler host, port `5432`) as `DIRECT_URL`.
- Stick to letters and digits in the database password. Characters like `@ # / ?` would need URL-encoding.

### Supabase dashboard

1. **Authentication → URL Configuration.** Set the Site URL to your production URL. Add `http://localhost:3000/auth/callback` and `https://<your-site>/auth/callback` to Redirect URLs.
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

Fill in the environment variables above. Run `alembic upgrade head` and `python -m scripts.seed` against the production database from your machine. The free plan sleeps after about 15 minutes idle, so the first request after that takes around 50 seconds.

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

## Tests

CI (`.github/workflows/ci.yml`) runs everything on each push to `main` and on each PR: backend lint, migrations, seed and pytest; frontend lint, typecheck, Vitest and build; then Playwright end-to-end tests on desktop and phone.

**Backend**

```bash
cd backend
ruff check . && ruff format .
pytest                      # unit tests; DB tests skip without a test database
```

DB tests (API, RLS/grants, seed, Stripe webhook) need a migrated, seeded Postgres. A throwaway one in Docker:

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
python -m scripts.seed                   # upsert by slug (safe to re-run)
python -m scripts.compute_travel_times   # real transit times from Google Routes
```

Until the Google script runs, travel times are distance-based estimates, and the UI marks them with `~`.

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
4. **Caching.** Reference data (areas, universities, hubs) is cached in Upstash for 6 hours, and profiles for 5 minutes.

```
frontend/                 Next.js app
  src/app/                routes: /, /match, /neighborhoods, /login, /signup, /auth/callback, /dashboard, /pricing
  src/components/         shared UI (AuthForm, maps, score bars, …)
  src/lib/supabase/       browser, server and proxy Supabase clients
  src/lib/api/            fetch helpers for the backend
  src/proxy.ts            session refresh + protected routes
  e2e/                    Playwright tests
backend/                  FastAPI app
  app/api/v1/endpoints/   health, users, billing (+ Stripe webhook), places, match
  app/core/               settings, DB engine, JWT verification
  app/services/           matching (pure), places, billing, cache, email
  app/models/, schemas/   SQLAlchemy models, Pydantic API models
  alembic/                migrations
  data/athens.json        area/university/hub data
  scripts/                seed, compute_travel_times
render.yaml               Render blueprint
```
