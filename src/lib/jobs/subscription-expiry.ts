import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import type { JobOptions } from "./types";

const WARN_DAYS = 3;

/**
 * O4: active subscriptions past ends_at become `expired`; the plan's search boost is removed from the
 * user's listings (keeping the boost of any other plan still active). Users get a renewal warning 3 days before.
 */
export async function subscriptionExpiry(opts: JobOptions = {}) {
  const now = (opts.now ?? new Date()).toISOString();
  const details: string[] = [];
  const due = await db.prepare(`SELECT s.id, s.user_id, p.name FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.status = 'active' AND s.ends_at <= ?`).all(now) as { id: number; user_id: number; name: string }[];
  let expired = 0;
  for (const s of due) {
    const changed = await db.transaction(async () => {
          const c = (await db.prepare("UPDATE subscriptions SET status = 'expired' WHERE id = ? AND status = 'active'").run(s.id)).changes;
          if (!c) return 0;
          const keep = await db.prepare("SELECT MAX(p.boost) b FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = ? AND s.status = 'active' AND s.ends_at > ?").get(s.user_id, now) as { b: number | null };
          await db.prepare("UPDATE listings SET boost = ? WHERE user_id = ? AND boost > ?").run(keep.b ?? 0, s.user_id, keep.b ?? 0);
          return c;
        })();
    if (!changed) continue;
    expired++;
    await notify(s.user_id, { kind: "billing", title: `Your ${s.name} plan has ended`, body: "Your listings no longer get the plan's search boost. Renew to keep your placement.", link: "/plans" }, ["sms", "email"]);
    details.push(`Expired subscription #${s.id} (${s.name}) for user #${s.user_id}`);
  }

  const warnBy = new Date(new Date(now).getTime() + WARN_DAYS * 86400000).toISOString();
  const soon = await db.prepare(`SELECT s.id, s.user_id, s.ends_at, p.name FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.status = 'active' AND s.ends_at > ? AND s.ends_at <= ?`).all(now, warnBy) as { id: number; user_id: number; ends_at: string; name: string }[];
  const already = db.prepare("SELECT 1 FROM notifications WHERE user_id = ? AND link = ? LIMIT 1");
  let warned = 0;
  for (const s of soon) {
    const link = `/plans?renew=${s.id}`;
    if (await already.get(s.user_id, link)) continue;
    const days = Math.max(1, Math.ceil((new Date(s.ends_at).getTime() - new Date(now).getTime()) / 86400000));
    await notify(s.user_id, { kind: "billing", title: `Your ${s.name} plan ends in ${days} day${days > 1 ? "s" : ""}`, body: "Renew now to keep your boost and listing limit without a break.", link }, ["email"]);
    warned++;
    details.push(`Warned subscription #${s.id} (ends ${s.ends_at.slice(0, 10)})`);
  }
  return {
    summary: `${expired} subscription${expired === 1 ? "" : "s"} expired, ${warned} renewal reminder${warned === 1 ? "" : "s"} sent.`,
    counts: { expired, warned },
    details,
  };
}
