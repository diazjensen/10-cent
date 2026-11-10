"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { estimateValue } from "@/lib/tools/valuation";
import { formatINR } from "@/lib/format";
import { Card, Select, cx } from "@/components/ui";
import { NumField, Segmented, ResultRow, inWords } from "./fields";

type Loc = { id: number; name: string; city: string; psf: number | null };

export type ValuationParams = { city: string; loc: number; bhk: number; area: number; age: number; floor: number; tf: number; furn: "unfurnished" | "semi" | "furnished" };

export function ValuationForm({ cities, locs, initial }: { cities: Array<{ slug: string; name: string }>; locs: Loc[]; initial: ValuationParams }) {
  const router = useRouter();
  const [p, setP] = useState<ValuationParams>(initial);
  const set = <K extends keyof ValuationParams>(k: K, v: ValuationParams[K]) => setP((x) => ({ ...x, [k]: v }));
  const cityLocs = locs.filter((l) => l.city === p.city);
  const loc = cityLocs.find((l) => l.id === p.loc) ?? cityLocs[0];

  // Keep the URL in sync so the server can render comparable listings for these inputs.
  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ city: p.city, loc: String(loc?.id ?? ""), bhk: String(p.bhk), area: String(p.area), age: String(p.age), floor: String(p.floor), tf: String(p.tf), furn: p.furn });
      router.replace(`/tools/valuation?${qs}`, { scroll: false });
    }, 450);
    return () => clearTimeout(t);
  }, [p, loc?.id, router]);

  const est = loc?.psf ? estimateValue({ basePsf: loc.psf, area: p.area, bhk: p.bhk, ageYears: p.age, floor: p.floor, totalFloors: p.tf, furnishing: p.furn }) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
      <Card className="p-5 md:p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="v-city" className="block text-[13px] font-medium text-ink-2 mb-1.5">City</label>
            <Select id="v-city" value={p.city} onChange={(e) => { const c = e.target.value; setP((x) => ({ ...x, city: c, loc: locs.find((l) => l.city === c)?.id ?? 0 })); }}>
              {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <label htmlFor="v-loc" className="block text-[13px] font-medium text-ink-2 mb-1.5">Locality</label>
            <Select id="v-loc" value={loc?.id ?? ""} onChange={(e) => set("loc", Number(e.target.value))}>
              {cityLocs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </div>
        </div>
        <Segmented label="Configuration" value={String(p.bhk)} onChange={(v) => set("bhk", Number(v))} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: n === 5 ? "5+ BHK" : `${n} BHK` }))} />
        <NumField label="Super built-up area" value={p.area} onChange={(n) => set("area", n)} suffix="sq ft" step={10} />
        <div className="grid grid-cols-3 gap-3">
          <NumField label="Age" value={p.age} onChange={(n) => set("age", n)} suffix="yrs" />
          <NumField label="Floor" value={p.floor} onChange={(n) => set("floor", n)} hint="0 = ground" />
          <NumField label="of floors" value={p.tf} onChange={(n) => set("tf", n)} />
        </div>
        <Segmented label="Furnishing" value={p.furn} onChange={(v) => set("furn", v)} options={[{ value: "unfurnished", label: "Unfurnished" }, { value: "semi", label: "Semi" }, { value: "furnished", label: "Furnished" }]} />
      </Card>
      <div className="space-y-4 min-w-0">
        {!est || p.area <= 0 ? (
          <Card className="p-6 text-sm text-muted">{loc?.psf ? "Enter the area to see an estimate." : "We don't have a price index for this locality yet."}</Card>
        ) : (
          <>
            <Card className="p-5 md:p-6 bg-ink text-white border-ink">
              <div className="text-xs text-white/60">Estimated market value · {loc?.name}</div>
              <div className="num text-[34px] md:text-[42px] font-semibold tracking-tight leading-tight mt-1">{inWords(est.low)} – {inWords(est.high)}</div>
              <div className="num text-sm text-white/70 mt-1">Mid-point {inWords(est.mid)} · ₹{formatINR(Math.round(est.psf))}/sq ft</div>
            </Card>
            <Card className="p-5 md:p-6">
              <h2 className="font-medium mb-1">How we got here</h2>
              <ResultRow label="Locality average rate" sub="10cent price index, latest month" value={`₹${formatINR(loc!.psf!)}/sq ft`} />
              {est.adjustments.map((a) => (
                <ResultRow key={a.label} label={a.label} sub={a.reason} value={<span className={cx(a.pct > 0 && "text-trust", a.pct < 0 && "text-danger")}>{a.pct > 0 ? "+" : a.pct < 0 ? "−" : "±"}{Math.abs(a.pct)}%</span>} />
              ))}
              <ResultRow label="Adjusted rate" value={`₹${formatINR(Math.round(est.psf))}/sq ft`} strong />
              <ResultRow label={`× ${formatINR(p.area)} sq ft`} sub="Range is ±7% for condition, view, facing and negotiation" value={inWords(est.mid)} />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
