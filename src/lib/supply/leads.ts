import "server-only";
import { db } from "@/lib/db";

export type LeadFilters = { status?: string; project?: string; listing?: string; channel?: string; from?: string; to?: string; q?: string; source?: string };
export type LeadRow = {
  id: number; created_at: string; name: string | null; phone: string | null; email: string | null; message: string | null; channel: string; status: string;
  listing_id: number | null; listing_title: string | null; project_id: number | null; project_name: string | null; project_slug: string | null; locality: string | null;
};

const one = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? String(v[0] ?? "") : "");
export function parseLeadFilters(sp: Record<string, unknown>): LeadFilters {
  return { status: one(sp.status), project: one(sp.project), listing: one(sp.listing), channel: one(sp.channel), from: one(sp.from), to: one(sp.to), q: one(sp.q), source: one(sp.source) };
}

/** Leads for an agent/builder across listings and projects (PRD B7). */
export async function queryLeads(posterId: number, f: LeadFilters, limit = 50, offset = 0) {
  const where = ["ld.poster_id = ?"];
  const args: (string | number)[] = [posterId];
  if (f.status && ["new", "contacted", "spam", "closed"].includes(f.status)) { where.push("ld.status = ?"); args.push(f.status); }
  if (f.project && Number(f.project)) { where.push("ld.project_id = ?"); args.push(Number(f.project)); }
  if (f.listing && Number(f.listing)) { where.push("ld.listing_id = ?"); args.push(Number(f.listing)); }
  if (f.source === "project") where.push("ld.project_id IS NOT NULL");
  if (f.source === "listing") where.push("ld.listing_id IS NOT NULL");
  if (f.channel) { where.push("ld.channel = ?"); args.push(f.channel); }
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) { where.push("ld.created_at >= ?"); args.push(`${f.from}T00:00:00`); }
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) { where.push("ld.created_at <= ?"); args.push(`${f.to}T23:59:59.999Z`); }
  if (f.q && f.q.trim()) { const like = `%${f.q.trim()}%`; where.push("(ld.name LIKE ? OR ld.phone LIKE ? OR ld.email LIKE ? OR ld.message LIKE ?)"); args.push(like, like, like, like); }
  const w = where.join(" AND ");
  const total = (await db.prepare(`SELECT COUNT(*) n FROM leads ld WHERE ${w}`).get(...args) as { n: number }).n;
  const rows = await db.prepare(
      `SELECT ld.id, ld.created_at, ld.name, ld.phone, ld.email, ld.message, ld.channel, ld.status, ld.listing_id, l.title listing_title,
            ld.project_id, p.name project_name, p.slug project_slug, COALESCE(lo1.name, lo2.name) locality
     FROM leads ld LEFT JOIN listings l ON l.id = ld.listing_id LEFT JOIN projects p ON p.id = ld.project_id
       LEFT JOIN localities lo1 ON lo1.id = l.locality_id LEFT JOIN localities lo2 ON lo2.id = p.locality_id
     WHERE ${w} ORDER BY ld.created_at DESC ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`
    ).all(...args) as LeadRow[];
  return { rows, total };
}

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export function toCsv(header: string[], rows: unknown[][]) {
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}
