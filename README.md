# 10cent

A property marketplace for India: buy, rent, PG/co-living, commercial, plots and new projects. Built from the 10cent PRD (Nov 2026).

**Stack:** Next.js 16 (App Router, server actions) · TypeScript · Tailwind v4 · PostgreSQL on Supabase (`pg`) · Leaflet maps.

## Run it

```bash
npm install
cp .env.example .env.local   # then set DATABASE_URL (Supabase: Connect -> Transaction pooler)
npm run migrate              # creates the tables from db/schema.sql (safe to re-run)
npm run seed                 # EMPTIES the tables, then loads demo data
npm run dev                  # http://localhost:3000
```

The Supabase project already has the schema applied (38 tables, Row Level Security on, no public policies: the app talks to the
database from the server only, so the Supabase anon/public API cannot read or write anything). `npm run seed` only needs to be run once,
to load the demo data.

Production: `npm run build && npm start` (set `INSECURE_COOKIES=1` if you test `npm start` over plain http).

To test against a local Postgres instead of Supabase, point `DATABASE_URL` at it (e.g. `postgresql://postgres@localhost:5432/tencent`) and run the same commands.

**Uploads:** photos, floor plans, videos and PDFs are stored in the `media_files` table (not on disk), so they work on serverless hosts like Vercel. Photos are shrunk in the browser and re-encoded with `sharp` (max 2000 px); videos and PDFs are limited to 4 MB by the platform's request-size cap. For large videos, move uploads to Supabase Storage.

**Data notes:** timestamps are stored as ISO-8601 UTC text and flags as 0/1 integers (kept from the first version so every query behaves the same);
money is BIGINT rupees (or `*_paise`). `src/lib/pg.ts` is the data layer (`await db.prepare(sql).get/all/run`, `await db.transaction(...)`).

### Demo logins

Log in at `/login` with a phone number. Until an SMS provider is configured, the OTP is shown on screen.

| Role | Phone |
| --- | --- |
| Super admin | 9000000001 |
| Moderator · Support · Sales · Content | 9000000002 · 03 · 04 · 05 |
| Owner | 9876543210 |
| Agent | 9876543211 |
| Builder | 9876543212 |
| Seeker | 9876543213 |

## What's in it (PRD mapping)

| Area | Routes |
| --- | --- |
| Home, navigation (H1–H5) | `/`, header city picker with location detect, SEO footer, `/property-in-<city>` |
| Search (S1–S9) | `/search` (filters, sort, list/map, draw area, nearby, save search), `/api/suggest` |
| Property detail (D1–D9) | `/property/[id]`, `/compare` |
| Accounts (A1–A5) | `/login` (phone/email OTP, Google), `/account/*`, `/requirement`, data export and deletion |
| Post property (P1–P7) | `/post-property` (7 steps, uploads, auto checks), `/dashboard/bulk` |
| Dashboards (O1–O6) | `/dashboard`, listings, responses, insights, billing, profile |
| Builders (B1–B7) | `/projects`, `/projects/[slug]`, `/builders/[id]`, `/dashboard/projects`, `/dashboard/leads` (CSV and signed webhook) |
| Billing (§7, O4) | `/plans`, `/checkout/[plan]`, test gateway, GST invoices `/invoices/[id]` |
| Tools (T1–T8) | `/tools/*`, `/localities/[city]/[slug]` |
| Content, services | `/news`, `/services/home-loan`, `/about` `/terms` `/privacy` `/posting-policy` |
| Admin (AD1–AD9) | `/admin` (role-based), moderation, verification, users, fraud, billing, projects/banners, CMS, analytics, audit, outbox, jobs |
| Jobs | `/api/cron/{expire-listings,saved-search-alerts,requirement-matches,subscription-expiry,all}` (see `src/lib/jobs/README.md`) |

## Running in test mode

- **OTP / SMS / email / WhatsApp:** messages are written to the `outbox` table (visible at `/admin/outbox`); OTPs are shown on screen.
- **Payments:** checkout uses a clearly labelled test gateway (succeed or fail).
- **Google sign-in:** disabled until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
- **Seed images:** generated SVG illustrations (`/api/art/...`). Real uploads are stored in `data/uploads`.
- **Plan prices, bank rates, stamp-duty tables:** placeholders or indicative; review before launch.

Copy `.env.example` to `.env.local` and fill in what you have.

## Code map

- `src/lib/` holds shared foundations: `db.ts` and `schema.ts` (the data model from PRD §6.3), `auth.ts` (OTP, sessions, admin RBAC), `listings.ts` (search query builder), `notify.ts`, `uploads.ts`, `rate-limit.ts`.
- Area code lives in `src/lib/{seeker,supply,admin,jobs,tools,content}` and `src/components/{search,property,supply,admin,tools,content,account}`.
- `scripts/seed.ts` builds the demo data.

## Before production

- Move from SQLite to PostgreSQL + PostGIS and Elasticsearch/OpenSearch, per PRD §6.2 (queries are plain SQL, which keeps the port simple).
- Connect real providers (SMS/WhatsApp, email, push, Razorpay) by draining the `outbox` table / replacing the test gateway.
- Schedule the cron jobs with `CRON_SECRET`.
- Store media in object storage behind a CDN instead of `data/uploads`.
