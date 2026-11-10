import "server-only";
import { audit } from "@/lib/db";
import { expireListings } from "./expire-listings";
import { savedSearchAlerts } from "./saved-search-alerts";
import { requirementMatches } from "./requirement-matches";
import { subscriptionExpiry } from "./subscription-expiry";
import type { JobOptions, JobResult } from "./types";

export type { JobResult, JobOptions };

type JobFn = (o: JobOptions) => Promise<{ summary: string; counts: Record<string, number>; details: string[] }>;

export const JOBS: Record<string, { title: string; schedule: string; cron: string; describe: string; run: JobFn }> = {
  "expire-listings": {
    title: "Expire listings",
    schedule: "Every hour",
    cron: "5 * * * *",
    describe: "Moves live listings past their 60-day validity to Expired and sends a renew link; warns posters 3 days before.",
    run: expireListings,
  },
  "saved-search-alerts": {
    title: "Saved search alerts",
    schedule: "Every 15 minutes (each search honours its instant / daily / weekly frequency)",
    cron: "*/15 * * * *",
    describe: "Finds listings published since each saved search was last checked and alerts the seeker in-app and on their chosen channels.",
    run: savedSearchAlerts,
  },
  "requirement-matches": {
    title: "Requirement matches",
    schedule: "Every hour",
    cron: "20 * * * *",
    describe: "Matches newly published listings against active buyer/tenant requirements and notifies the requirement owner.",
    run: requirementMatches,
  },
  "subscription-expiry": {
    title: "Subscription expiry",
    schedule: "Daily at 01:30 IST",
    cron: "0 20 * * *",
    describe: "Expires ended paid plans, removes their search boost, and sends renewal reminders 3 days before the end.",
    run: subscriptionExpiry,
  },
};

/** Runs a job, never throws, and records the run in the audit log (actor = the staff member or NULL for cron). */
export async function runJob(name: string, opts: JobOptions & { actorId?: number | null; ip?: string } = {}): Promise<JobResult> {
  const job = JOBS[name];
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  if (!job) return { job: name, ok: false, startedAt, ms: 0, summary: "Unknown job", counts: {}, details: [], error: `Unknown job “${name}”` };
  let result: JobResult;
  try {
    const r = await job.run(opts);
    result = { job: name, ok: true, startedAt, ms: Date.now() - t0, summary: r.summary, counts: r.counts, details: r.details.slice(0, 200) };
  } catch (e) {
    result = { job: name, ok: false, startedAt, ms: Date.now() - t0, summary: "Job failed", counts: {}, details: [], error: (e as Error).message };
  }
  await audit(opts.actorId ?? null, `job.${name}`, "job", null, { ...result, details: result.details.slice(0, 20), force: !!opts.force }, opts.ip);
  return result;
}
