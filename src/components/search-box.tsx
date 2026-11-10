"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Building2, HardHat, Landmark, MapPin, Search, Navigation } from "lucide-react";
import { SEARCH_TABS } from "@/lib/constants";
import type { Suggestion } from "@/app/api/suggest/route";
import { cx } from "./ui";

const BUDGETS_BUY = [["", "Any budget"], ["3000000", "Under ₹30 L"], ["6000000", "Under ₹60 L"], ["10000000", "Under ₹1 Cr"], ["20000000", "Under ₹2 Cr"], ["50000000", "Under ₹5 Cr"]];
const BUDGETS_RENT = [["", "Any budget"], ["15000", "Under ₹15,000"], ["25000", "Under ₹25,000"], ["40000", "Under ₹40,000"], ["75000", "Under ₹75,000"], ["150000", "Under ₹1.5 L"]];

const ICON = { city: Building2, locality: MapPin, project: HardHat, builder: Landmark, landmark: Navigation };

/** Typeahead input; emits a selected suggestion or free text. Reused on home and search pages. */
export function SuggestInput({ city, value, onChange, onPick, placeholder, className, inputClassName }: {
  city?: string; value: string; onChange: (v: string) => void; onPick: (s: Suggestion) => void; placeholder?: string; className?: string; inputClassName?: string;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(value)}&city=${city ?? ""}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => { setItems(d.items); setActive(-1); })
        .catch(() => {});
    }, 140);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value, city]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const visible = open && value.trim().length >= 2 && items.length > 0;
  return (
    <div ref={box} className={cx("relative", className)}>
      <input
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!visible) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
          if (e.key === "Enter" && active >= 0) { e.preventDefault(); onPick(items[active]); setOpen(false); }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        className={inputClassName}
        aria-label="Search by city, locality, project, builder or landmark"
      />
      {visible && (
        <ul id={listId} role="listbox" className="absolute z-30 left-0 right-0 top-[calc(100%+6px)] bg-card border border-line rounded-[var(--radius-md)] shadow-[var(--shadow-pop)] py-1.5 max-h-80 overflow-auto">
          {items.map((s, i) => {
            const Icon = ICON[s.kind];
            return (
              <li key={`${s.kind}-${s.label}-${i}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(s); setOpen(false); }} className={cx("w-full flex items-center gap-3 px-3 py-2 text-left text-sm", i === active ? "bg-paper-2" : "hover:bg-paper-2")}>
                  <Icon size={15} className="text-muted shrink-0" aria-hidden />
                  <span className="flex-1 min-w-0"><span className="text-ink">{s.label}</span> <span className="text-muted text-xs">· {s.sub}</span></span>
                  <span className="text-[10px] uppercase tracking-wider text-muted">{s.kind}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Hero search with tabs (PRD H1). */
export function HeroSearch({ city }: { city: string | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof SEARCH_TABS)[number]["key"]>("buy");
  const [q, setQ] = useState("");
  const [budget, setBudget] = useState("");
  const [bhk, setBhk] = useState("");
  const isRent = tab === "rent" || tab === "pg";

  const go = (extra: Record<string, string> = {}, href?: string) => {
    if (href) { router.push(href); return; }
    if (tab === "projects") {
      const p = new URLSearchParams({ ...(city ? { city } : {}), ...(q && !extra.city ? { q } : {}), ...extra });
      router.push(`/projects?${p}`);
      return;
    }
    const t = SEARCH_TABS.find((x) => x.key === tab)!;
    const p = new URLSearchParams({ ...(t.query as Record<string, string>) });
    if (city) p.set("city", city);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    if (q && !extra.loc && !extra.near && !extra.city) p.set("q", q);
    if (budget) p.set("max", budget);
    if (bhk && tab !== "plots" && tab !== "commercial") p.set("bhk", bhk);
    router.push(`/search?${p}`);
  };

  return (
    <div className="bg-card border border-line rounded-[var(--radius-lg)] shadow-[var(--shadow-pop)]">
      <div role="tablist" aria-label="What are you looking for" className="flex overflow-x-auto scrollbar-none border-b border-line px-2">
        {SEARCH_TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} type="button" onClick={() => { setTab(t.key); setBudget(""); }}
            className={cx("relative shrink-0 px-3.5 h-12 text-sm font-medium", tab === t.key ? "text-ink" : "text-muted hover:text-ink")}>
            {t.label}
            {tab === t.key && <span className="absolute left-3 right-3 bottom-0 h-[2px] bg-accent" />}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); go(); }} className="p-3 md:p-4 grid gap-2 md:grid-cols-[1fr_170px_130px_auto]">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" aria-hidden />
          <SuggestInput
            city={city ?? undefined}
            value={q}
            onChange={setQ}
            onPick={(s) => { setQ(s.label); go(s.params ?? {}, s.href); }}
            placeholder={tab === "projects" ? "Project, builder or locality" : "Locality, project, builder or landmark"}
            inputClassName="w-full h-12 pl-10 pr-3 rounded-[var(--radius-sm)] bg-paper text-[15px] placeholder:text-muted border border-transparent focus:border-ink focus:outline-none"
          />
        </div>
        {tab !== "projects" && (
          <select aria-label="Budget" value={budget} onChange={(e) => setBudget(e.target.value)} className="h-12 px-3 rounded-[var(--radius-sm)] bg-paper text-sm border border-transparent focus:border-ink focus:outline-none">
            {(isRent ? BUDGETS_RENT : BUDGETS_BUY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        {tab !== "projects" && tab !== "plots" && tab !== "commercial" && tab !== "pg" && (
          <select aria-label="BHK" value={bhk} onChange={(e) => setBhk(e.target.value)} className="h-12 px-3 rounded-[var(--radius-sm)] bg-paper text-sm border border-transparent focus:border-ink focus:outline-none">
            <option value="">Any BHK</option>
            {[1, 2, 3, 4].map((b) => <option key={b} value={b}>{b} BHK</option>)}
            <option value="5">5+ BHK</option>
          </select>
        )}
        <button type="submit" className="h-12 px-7 rounded-[var(--radius-sm)] bg-accent text-white font-medium hover:bg-accent-ink md:col-start-4">Search</button>
      </form>
    </div>
  );
}
