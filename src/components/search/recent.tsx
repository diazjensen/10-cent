"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Clock, X } from "lucide-react";
import { clearRecentSearches, clearRecentViews, pushRecentSearch, useRecentSearches, useRecentViews } from "@/lib/seeker/local";

/** Remembers the current search on this device (PRD S9). */
export function RecordRecentSearch({ q, label }: { q: string; label: string }) {
  useEffect(() => {
    if (q) pushRecentSearch({ q, label });
  }, [q, label]);
  return null;
}

/** Recent searches and recently viewed properties, shown when /search has no filters or no results. */
export function RecentPanel() {
  const searches = useRecentSearches();
  const views = useRecentViews();
  if (!searches.length && !views.length) return null;
  return (
    <div className="mb-6 grid gap-5">
      {searches.length > 0 && (
        <section aria-labelledby="recent-s">
          <div className="flex items-center justify-between mb-2">
            <h2 id="recent-s" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Recent searches</h2>
            <button type="button" onClick={clearRecentSearches} className="text-xs text-muted hover:text-ink">Clear</button>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {searches.map((s) => (
              <li key={s.q}>
                <Link href={`/search?${s.q}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-line-2 bg-card text-[13px] hover:border-ink max-w-[320px]">
                  <Clock size={13} className="text-muted shrink-0" aria-hidden /> <span className="truncate">{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {views.length > 0 && (
        <section aria-labelledby="recent-v">
          <div className="flex items-center justify-between mb-2">
            <h2 id="recent-v" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Recently viewed</h2>
            <button type="button" onClick={clearRecentViews} className="text-xs text-muted hover:text-ink inline-flex items-center gap-1"><X size={12} aria-hidden />Clear</button>
          </div>
          <ul className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
            {views.map((v) => (
              <li key={v.id} className="shrink-0 w-[220px]">
                <Link href={`/property/${v.id}`} className="flex gap-2.5 p-2 bg-card border border-line rounded-[var(--radius-md)] hover:border-line-2 hover:shadow-[var(--shadow-pop)]">
                  {v.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.cover} alt="" className="w-16 h-14 rounded-[var(--radius-sm)] object-cover bg-paper-2 shrink-0" />
                  ) : <span className="w-16 h-14 rounded-[var(--radius-sm)] bg-paper-2 shrink-0" />}
                  <span className="min-w-0 text-xs leading-snug">
                    <span className="num block text-sm font-semibold">{v.price}</span>
                    <span className="block truncate text-ink">{v.title}</span>
                    <span className="block truncate text-muted">{v.place}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
