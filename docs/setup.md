# Setup & deployment

How to configure, run and deploy UniCompass. For the codebase itself see [development.md](development.md).

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
| `ANTHROPIC_API_KEY`                      | Claude API key for the listing check. Empty: `/assistant` answers 503 "Assistant unavailable" (the rest of the site works) |
| `ANTHROPIC_MODEL`                        | Optional, default `claude-haiku-5-5` (cheapest). `claude-sonnet-5-5` reads screenshots better at about 20× the price |
| `LISTING_CHECK_LIMIT`                    | Optional, default `3`: checks per account, ever                               |
| `LISTING_CHECK_FAKE`                     | Optional, `true` for canned answers in local dev without a key (ignored when `ENVIRONMENT=production`) |

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
4. **Authentication → Emails → Templates.** In both **Confirm signup** and **Magic link**, change the link to:
   ```html
   <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">…</a>
   ```
   Also show `{{ .Token }}`, the code people can type on the "check your email" screen when they open the email on another device (the link signs in whichever browser opens it). The default `{{ .ConfirmationURL }}` uses PKCE, which only completes in the browser that requested the link. Opening it from a mail app, a phone or another browser fails with "invalid or expired link". `/auth/callback` verifies `token_hash` links in any browser. `{{ .RedirectTo }}` is the site's `/auth/callback?next=…` URL, so local sign-ups come back to localhost.
5. **Don't edit tables, RLS or grants in the dashboard.** The Alembic migrations own the schema.

## Deployment

**Backend (Render).** Create the service from `render.yaml` (New → Blueprint), or by hand:
- Root directory `backend`, build command `pip install -r requirements.txt`.
- Start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Health check `/api/v1/health`.

Fill in the environment variables above. Run `alembic upgrade head`, `python -m scripts.seed` and `python -m scripts.compute_nearby` against the production database from your machine. Do this on every deploy that adds a migration: the seed fills the Greek (`*_el`) columns, and a database that is migrated but not re-seeded silently shows English. The free plan sleeps after about 15 minutes idle, so the first request after that takes around 50 seconds.

**Listing check.** Set `ANTHROPIC_API_KEY` on Render. Each check is one Claude call, paid by your key; the 3-per-account limit is kept in `profiles.listing_checks_used` (migrations `0009`–`0010`) and only the backend can change it. A check that fails on Claude's side is given back. Screenshots are sent to Claude and never stored.

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

## Mobile builds

`mobile/` is a standalone Expo app (not an npm workspace) that talks to the same backend and Supabase project. Auth uses `supabase-js` with PKCE: Google/GitHub open a browser session and return through the `unicompass://auth/callback` deep link, and the magic link comes back the same way. `src/lib/api.ts` mirrors the web `apiFetch` (Bearer token). The UI is React Native, so screens are built separately from the web components.

```bash
cd mobile
npx expo start         # dev server; Expo Go on a phone
npm run lint && npm run typecheck
npx eas-cli@latest build --profile preview   # installable internal build (needs `eas login`)
```

Build profiles are in `mobile/eas.json`; the EAS project ID is in `mobile/app.json`. Store releases need an Apple Developer account and a Google Play Console account. Premium payments are not wired into the app yet (Apple/Google require in-app purchase for digital goods), so premium stays web-only for now.
