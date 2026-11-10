# Background jobs

Each job is a plain function in this folder, registered in `index.ts` (`JOBS`). `runJob(name)` runs it,
never throws, and writes the result to `audit_logs` as `job.<name>` (actor NULL for the scheduler,
or the staff member who pressed **Run now** at `/admin/jobs`).

## Triggering

`GET` or `POST /api/cron/<job>` — or `/api/cron/all` to run every job in order.

- Production: set `CRON_SECRET` and send it as the `x-cron-secret` header.
- If `CRON_SECRET` is unset (local dev only), requests from localhost or a signed-in super admin are accepted.
  In production without the secret, only a super admin session works.
- `?force=1` ignores per-item frequency windows (saved searches) and the last-run cut-off (requirements).

```bash
curl -fsS -H "x-cron-secret: $CRON_SECRET" https://10cent.in/api/cron/expire-listings
```

## Schedule

| Job | Cron (UTC) | When | What it does |
| --- | --- | --- | --- |
| `expire-listings` | `5 * * * *` | hourly | Live listings past `expires_at` → `expired`, moderation log + SMS/email with renew link (`/dashboard/listings?renew=<id>`). Listings expiring within 3 days get a single warning. |
| `saved-search-alerts` | `*/15 * * * *` | every 15 min | For each saved search that is due (`instant` every run, `daily` ≥ 23 h, `weekly` ≥ 7 d since `last_checked_at`), runs `searchListings(Object.fromEntries(new URLSearchParams(query)))` and alerts on live listings published after `last_checked_at`: in-app notification + outbox on the search's channels (respecting the user's notification prefs). Updates `last_checked_at`. |
| `requirement-matches` | `20 * * * *` | hourly | Listings published since the previous successful run are matched against active `requirements` (transaction, city, type, BHK, budget ±10%, preferred localities); the requirement owner gets one notification per run (SMS + email). |
| `subscription-expiry` | `0 20 * * *` | daily 01:30 IST | Active subscriptions past `ends_at` → `expired`; listing `boost` is reduced to the best plan still active; reminder 3 days before the end. |

Example crontab (or the equivalent in Vercel Cron / GitHub Actions / Cloud Scheduler):

```cron
5 * * * *     curl -fsS -H "x-cron-secret: $CRON_SECRET" https://10cent.in/api/cron/expire-listings
*/15 * * * *  curl -fsS -H "x-cron-secret: $CRON_SECRET" https://10cent.in/api/cron/saved-search-alerts
20 * * * *    curl -fsS -H "x-cron-secret: $CRON_SECRET" https://10cent.in/api/cron/requirement-matches
0 20 * * *    curl -fsS -H "x-cron-secret: $CRON_SECRET" https://10cent.in/api/cron/subscription-expiry
```

All jobs are idempotent: re-running immediately does no extra work (warnings are de-duplicated via existing notifications).
Messages go to the `outbox` table; a provider worker (MSG91 / SES / WhatsApp Cloud API / FCM) drains it once keys are configured.
