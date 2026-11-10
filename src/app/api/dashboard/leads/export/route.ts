import { getUser } from "@/lib/auth";
import { audit } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { parseLeadFilters, queryLeads, toCsv } from "@/lib/supply/leads";

/** GET /api/dashboard/leads/export?status=&project=&from=&to= → text/csv of the poster's leads (PRD B7). */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return new Response("Log in to export leads.", { status: 401 });
  if (!["agent", "builder", "owner", "admin"].includes(user.role)) return new Response("Not allowed.", { status: 403 });
  if (!(await rateLimit(`leads-export:${user.id}`, 30, 3600)).ok) return new Response("Too many exports. Try again later.", { status: 429 });
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const { rows } = await queryLeads(user.id, parseLeadFilters(sp), 0);
  const csv = toCsv(
    ["lead_id", "created_at", "name", "phone", "email", "channel", "status", "source", "listing_id", "project_id", "property_or_project", "locality", "message"],
    rows.map((r) => [r.id, r.created_at, r.name, r.phone, r.email, r.channel, r.status, r.project_id ? "project" : "listing", r.listing_id, r.project_id, r.project_name ?? r.listing_title, r.locality, r.message])
  );
  await audit(user.id, "leads.export", "user", user.id, { count: rows.length, filters: sp });
  const date = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="10cent-leads-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
