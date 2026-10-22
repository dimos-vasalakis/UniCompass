<p align="center">
  <img src="frontend/public/logo.png" alt="UniCompass" width="96" />
</p>

<h1 align="center">UniCompass</h1>

<p align="center">
  <strong>Moving to a new city for university, minus the guesswork.</strong><br />
  UniCompass helps students who passed the Greek Panhellenic exams choose where to live, check rental listings and settle in.
</p>

<p align="center">
  Web · iOS & Android (in progress) · English & Ελληνικά
</p>

---

## The problem

Every summer, tens of thousands of Greek students learn which university they got into, often in a city they barely know, and have only a few weeks to find a place to live. They pick a neighborhood from hearsay, judge rent without knowing what is normal for the area, find out about the commute after they sign, and run into listing scams aimed at first-time renters who can't visit in person.

## What UniCompass does

**1. Neighborhood match.** The student picks their department and says what matters to them (rent, commute, safety, quiet, nightlife, green space, amenities, student life, distance from home) and sets a budget and a maximum commute. UniCompass ranks the city's neighborhoods and explains its top three picks: why each one fits, what the trade-offs are, and how each area does on every factor.

**2. Area guides.** Each neighborhood has a guide with a map: typical rent, the nearest metro station, nearby supermarkets and gyms, the university's student restaurant (φοιτητική λέσχη), and step-by-step directions to the student's own campus on foot, by metro (with line changes) and by bus.

**3. Listing Check (AI).** Found a flat on Spitogatos or xe.gr? The student uploads screenshots or pastes the ad. UniCompass reads it with Claude and compares the price with what students pay in that area, works out the commute to their campus, flags scam warning signs, and writes a message to the landlord in Greek. All the figures come from UniCompass's own data, not from the model.

**4. Built for Greek students.** The whole product, including the data, works in English and Greek.

## Coverage today

Athens is the first city:

| | |
| --- | --- |
| Neighborhoods profiled | **49** |
| Universities / campuses | **9** / **14** |
| Departments mapped to campuses | **94** |
| Metro lines and stations | **3** lines, **66** stations |
| Ranking factors | **9** |

The city data is structured so a new city (Thessaloniki, Patras, Heraklion…) is mostly a new data file, without changes to the product.

## How it works

- **Transparent matching.** The ranking is a deterministic, explainable model, not a black box: each area's scores are normalized across the city, weighted by the student's own priorities, and filtered by their hard limits. Every result shows the factors that drove it, so students know why an area was recommended.
- **Real travel times.** Commutes come from Google Routes data, and metro routing is computed over the actual line network. Where live data is missing, estimates are clearly marked.
- **AI where it adds value.** The language model reads messy listings and spots red flags. Numbers a student will make a decision on (rent comparisons, commute, nearest metro) always come from verified data.
- **Built to keep costs low.** Each Listing Check is a single model call with prompt caching. A per-account quota is enforced atomically in the database, and a failed check gives the credit back, so retries and double-clicks never cost twice.

## Business model

- **Free:** neighborhood matching, area guides and saved results, so students sign up with no friction.
- **Listing Check:** every account gets 3 AI checks, a metered feature with clear room for paid top-ups.
- **Premium:** one-time Stripe Checkout payment, already integrated end to end (checkout, webhook, account upgrade).

## Product status

| Area | Status |
| --- | --- |
| Web app (match, guides, Listing Check, accounts, payments) | Live |
| English / Greek | Live |
| Mobile app (Expo, iOS & Android) | In development, sharing the same backend |
| More cities | Planned |

## Technology

| Layer | Stack | Hosting |
| --- | --- | --- |
| Web | Next.js 16 (App Router), TypeScript | Vercel |
| Mobile | Expo SDK 58, React Native | EAS |
| API | FastAPI, fully async Python 3.12 | Render |
| Data & auth | Supabase (Postgres with row-level security, Google/GitHub/email sign-in) | Supabase |
| AI | Claude API (structured output, prompt caching) | Anthropic |
| Payments / email / cache | Stripe, Resend, Upstash Redis | Managed |
| Monitoring | Sentry | Managed |

**Engineering quality.** Every push runs the full CI pipeline: linting and type checks, schema migrations tested up and down, backend tests against a real Postgres that mirrors Supabase's permissions (so row-level security is proven, not assumed), frontend unit and component tests, and end-to-end browser tests on desktop and phone. The two languages and the data files are checked against each other in CI, so a missing translation fails the build.

## Quick start

**With Docker** (nothing else to install):

```bash
docker compose up --build    # web http://localhost:3000, API http://localhost:8000/docs
```

This starts Postgres, applies the migrations, loads the Athens data and runs the API and web app. Sign-in is off in this mode (no Supabase Auth); matching, area guides and every public page work.

**Without Docker,** you need Node 20+, Python 3.12, and a Supabase project (or the Docker test database described in [docs/development.md](docs/development.md#tests)).

```bash
# API: http://localhost:8000/docs
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head            # create tables, RLS, grants
python -m scripts.seed          # load the Athens data
fastapi dev app/main.py

# Web: http://localhost:3000
cd frontend
cp .env.example .env.local
npm install
npm run dev

# Mobile: scan the QR code with Expo Go
cd mobile
cp .env.example .env.local
npm install
npx expo start
```

Every setting defaults to empty, so the apps boot without secrets: public pages work without Supabase Auth, the API works without Upstash, and the Listing Check can run on canned answers (`LISTING_CHECK_FAKE=true`).

## Documentation

- **[Setup & deployment](docs/setup.md):** environment variables, Supabase configuration, deploying to Render and Vercel, Stripe webhooks, mobile builds.
- **[Development guide](docs/development.md):** architecture, tests, the Athens data and metro files, translations, database migrations, repository layout.

## Repository layout

```
frontend/   Next.js web app
mobile/     Expo app for iOS and Android
backend/    FastAPI API, Alembic migrations, city data and data scripts
docker-compose.yml  local stack: Postgres + API + web
docs/       setup and development guides
render.yaml Render blueprint
```

## License

[MIT](LICENSE) © 2026 Dimos Vasalakis
