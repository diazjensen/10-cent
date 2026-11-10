"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GitCompareArrows, X } from "lucide-react";
import { COMPARE_MAX, clearCompare, removeCompare, toggleCompare, useCompare, pushRecentView, type CompareItem, type RecentView } from "@/lib/seeker/local";
import { btnClass, cx } from "@/components/ui";

/** "Add to compare" toggle (PRD D9). Stored per device, max 4. */
export function CompareToggle({ item, variant = "chip" }: { item: CompareItem; variant?: "chip" | "button" | "overlay" }) {
  const list = useCompare();
  const on = list.some((c) => c.id === item.id);
  const [full, setFull] = useState(false);
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = toggleCompare(item);
    setFull(!r.ok);
    if (!r.ok) setTimeout(() => setFull(false), 2500);
  };
  if (variant === "button")
    return (
      <button type="button" onClick={onClick} aria-pressed={on} className={cx("inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-sm)] border text-sm font-medium", on ? "border-ink bg-paper-2" : "border-line-2 bg-card hover:border-ink")}>
        <GitCompareArrows size={16} aria-hidden /> {full ? `Max ${COMPARE_MAX}` : on ? "In compare" : "Compare"}
      </button>
    );
  if (variant === "overlay")
    return (
      <button type="button" onClick={onClick} aria-pressed={on} aria-label={on ? `Remove ${item.title} from compare` : `Add ${item.title} to compare`}
        className={cx("inline-flex items-center gap-1 h-7 px-2 rounded-full text-[11px] font-semibold shadow-sm", on ? "bg-ink text-white" : "bg-white/95 text-ink hover:bg-white")}>
        <GitCompareArrows size={13} aria-hidden /> {full ? `Max ${COMPARE_MAX}` : on ? "Comparing" : "Compare"}
      </button>
    );
  return (
    <label className={cx("inline-flex items-center gap-1.5 text-xs cursor-pointer select-none", on ? "text-ink font-medium" : "text-muted hover:text-ink")} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={on} onChange={() => {}} onClick={onClick} className="w-3.5 h-3.5 accent-[var(--color-ink)]" />
      {full ? `Compare is full (${COMPARE_MAX})` : "Compare"}
    </label>
  );
}

/** Floating tray listing properties picked for comparison. */
export function CompareTray() {
  const list = useCompare();
  if (!list.length) return null;
  const href = `/compare?ids=${list.map((c) => c.id).join(",")}`;
  return (
    <div className="fixed z-40 bottom-3 left-1/2 -translate-x-1/2 w-[min(760px,calc(100vw-16px))] bg-ink text-white rounded-[var(--radius-md)] shadow-[var(--shadow-pop)] px-3 py-2.5 flex items-center gap-3" role="region" aria-label="Compare tray">
      <div className="hidden sm:block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60 shrink-0 pl-1">Compare<br /><span className="num">{list.length}/{COMPARE_MAX}</span></div>
      <ul className="flex-1 min-w-0 flex gap-2 overflow-x-auto scrollbar-none">
        {list.map((c) => (
          <li key={c.id} className="shrink-0 flex items-center gap-2 bg-white/10 rounded-[var(--radius-sm)] pl-1 pr-1 py-1 max-w-[200px]">
            {c.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.cover} alt="" className="w-9 h-9 rounded object-cover bg-white/20 shrink-0" />
            ) : <span className="w-9 h-9 rounded bg-white/20 shrink-0" />}
            <span className="min-w-0 text-xs leading-tight">
              <span className="block truncate">{c.title}</span>
              <span className="num text-white/70">{c.price}</span>
            </span>
            <button type="button" onClick={() => removeCompare(c.id)} aria-label={`Remove ${c.title} from compare`} className="w-6 h-6 grid place-items-center rounded hover:bg-white/15 shrink-0"><X size={14} /></button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={clearCompare} className="hidden sm:inline text-xs text-white/70 hover:text-white shrink-0">Clear</button>
      {list.length >= 2 ? (
        <Link href={href} className={btnClass("accent", "sm", "shrink-0")}>Compare {list.length}</Link>
      ) : (
        <span className="text-xs text-white/70 shrink-0 max-w-[90px] leading-tight">Add one more to compare</span>
      )}
    </div>
  );
}

/** Remembers this listing in "recently viewed" on this device (PRD S9). */
export function TrackRecentView({ item }: { item: Omit<RecentView, "at"> }) {
  const { id, title, price, place, cover } = item;
  useEffect(() => {
    pushRecentView({ id, title, price, place, cover });
  }, [id, title, price, place, cover]);
  return null;
}

