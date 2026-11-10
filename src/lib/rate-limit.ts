import "server-only";
import { db } from "./db";

/**
 * Fixed-window rate limiter backed by SQLite (PRD §4.4, §6.1).
 * Returns { ok, remaining, retryAfterSec }.
 */
export function rateLimit(key: string, limit: number, windowSec: number) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  const row = db.prepare("SELECT window_start, count FROM rate_limits WHERE key = ?").get(key) as
    | { window_start: number; count: number }
    | undefined;
  if (!row || row.window_start !== windowStart) {
    db.prepare(
      "INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1"
    ).run(key, windowStart);
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (row.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: windowStart + windowSec - now };
  }
  db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").run(key);
  return { ok: true, remaining: limit - row.count - 1, retryAfterSec: 0 };
}
