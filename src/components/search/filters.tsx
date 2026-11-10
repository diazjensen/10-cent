"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { AMENITIES, FURNISHING, POSTED_BY, PROPERTY_TYPES, TENANT_TYPES } from "@/lib/constants";
import { formatINR, parseBudget } from "@/lib/format";
import {
  BUDGET_PRESETS_RENT, BUDGET_PRESETS_SALE, LANDMARK_KIND_LABEL, isRentLike, moneyShort, toQuery, type SearchParamsObj,
} from "@/lib/seeker/search-params";
import { cx, btnClass } from "@/components/ui";

export type FilterCity = { slug: string; name: string };
export type FilterLocality = { id: number; name: string };
export type NearOption = { name: string; kind: string; lat: number; lng: number; locality: string };

type Props = { params: SearchParamsObj; cities: FilterCity[]; localities: FilterLocality[]; nearOptions: NearOption[] };

const list = (s?: string) => (s ? s.split(",").filter(Boolean) : []);
const RESI_TYPES = PROPERTY_TYPES.filter((t) => t.category === "residential" && t.value !== "pg");
const COMM_TYPES = PROPERTY_TYPES.filter((t) => t.category === "commercial");
const RENT_ONLY: (keyof SearchParamsObj)[] = ["furn", "tenant", "avail"];
const BUY_ONLY: (keyof SearchParamsObj)[] = ["cs", "poss", "newlaunch", "rera"];
const YEAR = new Date().getFullYear();

/** Builds the next search URL from a filter state; drops paging. */
function hrefFor(p: SearchParamsObj) {
  const q = toQuery(p, ["page"]);
  return q ? `/search?${q}` : "/search";
}

/** Filter controls for S2–S5 and nearby search (S7). Desktop applies instantly; the mobile drawer applies on "Show results". */
export function FilterPanel({ params, cities, localities, nearOptions, autoApply, onChange }: Props & { autoApply: boolean; onChange?: (p: SearchParamsObj) => void }) {
  const router = useRouter();
  const [p, setP] = useState<SearchParamsObj>(params);
  const rent = isRentLike(p.tx);
  const commercial = p.cat === "commercial";
  const types = list(p.type);
  const noBhk = commercial || p.tx === "pg" || (types.length > 0 && types.every((t) => ["plot", "office", "shop", "warehouse", "pg"].includes(t)));

  const commit = (next: SearchParamsObj) => {
    for (const k of Object.keys(next) as (keyof SearchParamsObj)[]) if (!next[k]) delete next[k];
    delete next.page;
    if (next.min !== p.min || next.max !== p.max || next.tx !== p.tx) {
      const r = isRentLike(next.tx);
      setMinText(next.min ? moneyShort(Number(next.min), r).replace("₹", "") : "");
      setMaxText(next.max ? moneyShort(Number(next.max), r).replace("₹", "") : "");
    }
    setP(next);
    onChange?.(next);
    if (autoApply) router.push(hrefFor(next), { scroll: false });
  };
  const set = (k: keyof SearchParamsObj, v: string | undefined) => commit({ ...p, [k]: v });
  const toggle = (k: keyof SearchParamsObj, v: string) => {
    const cur = list(p[k]);
    commit({ ...p, [k]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",") });
  };
  const flag = (k: keyof SearchParamsObj) => set(k, p[k] === "1" ? undefined : "1");

  const setTx = (tx: string | undefined, cat?: string) => {
    const next: SearchParamsObj = { ...p, tx, cat, min: undefined, max: undefined };
    if (!isRentLike(tx)) RENT_ONLY.forEach((k) => delete next[k]);
    if (isRentLike(tx)) BUY_ONLY.forEach((k) => delete next[k]);
    const allowed = (cat === "commercial" ? COMM_TYPES : tx === "pg" ? [{ value: "pg" }] : RESI_TYPES).map((t) => t.value as string);
    next.type = list(p.type).filter((t) => allowed.includes(t)).join(",");
    if (cat === "commercial" || tx === "pg") delete next.bhk;
    commit(next);
  };

  const presets = rent ? BUDGET_PRESETS_RENT : BUDGET_PRESETS_SALE;
  const [minText, setMinText] = useState(p.min ? moneyShort(Number(p.min), rent).replace("₹", "") : "");
  const [maxText, setMaxText] = useState(p.max ? moneyShort(Number(p.max), rent).replace("₹", "") : "");
  const [budgetErr, setBudgetErr] = useState("");
  const applyBudget = () => {
    const lo = minText.trim() ? parseBudget(minText) : null, hi = maxText.trim() ? parseBudget(maxText) : null;
    if ((minText.trim() && lo == null) || (maxText.trim() && hi == null)) { setBudgetErr(rent ? "Use numbers like 15000 or 25k" : "Use numbers like 50L or 1.2Cr"); return; }
    if (lo != null && hi != null && lo > hi) { setBudgetErr("Minimum is more than maximum"); return; }
    setBudgetErr("");
    if (String(lo ?? "") !== (p.min ?? "") || String(hi ?? "") !== (p.max ?? "")) commit({ ...p, min: lo != null ? String(lo) : undefined, max: hi != null ? String(hi) : undefined });
  };

  const [amin, setAmin] = useState(p.amin ?? "");
  const [amax, setAmax] = useState(p.amax ?? "");
  const applyArea = () => {
    const a = amin.replace(/\D/g, ""), b = amax.replace(/\D/g, "");
    if ((a || undefined) !== p.amin || (b || undefined) !== p.amax) commit({ ...p, amin: a || undefined, amax: b || undefined });
  };

  const [now] = useState(() => Date.now());
  const [locFilter, setLocFilter] = useState("");
  const locs = list(p.loc);
  const shownLocs = useMemo(() => {
    const f = locFilter.trim().toLowerCase();
    const sorted = [...localities].sort((a, b) => Number(locs.includes(String(b.id))) - Number(locs.includes(String(a.id))));
    return f ? sorted.filter((l) => l.name.toLowerCase().includes(f)) : sorted;
  }, [localities, locFilter, locs]);

  const [nearKey, nearKm] = useMemo(() => {
    if (!p.near) return ["", "2"];
    const [la, ln, km] = p.near.split(",");
    const opt = nearOptions.find((o) => o.lat.toFixed(5) === Number(la).toFixed(5) && o.lng.toFixed(5) === Number(ln).toFixed(5));
    return [opt ? `${opt.lat},${opt.lng}` : "", km || "2"];
  }, [p.near, nearOptions]);
  const nearGroups = useMemo(() => {
    const g = new Map<string, NearOption[]>();
    for (const o of nearOptions) g.set(o.locality, [...(g.get(o.locality) ?? []), o]);
    return [...g.entries()];
  }, [nearOptions]);
  const setNear = (key: string, km: string) => {
    if (!key) { commit({ ...p, near: undefined, nearname: undefined }); return; }
    const o = nearOptions.find((x) => `${x.lat},${x.lng}` === key);
    commit({ ...p, near: `${key},${km}`, nearname: o?.name, bounds: undefined });
  };

  return (
    <div className="divide-y divide-line text-sm">
      <Group title="Looking to" open>
        <div className="grid grid-cols-4 gap-1 p-1 bg-paper-2 rounded-[var(--radius-sm)]">
          {[
            { label: "Buy", tx: "sell", cat: undefined },
            { label: "Rent", tx: "rent", cat: undefined },
            { label: "PG", tx: "pg", cat: undefined },
            { label: "Commercial", tx: p.tx === "pg" ? undefined : p.tx, cat: "commercial" },
          ].map((o) => {
            const on = o.cat === "commercial" ? commercial : !commercial && p.tx === o.tx;
            return (
              <button key={o.label} type="button" aria-pressed={on} onClick={() => setTx(o.tx, o.cat)}
                className={cx("h-8 rounded-[var(--radius-xs)] text-[12.5px] font-medium", on ? "bg-card text-ink shadow-sm" : "text-ink-2 hover:text-ink")}>
                {o.label}
              </button>
            );
          })}
        </div>
        {commercial && (
          <div className="flex gap-3 mt-2.5 text-[13px]">
            {[["sell", "For sale"], ["rent", "For lease"], ["", "Both"]].map(([v, l]) => (
              <label key={l} className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="ctx" checked={(p.tx ?? "") === v} onChange={() => setTx(v || undefined, "commercial")} className="accent-[var(--color-ink)]" />{l}</label>
            ))}
          </div>
        )}
      </Group>

      <Group title="City and localities" open count={locs.length + (p.city ? 1 : 0)}>
        <select aria-label="City" value={p.city ?? ""} onChange={(e) => commit({ ...p, city: e.target.value || undefined, loc: undefined, near: undefined, nearname: undefined, bounds: undefined })}
          className="w-full h-9 px-2.5 rounded-[var(--radius-sm)] border border-line-2 bg-card">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        {localities.length > 0 && (
          <>
            <input value={locFilter} onChange={(e) => setLocFilter(e.target.value)} placeholder="Filter localities" aria-label="Filter localities"
              className="mt-2 w-full h-9 px-2.5 rounded-[var(--radius-sm)] border border-line-2 bg-card placeholder:text-muted" />
            <div className="mt-1.5 max-h-44 overflow-y-auto pr-1 space-y-0.5">
              {shownLocs.map((l) => (
                <Check key={l.id} checked={locs.includes(String(l.id))} onChange={() => toggle("loc", String(l.id))}>{l.name}</Check>
              ))}
              {!shownLocs.length && <p className="text-xs text-muted py-1">No locality matches “{locFilter}”.</p>}
            </div>
          </>
        )}
      </Group>

      <Group title={rent ? "Monthly rent" : "Budget"} open count={p.min || p.max ? 1 : 0}>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((b) => {
            const on = String(b.min ?? "") === (p.min ?? "") && String(b.max ?? "") === (p.max ?? "");
            return (
              <Chip key={b.label} on={on} onClick={() => commit({ ...p, min: on ? undefined : b.min?.toString(), max: on ? undefined : b.max?.toString() })}>{b.label}</Chip>
            );
          })}
        </div>
        <form className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); applyBudget(); }}>
          <input aria-label="Minimum budget" value={minText} onChange={(e) => setMinText(e.target.value)} onBlur={applyBudget} placeholder={rent ? "Min e.g. 15k" : "Min e.g. 50L"} className="h-9 px-2.5 w-full rounded-[var(--radius-sm)] border border-line-2 bg-card placeholder:text-muted" />
          <span className="text-muted">to</span>
          <input aria-label="Maximum budget" value={maxText} onChange={(e) => setMaxText(e.target.value)} onBlur={applyBudget} placeholder={rent ? "Max e.g. 40k" : "Max e.g. 1.2Cr"} className="h-9 px-2.5 w-full rounded-[var(--radius-sm)] border border-line-2 bg-card placeholder:text-muted" />
          <button type="submit" className="sr-only">Apply budget</button>
        </form>
        {budgetErr && <p className="mt-1 text-xs text-danger" role="alert">{budgetErr}</p>}
      </Group>

      <Group title="Property type" open count={types.length}>
        <div className="flex flex-wrap gap-1.5">
          {(commercial ? COMM_TYPES : p.tx === "pg" ? PROPERTY_TYPES.filter((t) => t.value === "pg") : RESI_TYPES).map((t) => (
            <Chip key={t.value} on={types.includes(t.value)} onClick={() => toggle("type", t.value)}>{t.label}</Chip>
          ))}
        </div>
      </Group>

      {!noBhk && (
        <Group title="BHK" open count={list(p.bhk).length}>
          <div className="flex flex-wrap gap-1.5">
            {["1", "2", "3", "4", "5"].map((b) => (
              <Chip key={b} on={list(p.bhk).includes(b)} onClick={() => toggle("bhk", b)}>{b === "5" ? "5+ BHK" : `${b} BHK`}</Chip>
            ))}
          </div>
        </Group>
      )}

      <Group title="Area (sq ft)" count={p.amin || p.amax ? 1 : 0}>
        <form className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); applyArea(); }}>
          <input aria-label="Minimum area in sq ft" inputMode="numeric" value={amin} onChange={(e) => setAmin(e.target.value)} onBlur={applyArea} placeholder="Min" className="h-9 px-2.5 w-full rounded-[var(--radius-sm)] border border-line-2 bg-card placeholder:text-muted" />
          <span className="text-muted">to</span>
          <input aria-label="Maximum area in sq ft" inputMode="numeric" value={amax} onChange={(e) => setAmax(e.target.value)} onBlur={applyArea} placeholder="Max" className="h-9 px-2.5 w-full rounded-[var(--radius-sm)] border border-line-2 bg-card placeholder:text-muted" />
          <button type="submit" className="sr-only">Apply area</button>
        </form>
      </Group>

      <Group title="Posted by" open count={list(p.by).length}>
        <div className="flex flex-wrap gap-1.5">
          {POSTED_BY.map((b) => <Chip key={b.value} on={list(p.by).includes(b.value)} onClick={() => toggle("by", b.value)}>{b.label}</Chip>)}
        </div>
      </Group>

      {rent && (
        <>
          <Group title="Furnishing" open count={list(p.furn).length}>
            <div className="flex flex-wrap gap-1.5">
              {FURNISHING.map((f) => <Chip key={f.value} on={list(p.furn).includes(f.value)} onClick={() => toggle("furn", f.value)}>{f.label}</Chip>)}
            </div>
          </Group>
          <Group title={p.tx === "pg" ? "PG for" : "Tenant type"} open count={list(p.tenant).length}>
            <div className="flex flex-wrap gap-1.5">
              {TENANT_TYPES.filter((t) => (p.tx === "pg" ? ["girls", "boys"] : ["family", "bachelor", "company"]).includes(t.value)).map((t) => (
                <Chip key={t.value} on={list(p.tenant).includes(t.value)} onClick={() => toggle("tenant", t.value)}>{t.label}</Chip>
              ))}
            </div>
          </Group>
          <Group title="Available by" count={p.avail ? 1 : 0}>
            <div className="flex gap-1.5 flex-wrap">
              {[["Immediately", 0], ["In 15 days", 15], ["In 30 days", 30], ["In 60 days", 60]].map(([l, d]) => {
                const v = new Date(now + Number(d) * 86400000).toISOString().slice(0, 10);
                return <Chip key={l} on={p.avail === v} onClick={() => set("avail", p.avail === v ? undefined : v)}>{l}</Chip>;
              })}
            </div>
            <input type="date" aria-label="Available on or before" value={p.avail ?? ""} onChange={(e) => set("avail", e.target.value || undefined)} className="mt-2 h-9 px-2.5 w-full rounded-[var(--radius-sm)] border border-line-2 bg-card" />
          </Group>
        </>
      )}

      {!rent && (
        <Group title="Construction status" open count={[p.cs, p.poss, p.newlaunch, p.rera].filter(Boolean).length}>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={!p.cs} onClick={() => commit({ ...p, cs: undefined, poss: undefined })}>Any</Chip>
            <Chip on={p.cs === "ready"} onClick={() => commit({ ...p, cs: "ready", poss: undefined })}>Ready to move</Chip>
            <Chip on={p.cs === "under_construction"} onClick={() => set("cs", "under_construction")}>Under construction</Chip>
          </div>
          {p.cs === "under_construction" && (
            <label className="block mt-2.5">
              <span className="text-xs text-muted">Possession by</span>
              <select value={p.poss ?? ""} onChange={(e) => set("poss", e.target.value || undefined)} className="mt-1 w-full h-9 px-2.5 rounded-[var(--radius-sm)] border border-line-2 bg-card">
                <option value="">Any time</option>
                {Array.from({ length: 6 }, (_, i) => YEAR + i).map((y) => <option key={y} value={y}>By end of {y}</option>)}
              </select>
            </label>
          )}
          <div className="mt-2.5 space-y-0.5">
            <Check checked={p.newlaunch === "1"} onChange={() => flag("newlaunch")}>New launch</Check>
            <Check checked={p.rera === "1"} onChange={() => flag("rera")}>RERA approved</Check>
          </div>
        </Group>
      )}

      <Group title="Trust" open count={[p.verified, p.photos].filter(Boolean).length}>
        <div className="space-y-0.5">
          <Check checked={p.verified === "1"} onChange={() => flag("verified")}>Verified by 10cent only</Check>
          <Check checked={p.photos === "1"} onChange={() => flag("photos")}>With photos</Check>
        </div>
      </Group>

      <Group title="Amenities" count={list(p.am).length}>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {AMENITIES.filter((a) => a.filter).map((a) => <Check key={a.value} checked={list(p.am).includes(a.value)} onChange={() => toggle("am", a.value)}>{a.label}</Check>)}
        </div>
      </Group>

      <Group title="Near a landmark" open={!!p.near} count={p.near ? 1 : 0}>
        {nearOptions.length ? (
          <>
            <select aria-label="Landmark" value={nearKey} onChange={(e) => setNear(e.target.value, nearKm)} className="w-full h-9 px-2.5 rounded-[var(--radius-sm)] border border-line-2 bg-card">
              <option value="">Pick a metro, school or hospital</option>
              {nearGroups.map(([loc, opts]) => (
                <optgroup key={loc} label={loc}>
                  {opts.map((o) => <option key={`${o.lat},${o.lng}`} value={`${o.lat},${o.lng}`}>{o.name} · {LANDMARK_KIND_LABEL[o.kind] ?? o.kind}</option>)}
                </optgroup>
              ))}
            </select>
            <label className="block mt-2.5">
              <span className="flex justify-between text-xs text-muted"><span>Radius</span><span className="num text-ink">{nearKm} km</span></span>
              <input type="range" min={1} max={10} step={0.5} value={nearKm} disabled={!nearKey} onChange={(e) => setNear(nearKey, e.target.value)} className="w-full accent-[var(--color-ink)] disabled:opacity-40" />
            </label>
          </>
        ) : (
          <p className="text-xs text-muted">Choose a city or locality to search near its metro stations, schools and hospitals.</p>
        )}
      </Group>
    </div>
  );
}

function Group({ title, children, open, count = 0 }: { title: string; children: React.ReactNode; open?: boolean; count?: number }) {
  return (
    <details open={open || count > 0} className="group py-3.5 first:pt-0">
      <summary className="flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden mb-0 group-open:mb-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-2">{title}{count > 0 && <span className="ml-1.5 num text-accent-ink">{count}</span>}</span>
        <span className="text-muted text-lg leading-none group-open:rotate-45 transition-transform" aria-hidden>+</span>
      </summary>
      {children}
    </details>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cx("h-8 px-3 rounded-full border text-[12.5px] whitespace-nowrap", on ? "bg-ink text-white border-ink" : "bg-card border-line-2 text-ink-2 hover:border-ink hover:text-ink")}>
      {children}
    </button>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer text-[13px] text-ink-2 hover:text-ink">
      <input type="checkbox" checked={checked} onChange={onChange} className="w-4 h-4 accent-[var(--color-ink)]" />
      <span className="truncate">{children}</span>
    </label>
  );
}

/** Mobile: button that opens the filters in a full-screen drawer with a live result count. */
export function MobileFilters(props: Props & { activeCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SearchParamsObj>(props.params);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?count=1&${toQuery(draft, ["page", "view"])}`, { signal: ctrl.signal }).then((r) => r.json()).then((d) => setCount(d.total)).catch(() => {});
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [draft, open]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => { setDraft(props.params); setOpen(true); }} className={btnClass("secondary", "sm", "h-9")}>
        <SlidersHorizontal size={15} aria-hidden /> Filters{props.activeCount > 0 && <span className="num ml-0.5 bg-ink text-white text-[11px] rounded-full min-w-5 h-5 px-1.5 grid place-items-center">{props.activeCount}</span>}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Filters" className="fixed inset-0 z-[60] bg-card flex flex-col">
          <div className="flex items-center justify-between px-4 h-14 border-b border-line shrink-0">
            <span className="font-medium">Filters</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close filters" className="w-10 h-10 grid place-items-center rounded-full hover:bg-paper-2"><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
            <FilterPanel {...props} params={draft} autoApply={false} onChange={setDraft} />
          </div>
          <div className="shrink-0 border-t border-line p-3 grid grid-cols-[auto_1fr] gap-2 bg-card">
            <button type="button" onClick={() => { const keep: SearchParamsObj = { city: draft.city, tx: draft.tx, cat: draft.cat }; setDraft(keep); setOpen(false); router.push(hrefFor({ ...keep, view: props.params.view })); }} className={btnClass("secondary", "md")}>Clear all</button>
            <button type="button" onClick={() => { setOpen(false); router.push(hrefFor({ ...draft, view: props.params.view })); }} className={btnClass("accent", "md")}>
              {count == null ? "Show results" : count === 0 ? "No matches, adjust filters" : `Show ${formatINR(count)} ${count === 1 ? "property" : "properties"}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
