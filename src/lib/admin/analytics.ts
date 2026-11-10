import "server-only";
import { db } from "@/lib/db";
import { lastNDays } from "./metrics";

export type Range = { from: string; to: string; city: string };

export function parseRange(sp: Record<string, string | string[] | undefined>): Range {
  const d = lastNDays(30);
  const ok = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  let from = ok(sp.from) ? (sp.from as string) : d.from;
  let to = ok(sp.to) ? (sp.to as string) : d.to;
  if (from > to) [from, to] = [to, from];
  const city = typeof sp.city === "string" && /^[a-z0-9-]+$/.test(sp.city) ? sp.city : "";
  return { from, to, city };
}

const cityJoin = (r: Range, alias = "l") => (r.city ? ` AND ${alias}.city_id = (SELECT id FROM cities WHERE slug = '${r.city}')` : "");

export type Table = { name: string; title: string; columns: string[]; rows: Array<Array<string | number>> };

export function trafficTable(r: Range): Table {
  const rows = db.prepare(`SELECT s.day, SUM(s.impressions) i, SUM(s.views) v, SUM(s.contacts) c, SUM(s.shortlists) sh
    FROM listing_stats s JOIN listings l ON l.id = s.listing_id WHERE s.day BETWEEN ? AND ?${cityJoin(r)} GROUP BY s.day ORDER BY s.day`).all(r.from, r.to) as { day: string; i: number; v: number; c: number; sh: number }[];
  return { name: "traffic", title: "Traffic (listing impressions and views)", columns: ["day", "impressions", "detail_views", "contacts", "shortlists"], rows: rows.map((x) => [x.day, x.i, x.v, x.c, x.sh]) };
}

export function supplyTable(r: Range): Table {
  const rows = db.prepare(`SELECT substr(l.created_at,1,10) day, c.name city, l.transaction_type tx, l.property_type type, COUNT(*) n, SUM(l.status = 'live') live
    FROM listings l JOIN cities c ON c.id = l.city_id WHERE substr(l.created_at,1,10) BETWEEN ? AND ?${cityJoin(r)}
    GROUP BY day, city, tx, type ORDER BY day, city, tx, type`).all(r.from, r.to) as { day: string; city: string; tx: string; type: string; n: number; live: number }[];
  return { name: "supply", title: "Supply (new listings)", columns: ["day", "city", "transaction", "property_type", "new_listings", "now_live"], rows: rows.map((x) => [x.day, x.city, x.tx, x.type, x.n, x.live]) };
}

export function leadsTable(r: Range): Table {
  const rows = db.prepare(`SELECT substr(ld.created_at,1,10) day, ld.channel, COUNT(*) n, SUM(ld.status = 'spam') spam
    FROM leads ld LEFT JOIN listings l ON l.id = ld.listing_id LEFT JOIN projects p ON p.id = ld.project_id
    WHERE substr(ld.created_at,1,10) BETWEEN ? AND ?${r.city ? ` AND COALESCE(l.city_id, p.city_id) = (SELECT id FROM cities WHERE slug = '${r.city}')` : ""}
    GROUP BY day, ld.channel ORDER BY day, ld.channel`).all(r.from, r.to) as { day: string; channel: string; n: number; spam: number }[];
  return { name: "leads", title: "Leads by channel", columns: ["day", "channel", "leads", "marked_spam"], rows: rows.map((x) => [x.day, x.channel, x.n, x.spam]) };
}

export function revenueTable(r: Range): Table {
  const rows = db.prepare(`SELECT substr(o.paid_at,1,10) day, p.name plan, p.audience, COUNT(*) n, SUM(o.amount_paise - o.discount_paise) net, SUM(o.gst_paise) gst, SUM(o.total_paise) total
    FROM orders o JOIN plans p ON p.id = o.plan_id WHERE o.status IN ('paid','refunded') AND o.paid_at IS NOT NULL AND substr(o.paid_at,1,10) BETWEEN ? AND ?
    AND o.status = 'paid' GROUP BY day, p.id ORDER BY day, p.sort`).all(r.from, r.to) as { day: string; plan: string; audience: string; n: number; net: number; gst: number; total: number }[];
  return { name: "revenue", title: "Revenue by plan (paid orders, ₹)", columns: ["day", "plan", "audience", "orders", "net_inr", "gst_inr", "total_inr"], rows: rows.map((x) => [x.day, x.plan, x.audience, x.n, x.net / 100, x.gst / 100, x.total / 100]) };
}

export function funnelTable(r: Range): Table {
  const t = db.prepare(`SELECT SUM(s.impressions) i, SUM(s.views) v, SUM(s.contacts) c, SUM(s.shortlists) sh
    FROM listing_stats s JOIN listings l ON l.id = s.listing_id WHERE s.day BETWEEN ? AND ?${cityJoin(r)}`).get(r.from, r.to) as { i: number | null; v: number | null; c: number | null; sh: number | null };
  const leads = (db.prepare(`SELECT COUNT(*) n FROM leads ld JOIN listings l ON l.id = ld.listing_id WHERE substr(ld.created_at,1,10) BETWEEN ? AND ?${cityJoin(r)}`).get(r.from, r.to) as { n: number }).n;
  const i = t.i ?? 0, v = t.v ?? 0, c = t.c ?? 0;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 10000) / 100 : 0);
  return {
    name: "funnel", title: "Conversion funnel", columns: ["stage", "count", "pct_of_previous", "pct_of_impressions"],
    rows: [
      ["impressions", i, 100, 100],
      ["detail_views", v, pct(v, i), pct(v, i)],
      ["contacts", c, pct(c, v), pct(c, i)],
      ["lead_records", leads, pct(leads, c), pct(leads, i)],
    ],
  };
}

export const TABLES: Record<string, (r: Range) => Table> = {
  traffic: trafficTable, supply: supplyTable, leads: leadsTable, revenue: revenueTable, funnel: funnelTable,
};

export function toCsv(t: Table) {
  const esc = (v: string | number) => {
    const s = String(v);
    const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s; // CSV-injection guard
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [t.columns.join(","), ...t.rows.map((r) => r.map(esc).join(","))].join("\n") + "\n";
}
