import "server-only";
import { db, nowIso } from "@/lib/db";
import { notify } from "@/lib/notify";
import { searchListings, type SearchFilters } from "@/lib/listings";
import { formatPrice, formatRent } from "@/lib/format";
import type { JobOptions } from "./types";

const WINDOW_H: Record<string, number> = { instant: 0, daily: 23, weekly: 24 * 7 - 1 };
const CHANNELS = ["sms", "email", "whatsapp", "push"] as const;
type Channel = (typeof CHANNELS)[number];

/**
 * S8: for every saved search that is due (by its frequency), find live listings published since
 * last_checked_at that match its query, and alert the user in-app + on their chosen channels.
 */
export async function savedSearchAlerts(opts: JobOptions = {}) {
  const now = opts.now ?? new Date();
  const searches = await db.prepare(`SELECT s.*, u.blocked, u.deleted_at FROM saved_searches s JOIN users u ON u.id = s.user_id`).all() as {
    id: number; user_id: number; name: string; query: string; channels: string; frequency: string; last_checked_at: string | null; created_at: string; blocked: number; deleted_at: string | null;
  }[];
  const touch = db.prepare("UPDATE saved_searches SET last_checked_at = ? WHERE id = ?");
  const details: string[] = [];
  let checked = 0, alerted = 0, listingsMatched = 0, skipped = 0;

  for (const s of searches) {
    if (s.blocked || s.deleted_at) { skipped++; continue; }
    const since = s.last_checked_at ?? s.created_at;
    const ageH = (now.getTime() - new Date(since).getTime()) / 3600000;
    if (!opts.force && ageH < (WINDOW_H[s.frequency] ?? 23)) { skipped++; continue; }
    checked++;
    const filters = Object.fromEntries(new URLSearchParams(s.query)) as SearchFilters;
    delete filters.page;
    filters.sort = "newest";
    let rows: Awaited<ReturnType<typeof searchListings>>["rows"] = [];
    try {
      rows = (await searchListings(filters, { all: true })).rows;
    } catch (e) {
      details.push(`Search #${s.id}: query failed (${(e as Error).message})`);
      continue;
    }
    const fresh = rows.filter((r) => r.published_at && r.published_at > since && r.user_id !== s.user_id);
    const stamp = now.toISOString();
    if (fresh.length) {
      const top = fresh.slice(0, 3).map((r) => `${r.title} (${r.transaction_type === "sell" ? formatPrice(r.price) : formatRent(r.price)})`).join("; ");
      const channels = s.channels.split(",").map((c) => c.trim()).filter((c): c is Channel => (CHANNELS as readonly string[]).includes(c));
      await notify(s.user_id, {
                kind: "alert",
                title: `${fresh.length} new match${fresh.length > 1 ? "es" : ""} for “${s.name}”`,
                body: top + (fresh.length > 3 ? ` and ${fresh.length - 3} more` : ""),
                link: `/search?${s.query}${s.query.includes("sort=") ? "" : "&sort=newest"}`,
              }, channels);
      alerted++;
      listingsMatched += fresh.length;
      details.push(`Search #${s.id} “${s.name}”: ${fresh.length} new → ${channels.join(", ") || "in-app only"}`);
    }
    await touch.run(stamp, s.id);
  }
  return {
    summary: `${checked} saved search${checked === 1 ? "" : "es"} checked, ${alerted} alert${alerted === 1 ? "" : "s"} sent covering ${listingsMatched} listing${listingsMatched === 1 ? "" : "s"}${skipped ? `, ${skipped} not due yet` : ""}.`,
    counts: { checked, alerted, listings: listingsMatched, skipped },
    details,
    at: nowIso(),
  };
}
