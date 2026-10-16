# UniCompass

Helping students who passed the Panhellenic exams move to their new university city.

## Stack

| Layer      | Tech                    | Hosting  |
| ---------- | ----------------------- | -------- |
| Frontend   | Next.js (App Router)    | Vercel   |
| Backend    | FastAPI                 | Render   |
| DB + Auth  | Supabase (Postgres)     | Supabase |
| Payments   | Stripe                  |          |
| Email      | Resend                  |          |
| Cache      | Upstash Redis           |          |

## Structure

```
frontend/              Next.js app (deploy on Vercel, root dir = frontend)
  src/app/             routes: /, /login, /auth/callback, /dashboard, /pricing
  src/lib/supabase/    browser, server and proxy Supabase clients
  src/lib/api/         typed fetch wrapper for the FastAPI backend
  src/proxy.ts         session refresh + protected-route redirects
backend/               FastAPI app (deploy on Render via render.yaml)
  app/core/            settings, Supabase JWT verification
  app/api/v1/          routers: health, users, billing (+ Stripe webhook)
  app/services/        supabase, stripe, resend, upstash clients
  app/schemas/         pydantic models (API)
  app/models/          SQLAlchemy models (DB)
  alembic/             migrations (run against DIRECT_URL)
render.yaml            Render blueprint for the API
```

## Local development

### Frontend
```bash
cd frontend
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000
```

### Backend (Python 3.12)
```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env         # fill in values
fastapi dev app/main.py      # http://localhost:8000/docs
pytest
```

### Google / GitHub sign-in
1. Google Cloud Console → APIs & Services → Credentials → create an OAuth client ID (Web application).
2. Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Sign In / Providers → Google: paste the client ID and secret.
4. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App. Callback URL is the same Supabase URL; paste the client ID/secret into Supabase → Providers → GitHub.
5. Supabase → Authentication → URL Configuration: set the Site URL and add `http://localhost:3000/auth/callback` and your Vercel URL + `/auth/callback` to Redirect URLs.

### Database
Two connection strings from Supabase → **Connect**, both in `backend/.env`:
- `DATABASE_URL`: transaction pooler (`:6543`), used by the running app.
- `DIRECT_URL`: direct connection (`:5432`), used by Alembic. It's IPv6-only unless you have the IPv4 add-on; if it won't connect, use the session pooler URI instead.

```bash
cd backend
alembic upgrade head                              # apply migrations
alembic revision --autogenerate -m "add x"        # after changing app/models
```
Autogenerate only covers tables/columns. RLS policies, grants and triggers go in by hand with `op.execute(...)`.

### Stripe webhooks locally
```bash
stripe listen --forward-to localhost:8000/api/v1/billing/webhook
```

## Auth flow
1. User signs in on the frontend with Supabase (magic link).
2. The frontend sends the Supabase access token as `Authorization: Bearer …` to the backend.
3. The backend verifies the JWT (JWKS, or the legacy HS256 secret) and uses the service-role client for privileged writes.
