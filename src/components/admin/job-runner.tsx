"use client";

import { useActionState } from "react";
import { runJobNow } from "@/lib/admin/actions-system";
import { btnClass, cx } from "@/components/ui";

type Result = { ok: boolean; summary: string; ms: number; counts: Record<string, number>; details: string[]; error?: string };
type State = { ok?: string; error?: string; at?: number; data?: unknown };

export function JobRunner({ job }: { job: string }) {
  const [state, action, pending] = useActionState<State, FormData>(runJobNow, {});
  const r = state.data as Result | undefined;
  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="job" value={job} />
        <button type="submit" disabled={pending} className={btnClass("primary", "sm")}>{pending ? "Running…" : "Run now"}</button>
        <label className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2" title="Ignore frequency windows / last-run cut-off">
          <input type="checkbox" name="force" className="accent-[var(--color-ink)]" /> Force
        </label>
      </form>
      {(state.ok || state.error) && (
        <div role="status" className={cx("mt-3 rounded-[var(--radius-sm)] border px-3 py-2.5 text-[13px]", state.error ? "bg-danger-soft border-danger/20 text-danger" : "bg-trust-soft border-trust/20 text-trust")}>
          <div className="font-medium">{r?.summary ?? state.error}</div>
          {r && (
            <div className="mt-1 text-xs text-ink-2 num">
              {Object.entries(r.counts).map(([k, v]) => `${k}: ${v}`).join(" · ")} · {r.ms} ms
            </div>
          )}
          {r && r.details.length > 0 && (
            <ul className="mt-2 max-h-48 overflow-y-auto text-xs text-ink-2 space-y-0.5 list-disc pl-4">
              {r.details.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
