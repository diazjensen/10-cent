import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { formatPrice, formatRent } from "@/lib/format";
import type { JobOptions } from "./types";

/** When this job last completed, from the audit trail (jobs log every run there). */
async function lastRun(): Promise<string | null> {
  const r = await db.prepare("SELECT details FROM audit_logs WHERE action = 'job.requirement-matches' ORDER BY id DESC LIMIT 1").get() as { details: string | null } | undefined;
  if (!r?.details) return null;
  try { return (JSON.parse(r.details) as { ok?: boolean; startedAt?: string }).ok ? JSON.parse(r.details).startedAt : null; } catch { return null; }
}

/**
 * Post-requirement matching: live listings published since the previous run are matched against every
 * active requirement (transaction, city, type, BHK, budget, preferred localities). The person who posted
 * the requirement gets one notification per run listing the matches.
 */
export async function requirementMatches(opts: JobOptions = {}) {
  const now = opts.now ?? new Date();
  const since = (opts.force ? null : await lastRun()) ?? new Date(now.getTime() - 86400000).toISOString();
  const reqs = await db.prepare(`SELECT r.*, c.slug city_slug FROM requirements r JOIN users u ON u.id = r.user_id JOIN cities c ON c.id = r.city_id
    WHERE r.active = 1 AND u.blocked = 0 AND u.deleted_at IS NULL`).all() as {
    id: number; user_id: number; transaction_type: string; city_id: number; locality_ids: string | null; property_type: string | null; bhk: number | null;
    budget_min: number | null; budget_max: number | null; city_slug: string;
  }[];
  const details: string[] = [];
  let matchedReqs = 0, matchedListings = 0;
  const notified = db.prepare("SELECT 1 FROM notifications WHERE user_id = ? AND link = ? AND kind = 'alert' LIMIT 1");

  for (const r of reqs) {
    const where = ["l.status = 'live'", "l.published_at > ?", "l.transaction_type = ?", "l.city_id = ?", "l.user_id <> ?"];
    const args: unknown[] = [since, r.transaction_type, r.city_id, r.user_id];
    if (r.property_type) { where.push("l.property_type = ?"); args.push(r.property_type); }
    if (r.bhk) { if (r.bhk >= 5) where.push("l.bhk >= 5"); else { where.push("l.bhk = ?"); args.push(r.bhk); } }
    if (r.budget_min) { where.push("l.price >= ?"); args.push(Math.round(r.budget_min * 0.9)); }
    if (r.budget_max) { where.push("l.price <= ?"); args.push(Math.round(r.budget_max * 1.1)); }
    const locs = (r.locality_ids ?? "").split(",").map(Number).filter(Boolean);
    if (locs.length) { where.push(`l.locality_id IN (${locs.map(() => "?").join(",")})`); args.push(...locs); }
    const rows = await db.prepare(`SELECT l.id, l.title, l.price, l.transaction_type FROM listings l WHERE ${where.join(" AND ")} ORDER BY l.published_at DESC LIMIT 20`).all(...args) as { id: number; title: string; price: number; transaction_type: string }[];
    const fresh: typeof rows = [];
    for (const l of rows) if (!(await notified.get(r.user_id, `/property/${l.id}`))) fresh.push(l);
    if (!fresh.length) continue;
    matchedReqs++;
    matchedListings += fresh.length;
    const first = fresh[0];
    const price = (l: typeof first) => (l.transaction_type === "sell" ? formatPrice(l.price) : formatRent(l.price));
    await notify(r.user_id, {
            kind: "alert",
            title: fresh.length === 1 ? "A new listing matches your requirement" : `${fresh.length} new listings match your requirement`,
            body: fresh.slice(0, 3).map((l) => `${l.title} (${price(l)})`).join("; "),
            link: fresh.length === 1 ? `/property/${first.id}` : `/search?city=${r.city_slug}&tx=${r.transaction_type}${r.property_type ? `&type=${r.property_type}` : ""}${r.bhk ? `&bhk=${r.bhk}` : ""}${r.budget_max ? `&max=${r.budget_max}` : ""}${locs.length ? `&loc=${locs.join(",")}` : ""}&sort=newest`,
          }, ["sms", "email"]);
    details.push(`Requirement #${r.id}: ${fresh.length} match${fresh.length > 1 ? "es" : ""} (${fresh.map((l) => `#${l.id}`).join(", ")})`);
  }
  return {
    summary: `${reqs.length} active requirement${reqs.length === 1 ? "" : "s"} checked against listings published since ${since.slice(0, 16).replace("T", " ")} UTC; ${matchedReqs} notified about ${matchedListings} listing${matchedListings === 1 ? "" : "s"}.`,
    counts: { requirements: reqs.length, notified: matchedReqs, listings: matchedListings },
    details,
  };
}
