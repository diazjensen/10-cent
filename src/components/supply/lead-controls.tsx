"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { leadStatusAction, visitAction } from "@/app/dashboard/actions";
import { btnClass, cx } from "@/components/ui";

export function LeadStatusButtons({ id, status }: { id: number; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (s: "new" | "contacted" | "spam" | "closed") =>
    start(async () => {
      await leadStatusAction(id, s);
      router.refresh();
    });
  const opts: Array<{ s: "new" | "contacted" | "spam" | "closed"; label: string }> = [
    { s: "contacted", label: "Contacted" },
    { s: "closed", label: "Closed" },
    { s: "spam", label: "Spam" },
  ];
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Lead status">
      {opts.map((o) => (
        <button
          key={o.s}
          type="button"
          disabled={pending}
          aria-pressed={status === o.s}
          onClick={() => set(status === o.s ? "new" : o.s)}
          className={cx(
            "inline-flex items-center h-7 px-2.5 rounded-full text-xs border transition-colors disabled:opacity-50",
            status === o.s ? (o.s === "spam" ? "bg-danger text-white border-danger" : "bg-ink text-white border-ink") : "border-line-2 text-ink-2 hover:border-ink"
          )}
        >
          {status === o.s ? <span className="inline-flex items-center gap-1"><Check size={12} aria-hidden />{o.label}</span> : `Mark ${o.label.toLowerCase()}`}
        </button>
      ))}
    </div>
  );
}

export function VisitButtons({ id, status }: { id: number; status: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const run = (op: "confirm" | "cancel" | "done") =>
    start(async () => {
      const r = await visitAction(id, op);
      setMsg(r.message);
      router.refresh();
    });
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {status === "requested" && <button type="button" disabled={pending} onClick={() => run("confirm")} className={btnClass("trust", "sm", "h-8")}>Confirm</button>}
        {status === "confirmed" && <button type="button" disabled={pending} onClick={() => run("done")} className={btnClass("secondary", "sm", "h-8")}>Mark done</button>}
        {(status === "requested" || status === "confirmed") && <button type="button" disabled={pending} onClick={() => run("cancel")} className={btnClass("ghost", "sm", "h-8 text-danger")}>Cancel</button>}
      </div>
      {msg && <p className="text-xs text-muted mt-1" role="status">{msg}</p>}
    </div>
  );
}
