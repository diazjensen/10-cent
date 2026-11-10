import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Click tracking for banners (PRD AD6, B6). */
export async function GET(req: Request, ctx: RouteContext<"/api/banner/[id]">) {
  const { id } = await ctx.params;
  const b = db.prepare("SELECT link FROM banners WHERE id = ?").get(Number(id)) as { link: string } | undefined;
  if (!b) return NextResponse.redirect(new URL("/", req.url));
  db.prepare("UPDATE banners SET clicks = clicks + 1 WHERE id = ?").run(Number(id));
  return NextResponse.redirect(new URL(b.link || "/", req.url));
}
