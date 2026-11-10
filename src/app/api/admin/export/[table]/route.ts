import { NextResponse } from "next/server";
import { getUser, can } from "@/lib/auth";
import { audit } from "@/lib/db";
import { TABLES, parseRange, toCsv } from "@/lib/admin/analytics";

/** CSV export of an analytics table (PRD AD8). Staff with the analytics permission only. */
export async function GET(req: Request, ctx: RouteContext<"/api/admin/export/[table]">) {
  const u = await getUser();
  if (!can(u, "analytics")) return NextResponse.json({ error: "Forbidden" }, { status: u ? 403 : 401 });
  const { table } = await ctx.params;
  const fn = TABLES[table];
  if (!fn) return NextResponse.json({ error: `Unknown table. Use one of: ${Object.keys(TABLES).join(", ")}` }, { status: 404 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const range = parseRange(sp);
  const t = await fn(range);
  await audit(u!.id, "analytics.export", "report", null, { table, ...range });
  return new NextResponse(toCsv(t), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="10cent-${table}-${range.from}-to-${range.to}${range.city ? `-${range.city}` : ""}.csv"`,
      "cache-control": "no-store",
    },
  });
}
