"use server";

import { db } from "@/lib/db";
import { clientIp } from "@/lib/auth";
import { runJob, JOBS } from "@/lib/jobs";
import { staff, auditAs, done, fail, NOT_ALLOWED, str, ids, type ActionState } from "./guard";

export async function markOutboxSent(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("outbox");
  if (!me) return NOT_ALLOWED;
  const list = ids(fd);
  const status = str(fd, "status") === "failed" ? "failed" : "sent";
  if (!list.length) return fail("Select at least one message.");
  const n = (await db.prepare(`UPDATE outbox SET status = ? WHERE status = 'queued' AND id IN (${list.map(() => "?").join(",")})`).run(status, ...list)).changes;
  await auditAs(me, `outbox.mark_${status}`, "outbox", list.length === 1 ? list[0] : null, { ids: list.slice(0, 100), changed: n });
  return done(`${n} message${n === 1 ? "" : "s"} marked ${status}.`);
}

export async function runJobNow(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("jobs");
  if (!me) return NOT_ALLOWED;
  const name = str(fd, "job");
  if (!JOBS[name]) return fail("Unknown job.");
  const r = await runJob(name, { actorId: me.id, force: fd.get("force") === "on", ip: await clientIp() });
  if (!r.ok) return { error: `${JOBS[name].title} failed: ${r.error}`, at: Date.now(), data: r };
  return { ...done(`${JOBS[name].title}: ${r.summary}`, r) };
}
