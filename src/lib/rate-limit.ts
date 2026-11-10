import "server-only";
import { db } from "./db";

/**
 * Fixed-window rate limiter backed by SQLite (PRD §4.4, §6.1).
 * Returns { ok, remaining, retryAfterSec }.
 */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  // Single atomic upsert: parallel requests can't lose increments or both pass the limit check.
  const row = await db.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`
  ).get(key, windowStart) as { count: number };
  if (row.count > limit) return { ok: false, remaining: 0, retryAfterSec: windowStart + windowSec - now };
  return { ok: true, remaining: limit - row.count, retryAfterSec: 0 };
}
