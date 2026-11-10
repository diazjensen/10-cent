"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveProjectAction } from "@/app/dashboard/projects/actions";
import { btnClass, cx, Input, Notice, Select, Textarea } from "@/components/ui";
import { AMENITIES, STATES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { EMPTY_PROJECT, type ProjectDraft, type TowerDraft, type UnitDraft } from "@/lib/supply/project-schema";
import { MapPicker } from "./map-picker";
import { FileUploader, PhotoUploader } from "./media-uploader";

type City = { id: number; name: string; state: string; lat: number; lng: number };
type Locality = { id: number; city_id: number; name: string; lat: number; lng: number };

export function ProjectForm({ cities, localities, initial, id }: { cities: City[]; localities: Locality[]; initial: ProjectDraft | null; id: number | null }) {
  const router = useRouter();
  const [d, setD] = useState<ProjectDraft>(initial ?? EMPTY_PROJECT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const clearErr = (...keys: string[]) =>
    setErrors((e) => {
      if (!keys.some((k) => e[k])) return e;
      const n = { ...e };
      keys.forEach((k) => delete n[k]);
      return n;
    });
  const set = <K extends keyof ProjectDraft>(k: K, v: ProjectDraft[K]) => {
    setD((p) => ({ ...p, [k]: v }));
    clearErr(k as string, ...(k === "city_id" || k === "locality_id" ? ["city_id", "locality_id", "lat"] : []));
  };
  const err = (k: string) => errors[k] ?? null;
  const cityLocs = useMemo(() => localities.filter((l) => String(l.city_id) === d.city_id), [localities, d.city_id]);

  const setTower = (i: number, k: keyof TowerDraft, v: string) => { set("towers", d.towers.map((t, j) => (j === i ? { ...t, [k]: v } : t))); clearErr(`towers.${i}.${k}`); };
  const setUnit = <K extends keyof UnitDraft>(i: number, k: K, v: UnitDraft[K]) => { set("unit_types", d.unit_types.map((u, j) => (j === i ? { ...u, [k]: v } : u))); clearErr(`unit_types.${i}.${String(k)}`); };
  const prices = d.unit_types.map((u) => Number(u.price.replace(/,/g, ""))).filter((n) => n > 0);
  const towerUnits = d.towers.reduce((a, t) => a + (Number(t.units) || 0), 0);

  const save = () =>
    start(async () => {
      setSaved(null);
      const r = await saveProjectAction(d, id);
      if (!r.ok) {
        setErrors(r.errors);
        requestAnimationFrame(() => document.querySelector("[data-err='1']")?.scrollIntoView({ behavior: "smooth", block: "center" }));
        return;
      }
      setErrors({});
      if (r.created) router.push(`/dashboard/projects?created=${r.id}`);
      else { setSaved("Changes saved."); router.refresh(); }
    });

  const nums = (v: string) => v.replace(/[^\d.]/g, "");

  return (
    <div className="space-y-6 pb-24">
      {Object.keys(errors).length > 0 && <Notice tone="danger">{errors.form ?? `Please fix ${Object.keys(errors).length} highlighted field${Object.keys(errors).length > 1 ? "s" : ""}.`}</Notice>}

      <Section title="Basics">
        <div className="grid sm:grid-cols-2 gap-4">
          <F label="Project name" e={err("name")}><Input value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={80} /></F>
          <F label="Status" e={err("status")}>
            <Select value={d.status} onChange={(e) => set("status", e.target.value)}>
              <option value="new_launch">New launch</option>
              <option value="under_construction">Under construction</option>
              <option value="ready">Ready to move</option>
            </Select>
          </F>
          <F label="Launch date" e={err("launch_date")}><Input type="date" value={d.launch_date} onChange={(e) => set("launch_date", e.target.value)} /></F>
          <F label="Possession date" e={err("possession_date")} hint="as per RERA"><Input type="date" value={d.possession_date} onChange={(e) => set("possession_date", e.target.value)} /></F>
          <F label="RERA registration number" e={err("rera_id")} hint={d.status === "ready" ? "optional once complete" : "required"}><Input value={d.rera_id} onChange={(e) => set("rera_id", e.target.value.toUpperCase())} placeholder="PRM/KA/RERA/1251/309/PR/..." /></F>
          <F label="RERA state" e={err("rera_state")}>
            <Select value={d.rera_state} onChange={(e) => set("rera_state", e.target.value)}>
              <option value="">Select state</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </F>
          <F label="Land area (acres)" e={err("land_area_acres")}><Input inputMode="decimal" value={d.land_area_acres} onChange={(e) => set("land_area_acres", nums(e.target.value))} /></F>
          <F label="Total units" e={err("total_units")} hint={towerUnits ? `towers add up to ${towerUnits}` : undefined}><Input inputMode="numeric" value={d.total_units} placeholder={towerUnits ? String(towerUnits) : ""} onChange={(e) => set("total_units", nums(e.target.value))} /></F>
        </div>
      </Section>

      <Section title="Location">
        <div className="grid sm:grid-cols-2 gap-4">
          <F label="City" e={err("city_id")}>
            <Select value={d.city_id} onChange={(e) => { const c = cities.find((x) => String(x.id) === e.target.value); clearErr("city_id", "locality_id", "lat"); setD((p) => ({ ...p, city_id: e.target.value, locality_id: "", lat: c?.lat ?? null, lng: c?.lng ?? null, rera_state: p.rera_state || c?.state || "" })); }}>
              <option value="">Select city</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </F>
          <F label="Locality" e={err("locality_id")}>
            <Select value={d.locality_id} onChange={(e) => { const l = localities.find((x) => String(x.id) === e.target.value); clearErr("locality_id", "lat"); setD((p) => ({ ...p, locality_id: e.target.value, lat: l?.lat ?? p.lat, lng: l?.lng ?? p.lng })); }}>
              <option value="">Select locality</option>
              {cityLocs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </F>
          <F label="Site address" e={err("address")} className="sm:col-span-2"><Input value={d.address} onChange={(e) => set("address", e.target.value)} maxLength={250} /></F>
        </div>
        <div className="h-64 rounded-[var(--radius-md)] overflow-hidden border border-line relative z-0">
          {d.lat != null && d.lng != null ? (
            <MapPicker lat={d.lat} lng={d.lng} centerKey={`${d.city_id}-${d.locality_id}`} onChange={(lat, lng) => setD((p) => ({ ...p, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }))} />
          ) : <div className="h-full grid place-items-center text-sm text-muted bg-paper-2">Choose a city to place the pin</div>}
        </div>
        {err("lat") && <p className="text-xs text-danger" data-err="1">{err("lat")}</p>}
      </Section>

      <Section title="Towers" sub="Construction progress per tower is shown on the project page.">
        {err("towers") && <p className="text-xs text-danger" data-err="1">{err("towers")}</p>}
        <div className="space-y-3">
          {d.towers.map((t, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 items-end border-b border-line pb-3 last:border-0">
              <F label="Tower / block" e={err(`towers.${i}.name`)} className="col-span-2 sm:col-span-1"><Input value={t.name} onChange={(e) => setTower(i, "name", e.target.value)} /></F>
              <F label="Floors" e={err(`towers.${i}.floors`)}><Input inputMode="numeric" value={t.floors} onChange={(e) => setTower(i, "floors", nums(e.target.value))} /></F>
              <F label="Units" e={err(`towers.${i}.units`)}><Input inputMode="numeric" value={t.units} onChange={(e) => setTower(i, "units", nums(e.target.value))} /></F>
              <F label="Complete %" e={err(`towers.${i}.completion_pct`)}><Input inputMode="numeric" value={t.completion_pct} onChange={(e) => setTower(i, "completion_pct", nums(e.target.value))} /></F>
              <RowDel onClick={() => set("towers", d.towers.filter((_, j) => j !== i))} disabled={d.towers.length === 1} label={`Remove ${t.name || "tower"}`} />
            </div>
          ))}
        </div>
        <AddBtn onClick={() => set("towers", [...d.towers, { name: `Tower ${String.fromCharCode(65 + d.towers.length)}`, floors: "", units: "", completion_pct: "0" }])}>Add tower</AddBtn>
      </Section>

      <Section title="Unit types and price list" sub={prices.length ? `Price range shown to buyers: ${formatPrice(Math.min(...prices))} – ${formatPrice(Math.max(...prices))} (calculated from the unit types)` : "The project's price range is calculated from these."}>
        {err("unit_types") && <p className="text-xs text-danger" data-err="1">{err("unit_types")}</p>}
        <div className="space-y-4">
          {d.unit_types.map((u, i) => (
            <div key={i} className="border border-line rounded-[var(--radius-md)] p-3.5 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end">
                <F label="Label" e={err(`unit_types.${i}.label`)}><Input value={u.label} onChange={(e) => setUnit(i, "label", e.target.value)} /></F>
                <F label="BHK" e={err(`unit_types.${i}.bhk`)}><Input inputMode="numeric" value={u.bhk} onChange={(e) => setUnit(i, "bhk", nums(e.target.value))} /></F>
                <F label="Carpet sq ft" e={err(`unit_types.${i}.carpet_area`)}><Input inputMode="numeric" value={u.carpet_area} onChange={(e) => setUnit(i, "carpet_area", nums(e.target.value))} /></F>
                <F label="Super sq ft" e={err(`unit_types.${i}.super_area`)}><Input inputMode="numeric" value={u.super_area} onChange={(e) => setUnit(i, "super_area", nums(e.target.value))} /></F>
                <F label="Price (₹)" e={err(`unit_types.${i}.price`)} hint={Number(u.price) ? formatPrice(Number(u.price)) : undefined}><Input inputMode="numeric" value={u.price} onChange={(e) => setUnit(i, "price", nums(e.target.value))} /></F>
                <F label="Available" e={err(`unit_types.${i}.available_units`)}><Input inputMode="numeric" value={u.available_units} onChange={(e) => setUnit(i, "available_units", nums(e.target.value))} /></F>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
                <FileUploader id={`fp-${i}`} kind="image_or_pdf" label="Floor plan" hint="Image or PDF" value={u.floor_plan} onChange={(v) => setUnit(i, "floor_plan", v)} />
                <RowDel onClick={() => set("unit_types", d.unit_types.filter((_, j) => j !== i))} disabled={d.unit_types.length === 1} label={`Remove ${u.label || "unit type"}`} />
              </div>
            </div>
          ))}
        </div>
        <AddBtn onClick={() => set("unit_types", [...d.unit_types, { label: "", bhk: "", carpet_area: "", super_area: "", price: "", available_units: "", floor_plan: null }])}>Add unit type</AddBtn>
      </Section>

      <Section title="Amenities">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {AMENITIES.map((a) => {
            const on = d.amenities.includes(a.value);
            return (
              <label key={a.value} className={cx("flex items-center gap-2 h-10 px-3 rounded-[var(--radius-sm)] border text-sm cursor-pointer", on ? "border-ink bg-paper-2" : "border-line")}>
                <input type="checkbox" checked={on} onChange={() => set("amenities", on ? d.amenities.filter((x) => x !== a.value) : [...d.amenities, a.value])} className="w-4 h-4 accent-[var(--color-ink)]" /> {a.label}
              </label>
            );
          })}
        </div>
      </Section>

      <Section title="Location advantages" sub="Metro stations, schools, hospitals, offices and the airport, with distance.">
        <div className="space-y-2">
          {d.location_advantages.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_110px_auto] gap-2 items-end">
              <F label={i === 0 ? "Place" : ""} e={err(`location_advantages.${i}.name`)}><Input aria-label="Place" value={a.name} placeholder="e.g. Yelahanka Metro Station" onChange={(e) => set("location_advantages", d.location_advantages.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></F>
              <F label={i === 0 ? "Distance" : ""} e={err(`location_advantages.${i}.distance`)}><Input aria-label="Distance" value={a.distance} placeholder="2.5 km" onChange={(e) => set("location_advantages", d.location_advantages.map((x, j) => (j === i ? { ...x, distance: e.target.value } : x)))} /></F>
              <RowDel onClick={() => set("location_advantages", d.location_advantages.filter((_, j) => j !== i))} label="Remove place" />
            </div>
          ))}
        </div>
        <AddBtn onClick={() => set("location_advantages", [...d.location_advantages, { name: "", distance: "" }])}>Add place</AddBtn>
      </Section>

      <Section title="Photos, brochure and master plan">
        <PhotoUploader id="project-photos" photos={d.photos} onChange={(p) => set("photos", p)} max={30} label="Add project photos" />
        <div className="grid md:grid-cols-2 gap-3">
          <FileUploader id="brochure" kind="pdf" label="Brochure (PDF)" hint="Buyers download this after an enquiry" value={d.brochure} onChange={(v) => set("brochure", v)} />
          <FileUploader id="master_plan" kind="image_or_pdf" label="Master plan" hint="Image or PDF" value={d.master_plan} onChange={(v) => set("master_plan", v)} />
        </div>
      </Section>

      <Section title="Description">
        <F label="About the project" e={err("description")}><Textarea rows={7} value={d.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} placeholder="Site plan, construction quality, open space, clubhouse, payment plans, approvals and bank tie-ups…" /></F>
        <p className="text-xs text-muted -mt-2 num">{d.description.length}/5000</p>
      </Section>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-line">
        <div className="mx-auto max-w-[1240px] px-4 md:px-6 h-16 flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-trust" role="status">{saved}</span>}
          {Object.keys(errors).length > 0 && <span className="text-sm text-danger hidden sm:inline">Fix the highlighted fields</span>}
          <button type="button" onClick={save} disabled={pending} className={btnClass("accent", "md")}>{pending ? "Saving…" : id ? "Save changes" : "Submit for approval"}</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-line rounded-[var(--radius-md)] p-4 md:p-6 space-y-4">
      <div>
        <h2 className="font-display text-2xl">{title}</h2>
        {sub && <p className="text-sm text-muted mt-0.5">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

/** Field with an implicit <label> wrapper so every input is announced with its label. */
function F({ label, e, hint, className, children }: { label: string; e: string | null; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className} data-err={e ? "1" : undefined}>
      <label className="block">
        {label && (
          <span className="block text-[13px] font-medium text-ink-2 mb-1.5">
            {label}
            {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
          </span>
        )}
        {children}
      </label>
      {e && <p className="mt-1 text-xs text-danger">{e}</p>}
    </div>
  );
}

function RowDel({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="h-10 w-10 grid place-items-center rounded-[var(--radius-sm)] text-muted hover:text-danger hover:bg-paper-2 disabled:opacity-30">
      <Trash2 size={16} />
    </button>
  );
}

function AddBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={btnClass("secondary", "sm")}>
      <Plus size={14} /> {children}
    </button>
  );
}
