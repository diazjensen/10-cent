"use client";

import { useActionState, useState } from "react";
import type { ReqState } from "@/app/requirement/actions";
import { PROPERTY_TYPES } from "@/lib/constants";
import { Button, Input, Notice, Select, Textarea, cx } from "@/components/ui";

type City = { slug: string; name: string; localities: Array<{ id: number; name: string }> };

export function RequirementForm({ cities, defaultCity, action }: { cities: City[]; defaultCity: string; action: (s: ReqState, f: FormData) => Promise<ReqState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [tx, setTx] = useState("rent");
  const [city, setCity] = useState(defaultCity);
  const [locs, setLocs] = useState<number[]>([]);
  const fe = state.fieldErrors ?? {};
  const cur = cities.find((c) => c.slug === city);
  const err = (k: string) => (fe[k] ? <p className="text-xs text-danger mt-1">{fe[k]}</p> : null);
  return (
    <form action={formAction} className="bg-card border border-line rounded-[var(--radius-md)] p-5 md:p-6 space-y-5">
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2 mb-1.5">I want to</legend>
        <div className="inline-flex rounded-[var(--radius-sm)] border border-line-2 p-0.5">
          {[["sell", "Buy"], ["rent", "Rent"], ["pg", "PG / Co-living"]].map(([v, l]) => (
            <label key={v} className="cursor-pointer">
              <input type="radio" name="tx" value={v} checked={tx === v} onChange={() => setTx(v)} className="peer sr-only" />
              <span className="inline-flex h-8 px-3 items-center text-[13px] rounded-[4px] text-ink-2 peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{l}</span>
            </label>
          ))}
        </div>
        {err("tx")}
      </fieldset>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="rq-city" className="block text-[13px] font-medium text-ink-2 mb-1.5">City</label>
          <Select id="rq-city" name="city" value={city} onChange={(e) => { setCity(e.target.value); setLocs([]); }}>
            {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
          {err("city")}
        </div>
        <div>
          <label htmlFor="rq-type" className="block text-[13px] font-medium text-ink-2 mb-1.5">Property type</label>
          <Select id="rq-type" name="type" defaultValue="">
            <option value="">Any</option>
            {PROPERTY_TYPES.filter((p) => (tx === "pg" ? p.value === "pg" : p.value !== "pg")).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </div>
        <div>
          <label htmlFor="rq-bhk" className="block text-[13px] font-medium text-ink-2 mb-1.5">BHK</label>
          <Select id="rq-bhk" name="bhk" defaultValue="">
            <option value="">Any</option>
            {[1, 2, 3, 4].map((b) => <option key={b} value={b}>{b} BHK</option>)}<option value="5">5+ BHK</option>
          </Select>
        </div>
      </div>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2 mb-1.5">Localities <span className="font-normal text-muted">(optional, up to 8; leave empty for anywhere in {cur?.name})</span></legend>
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          {cur?.localities.map((l) => {
            const on = locs.includes(l.id);
            return (
              <label key={l.id} className="cursor-pointer">
                <input type="checkbox" name="loc" value={l.id} checked={on} onChange={() => setLocs((x) => (on ? x.filter((i) => i !== l.id) : x.length >= 8 ? x : [...x, l.id]))} className="peer sr-only" />
                <span className={cx("inline-flex h-8 px-3 items-center rounded-full border text-[13px] peer-focus-visible:outline-2 peer-focus-visible:outline-accent", on ? "bg-ink text-white border-ink" : "border-line bg-paper text-ink-2")}>{l.name}</span>
              </label>
            );
          })}
        </div>
        {err("loc")}
      </fieldset>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="rq-min" className="block text-[13px] font-medium text-ink-2 mb-1.5">Budget from <span className="font-normal text-muted">(optional)</span></label>
          <Input id="rq-min" name="budget_min" placeholder={tx === "sell" ? "e.g. 60L" : "e.g. 15000"} />
          {err("budget_min")}
        </div>
        <div>
          <label htmlFor="rq-max" className="block text-[13px] font-medium text-ink-2 mb-1.5">Budget up to</label>
          <Input id="rq-max" name="budget_max" placeholder={tx === "sell" ? "e.g. 1.2Cr" : "e.g. 35000"} />
          {err("budget_max")}
        </div>
      </div>
      <div>
        <label htmlFor="rq-notes" className="block text-[13px] font-medium text-ink-2 mb-1.5">Anything else <span className="font-normal text-muted">(optional)</span></label>
        <Textarea id="rq-notes" name="notes" rows={3} maxLength={600} placeholder="Near a metro station, pet friendly, need by 1 March, family of four…" />
        {err("notes")}
      </div>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Button type="submit" variant="accent" disabled={pending}>{pending ? "Posting…" : "Post requirement and see matches"}</Button>
    </form>
  );
}
