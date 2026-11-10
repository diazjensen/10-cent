import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSeed } from "@/lib/seed/run";

// One-time bootstrap: loads the demo data into an EMPTY database from inside the deployment (which can reach Supabase).
// Guarded twice: the SEED_SECRET env var must match, and it refuses to run if any user already exists (it never truncates).
// Remove this route (and SEED_SECRET) once the data is loaded.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function same(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function handle(req: Request) {
  const secret = process.env.SEED_SECRET;
  const given = new URL(req.url).searchParams.get("key") ?? req.headers.get("x-seed-key") ?? "";
  if (!secret || secret.length < 16 || !same(given, secret)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const existing = (await db.prepare("SELECT COUNT(*) AS n FROM users").get()) as { n: number };
  if (existing.n > 0) return NextResponse.json({ ok: false, error: `Database already has ${existing.n} users; refusing to seed.` }, { status: 409 });
  const t0 = Date.now();
  const summary = await runSeed({ truncate: false });
  return NextResponse.json({ ok: true, summary, ms: Date.now() - t0 }, { headers: { "cache-control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
