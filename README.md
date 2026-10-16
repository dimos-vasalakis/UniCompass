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
  app/schemas/         pydantic models
supabase/migrations/   SQL schema (profiles, cities, universities, RLS)
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
pip install -r requirements-dev.txt
cp .env.example .env         # fill in values
fastapi dev app/main.py      # http://localhost:8000/docs
pytest
```

### Database
Apply `supabase/migrations/*.sql` with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

### Stripe webhooks locally
```bash
stripe listen --forward-to localhost:8000/api/v1/billing/webhook
```

## Auth flow
1. User signs in on the frontend with Supabase (magic link).
2. The frontend sends the Supabase access token as `Authorization: Bearer …` to the backend.
3. The backend verifies the JWT (JWKS, or the legacy HS256 secret) and uses the service-role client for privileged writes.
