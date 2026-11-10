import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { AdminHeader, StatusBadge } from "@/components/admin/ui";
import { JobRunner } from "@/components/admin/job-runner";
import { JOBS } from "@/lib/jobs";

export const metadata: Metadata = { title: "Background jobs" };

export default async function JobsPage() {
  await requireAdmin("jobs");
  const last = (name: string) => {
    const rows = db.prepare("SELECT a.details, a.created_at, u.name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id WHERE a.action = ? ORDER BY a.id DESC LIMIT 5").all(`job.${name}`) as { details: string | null; created_at: string; name: string | null }[];
    return rows.map((r) => {
      let d: { ok?: boolean; summary?: string } = {};
      try { d = JSON.parse(r.details ?? "{}"); } catch { /* ignore */ }
      return { at: r.created_at, by: r.name ?? "Scheduler", ok: d.ok !== false, summary: d.summary ?? "" };
    });
  };
  const secretSet = !!process.env.CRON_SECRET;

  return (
    <div>
      <AdminHeader eyebrow="System" title="Background jobs" sub="These run on a schedule by calling /api/cron/<job> with the x-cron-secret header. Run one now to process immediately; each run is written to the audit log." />
      <div className="mb-5 p-3.5 bg-card border border-line rounded-[var(--radius-md)] text-[13px] flex flex-wrap gap-x-6 gap-y-1">
        <span>CRON_SECRET: {secretSet ? <strong className="text-trust">configured</strong> : <strong className="text-warn">not set (only localhost and super admins can trigger jobs)</strong>}</span>
        <span className="text-muted">Schedule reference: <code>src/lib/jobs/README.md</code></span>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {Object.entries(JOBS).map(([name, j]) => {
          const runs = last(name);
          return (
            <section key={name} className="bg-card border border-line rounded-[var(--radius-md)] p-4 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{j.title}</h2>
                  <code className="text-[11.5px] text-muted">/api/cron/{name}</code>
                </div>
                <span className="text-right text-xs text-muted">{j.schedule}<br /><code className="text-[11px]">{j.cron}</code></span>
              </div>
              <p className="text-[13px] text-ink-2 mt-2">{j.describe}</p>
              <div className="mt-4"><JobRunner job={name} /></div>
              <div className="mt-4 pt-3 border-t border-line">
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-1.5">Recent runs</div>
                {runs.length ? (
                  <ul className="space-y-1 text-[12.5px]">
                    {runs.map((r, i) => (
                      <li key={i} className="flex gap-2 items-start">
                        <StatusBadge status={r.ok ? "sent" : "failed"} label={r.ok ? "ok" : "failed"} />
                        <span className="min-w-0"><span className="text-muted">{timeAgo(r.at)} · {r.by}</span> <span className="text-ink-2">{r.summary}</span></span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-[12.5px] text-muted">Never run.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
