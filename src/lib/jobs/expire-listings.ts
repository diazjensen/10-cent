import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import type { JobOptions } from "./types";

const WARN_DAYS = 3;

/**
 * P5: live listings past expires_at become `expired` (poster gets a renew link);
 * listings expiring within 3 days get a one-time warning.
 */
export async function expireListings(opts: JobOptions = {}) {
  const now = (opts.now ?? new Date()).toISOString();
  const details: string[] = [];
  const due = await db.prepare("SELECT id, user_id, title FROM listings WHERE status = 'live' AND expires_at IS NOT NULL AND expires_at <= ?").all(now) as { id: number; user_id: number; title: string }[];
  const expire = db.prepare("UPDATE listings SET status = 'expired', featured = 0, updated_at = ? WHERE id = ? AND status = 'live'");
  const log = db.prepare("INSERT INTO moderation_logs (listing_id, actor_id, action, reason) VALUES (?, NULL, 'expired', ?)");
  let expired = 0;
  for (const l of due) {
    const changed = await db.transaction(async () => {
          const c = (await expire.run(now, l.id)).changes;
          if (c) await log.run(l.id, "Validity period ended");
          return c;
        })();
    if (!changed) continue;
    expired++;
    await notify(l.user_id, {
            kind: "system",
            title: "Your listing has expired",
            body: `“${l.title}” is no longer visible. Renew it in one click to make it live for another 60 days.`,
            link: `/dashboard/listings?renew=${l.id}`,
          }, ["sms", "email"]);
    details.push(`Expired #${l.id} ${l.title}`);
  }

  const warnBy = new Date(new Date(now).getTime() + WARN_DAYS * 86400000).toISOString();
  const soon = await db.prepare("SELECT id, user_id, title, expires_at FROM listings WHERE status = 'live' AND expires_at > ? AND expires_at <= ?").all(now, warnBy) as { id: number; user_id: number; title: string; expires_at: string }[];
  const already = db.prepare("SELECT 1 FROM notifications WHERE user_id = ? AND link = ? AND title LIKE 'Your listing expires%' LIMIT 1");
  let warned = 0;
  for (const l of soon) {
    const link = `/dashboard/listings?renew=${l.id}`;
    if (await already.get(l.user_id, link)) continue;
    const days = Math.max(1, Math.ceil((new Date(l.expires_at).getTime() - new Date(now).getTime()) / 86400000));
    await notify(l.user_id, {
            kind: "system",
            title: `Your listing expires in ${days} day${days > 1 ? "s" : ""}`,
            body: `Renew “${l.title}” now to keep getting enquiries without a gap.`,
            link,
          }, ["sms", "email"]);
    warned++;
    details.push(`Warned #${l.id} (expires ${l.expires_at.slice(0, 10)})`);
  }
  return {
    summary: `${expired} listing${expired === 1 ? "" : "s"} expired, ${warned} expiry warning${warned === 1 ? "" : "s"} sent.`,
    counts: { expired, warned, checked: due.length + soon.length },
    details,
  };
}
