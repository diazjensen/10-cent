import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getUser, can } from "@/lib/auth";
import { runJob, JOBS } from "@/lib/jobs";

export const dynamic = "force-dynamic";

const LOCAL = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);

/**
 * Background job trigger for an external scheduler (see src/lib/jobs/README.md).
 * Auth: header `x-cron-secret` must equal env CRON_SECRET. If CRON_SECRET is not set (local dev),
 * only requests from localhost or a signed-in super admin are accepted.
 */
async function authorise(req: Request): Promise<{ ok: true; actorId: number | null } | { ok: false; status: number; error: string }> {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("x-cron-secret");
  if (secret) {
    if (given && given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret))) return { ok: true, actorId: null };
    const u = await getUser();
    if (u && can(u, "jobs")) return { ok: true, actorId: u.id };
    return { ok: false, status: 401, error: "Missing or wrong x-cron-secret header." };
  }
  const u = await getUser();
  if (u && can(u, "jobs")) return { ok: true, actorId: u.id };
  if (process.env.NODE_ENV === "production") return { ok: false, status: 401, error: "Set CRON_SECRET to run jobs from a scheduler." };
  const fwd = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const host = new URL(req.url).hostname;
  if ((!fwd || LOCAL.has(fwd)) && LOCAL.has(host)) return { ok: true, actorId: null };
  return { ok: false, status: 401, error: "CRON_SECRET is not configured; only localhost or a super admin may run jobs." };
}

async function handle(req: Request, ctx: RouteContext<"/api/cron/[job]">) {
  const { job } = await ctx.params;
  if (job !== "all" && !JOBS[job]) return NextResponse.json({ error: `Unknown job. Use one of: ${Object.keys(JOBS).join(", ")}, all` }, { status: 404 });
  const auth = await authorise(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const force = new URL(req.url).searchParams.get("force") === "1";
  const names = job === "all" ? Object.keys(JOBS) : [job];
  const results = names.map((n) => runJob(n, { actorId: auth.actorId, force, ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "cron" }));
  const ok = results.every((r) => r.ok);
  return NextResponse.json(job === "all" ? { ok, results } : results[0], { status: ok ? 200 : 500, headers: { "cache-control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
