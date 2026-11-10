"use client";

import Link from "next/link";
import { useState } from "react";
import { cx, btnClass } from "@/components/ui";

/** Pick up to 4 shortlisted homes and open them in /compare. */
export function ComparePicker({ items }: { items: Array<{ id: number; label: string }> }) {
  const [sel, setSel] = useState<number[]>(items.slice(0, 4).map((i) => i.id));
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));
  return (
    <div className="bg-card border border-line rounded-[var(--radius-md)] p-3 md:p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm"><span className="font-medium">Compare side by side</span> <span className="text-muted">· pick 2 to 4</span></p>
        {sel.length >= 2 ? (
          <Link href={`/compare?ids=${sel.join(",")}`} className={btnClass("primary", "sm")}>Compare {sel.length} homes</Link>
        ) : (
          <span className={btnClass("primary", "sm", "opacity-50 pointer-events-none")} aria-disabled="true">Compare</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {items.map((i) => {
          const on = sel.includes(i.id);
          return (
            <button key={i.id} type="button" aria-pressed={on} onClick={() => toggle(i.id)} disabled={!on && sel.length >= 4}
              className={cx("max-w-[260px] truncate h-8 px-3 rounded-full text-[13px] border disabled:opacity-40", on ? "bg-ink text-white border-ink" : "bg-paper border-line text-ink-2 hover:border-ink-2")}>
              {i.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
