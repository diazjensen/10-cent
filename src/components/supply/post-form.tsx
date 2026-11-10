"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Info, LocateFixed, RotateCcw } from "lucide-react";
import { submitListingAction } from "@/app/post-property/actions";
import { btnClass, cx, Input, Select, Textarea } from "@/components/ui";
import { Field } from "./field";
import { AMENITIES, AMENITY_LABEL, FACING, FURNISHING, FURNISHING_LABEL, MAX_PHOTOS, PROPERTY_TYPE_LABEL, TENANT_TYPES } from "@/lib/constants";
import { formatINR, formatPrice } from "@/lib/format";
import {
  EMPTY_DRAFT, FIELD_STEP, isCommercialBuilt, isHome, PG_SHARING, stripContactInfo, TYPES_FOR, validateStep, type ListingDraft,
} from "@/lib/supply/listing-schema";
import { MapPicker } from "./map-picker";
import { FileUploader, PhotoUploader } from "./media-uploader";

type City = { id: number; name: string; state: string; lat: number; lng: number };
type Locality = { id: number; city_id: number; name: string; lat: number; lng: number };
type Avg = { psf: number; rent2: number };

const STEPS = ["Basics", "Location", "Details", "Price", "Amenities", "Photos", "Review"] as const;

export function PostForm({
  cities, localities, averages, initial, editId, quota,
}: {
  cities: City[];
  localities: Locality[];
  averages: Record<number, Avg>;
  initial: ListingDraft | null;
  editId: number | null;
  quota: { used: number; limit: number; planName: string | null };
}) {
  const router = useRouter();
  const storageKey = editId ? `tc_post_edit_${editId}` : "tc_post_draft_v1";
  const [d, setD] = useState<ListingDraft>(initial ?? EMPTY_DRAFT);
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(editId ? STEPS.length : 1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [restored, setRestored] = useState(false);
  const [limitHit, setLimitHit] = useState<{ used: number; limit: number } | null>(null);
  const [pending, start] = useTransition();
  const loaded = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  // Restore draft once on mount (client only, avoids hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { d: ListingDraft; step: number; maxStep: number };
        if (saved?.d) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from localStorage
          setD({ ...EMPTY_DRAFT, ...saved.d });
          setStep(Math.min(Math.max(1, saved.step || 1), STEPS.length));
          setMaxStep(Math.max(saved.maxStep || 1, editId ? STEPS.length : 1));
          setRestored(true);
        }
      }
    } catch {}
    loaded.current = true;
  }, [storageKey, editId]);

  // Persist draft on every change.
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify({ d, step, maxStep, at: Date.now() })); } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [d, step, maxStep, storageKey]);

  const set = <K extends keyof ListingDraft>(k: K, v: ListingDraft[K]) => {
    setD((prev) => ({ ...prev, [k]: v }));
    if (errors[k as string]) setErrors((e) => { const n = { ...e }; delete n[k as string]; return n; });
  };
  const toggleIn = (k: "tenant_types" | "pg_sharing" | "amenities", v: string) =>
    set(k, (d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v]) as ListingDraft[typeof k]);

  const cityLocs = useMemo(() => localities.filter((l) => String(l.city_id) === d.city_id), [localities, d.city_id]);
  const loc = localities.find((l) => String(l.id) === d.locality_id);
  const city = cities.find((c) => String(c.id) === d.city_id);
  const types = TYPES_FOR[d.transaction_type]?.[d.category] ?? [];
  const t = d.property_type;

  const go = (n: number) => {
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const next = () => {
    const errs = validateStep(step, d);
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-error='true']")?.focus());
      return;
    }
    go(step + 1);
  };

  const submit = () => {
    const all: Record<string, string> = {};
    for (let s = 1; s <= STEPS.length; s++) Object.assign(all, validateStep(s, d));
    if (Object.keys(all).length) {
      setErrors(all);
      const first = Math.min(...Object.keys(all).map((k) => FIELD_STEP[k] ?? 7));
      if (first !== step) go(first);
      return;
    }
    start(async () => {
      const res = await submitListingAction(d, editId);
      if (res.ok) {
        try { localStorage.removeItem(storageKey); } catch {}
        router.push(`/post-property/success?id=${res.id}${editId ? "&edited=1" : ""}${res.flagged ? "&flagged=1" : ""}`);
        return;
      }
      if (res.needLogin) { router.push(`/login?next=${encodeURIComponent(editId ? `/post-property?edit=${editId}` : "/post-property")}`); return; }
      setErrors(res.errors);
      if (res.limit) setLimitHit(res.limit);
      const fieldSteps = Object.keys(res.errors).filter((k) => k !== "form").map((k) => FIELD_STEP[k] ?? 7);
      if (fieldSteps.length) go(Math.min(...fieldSteps));
    });
  };

  const startOver = () => {
    try { localStorage.removeItem(storageKey); } catch {}
    setD(initial ?? EMPTY_DRAFT); setStep(1); setMaxStep(editId ? STEPS.length : 1); setErrors({}); setRestored(false);
  };

  // Price insight (step 4)
  const priceNum = Number(d.price.replace(/,/g, "")) || 0;
  const areaNum = Number(d.carpet_area || d.super_area || d.builtup_area || d.plot_area) || 0;
  const avg = loc ? averages[loc.id] : undefined;

  const err = (k: string) => errors[k] ?? null;
  const overLimit = !editId && quota.used >= quota.limit;

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* Stepper */}
      <div className="bg-card border border-line rounded-[var(--radius-md)] p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Step <span className="num">{step}</span> of {STEPS.length}</p>
          <p className="text-xs text-muted hidden sm:block">Draft saves automatically on this device</p>
        </div>
        <div className="mt-3 h-1.5 bg-paper-2 rounded-full overflow-hidden" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step} aria-label="Form progress">
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${(step / STEPS.length) * 100}%` }} />
        </div>
        <ol className="mt-3 flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const reachable = n <= maxStep;
            return (
              <li key={s} className="shrink-0">
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => go(n)}
                  aria-current={n === step ? "step" : undefined}
                  className={cx(
                    "flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[13px] border transition-colors",
                    n === step ? "bg-ink text-white border-ink" : reachable ? "border-line-2 text-ink-2 hover:border-ink" : "border-transparent text-muted"
                  )}
                >
                  <span className={cx("w-4 h-4 grid place-items-center rounded-full text-[10px] font-bold num", n === step ? "bg-white text-ink" : n < maxStep || (reachable && n !== step) ? "bg-trust text-white" : "bg-paper-2")}>
                    {n < step ? <Check size={10} strokeWidth={3} /> : n}
                  </span>
                  {s}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {restored && (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm bg-paper-2 border border-line rounded-[var(--radius-sm)] px-3.5 py-2" role="status">
          <span className="text-ink-2">We restored your unsaved draft.</span>
          <button type="button" onClick={startOver} className="inline-flex items-center gap-1 text-xs font-medium text-ink hover:underline"><RotateCcw size={12} /> Start over</button>
        </div>
      )}

      {(overLimit || limitHit) && (
        <div className="mt-3 border border-accent/30 bg-accent-soft rounded-[var(--radius-md)] p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="font-medium text-accent-ink">You&apos;ve used <span className="num">{(limitHit ?? quota).used}</span> of <span className="num">{(limitHit ?? quota).limit}</span> listings on {quota.planName ?? "the free plan"}.</p>
            <p className="text-sm text-ink-2 mt-0.5">Upgrade to post more, or pause/close a listing you no longer need. Your draft stays saved.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/dashboard/listings" className={btnClass("secondary", "sm")}>Manage listings</Link>
            <Link href="/plans" className={btnClass("accent", "sm")}>See plans</Link>
          </div>
        </div>
      )}

      {errors.form && !limitHit && <p role="alert" className="mt-3 text-sm text-danger bg-danger-soft border border-danger/20 rounded-[var(--radius-sm)] px-3.5 py-2.5">{errors.form}</p>}

      <div className="mt-4 bg-card border border-line rounded-[var(--radius-md)] p-4 md:p-6">
        {step === 1 && (
          <StepWrap title="What are you listing?" sub="Choose the deal, the kind of property and the city.">
            <Group label="I want to" error={err("transaction_type")}>
              <Seg
                value={d.transaction_type}
                options={[{ value: "sell", label: "Sell" }, { value: "rent", label: "Rent out / Lease" }, { value: "pg", label: "List a PG" }]}
                onChange={(v) => {
                  const tx = v as ListingDraft["transaction_type"];
                  const cat = tx === "pg" ? "residential" : d.category;
                  const allowed = TYPES_FOR[tx][cat];
                  setD((p) => ({ ...p, transaction_type: tx, category: cat, property_type: allowed.includes(p.property_type) ? p.property_type : allowed[0] }));
                }}
              />
            </Group>
            {d.transaction_type !== "pg" && (
              <Group label="Property category">
                <Seg
                  value={d.category}
                  options={[{ value: "residential", label: "Residential" }, { value: "commercial", label: "Commercial" }]}
                  onChange={(v) => {
                    const cat = v as ListingDraft["category"];
                    const allowed = TYPES_FOR[d.transaction_type][cat];
                    setD((p) => ({ ...p, category: cat, property_type: allowed.includes(p.property_type) ? p.property_type : allowed[0] }));
                  }}
                />
              </Group>
            )}
            <Group label="Property type" error={err("property_type")}>
              <Seg value={t} options={types.map((x) => ({ value: x, label: x === "plot" && d.category === "commercial" ? "Commercial land" : PROPERTY_TYPE_LABEL[x] }))} onChange={(v) => set("property_type", v)} />
            </Group>
            <Field label="City" error={err("city_id")} className="max-w-sm">
              <Select
                id="city_id"
                value={d.city_id}
                data-error={!!err("city_id")}
                onChange={(e) => {
                  const c = cities.find((x) => String(x.id) === e.target.value);
                  setD((p) => ({ ...p, city_id: e.target.value, locality_id: "", lat: c?.lat ?? null, lng: c?.lng ?? null }));
                }}
              >
                <option value="">Select city</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </StepWrap>
        )}

        {step === 2 && (
          <StepWrap title="Where is it?" sub={`Pick the locality in ${city?.name ?? "your city"}, then drop the pin on the exact building.`}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Locality" error={err("locality_id")}>
                <Select
                  id="locality_id"
                  value={d.locality_id}
                  data-error={!!err("locality_id")}
                  onChange={(e) => {
                    const l = localities.find((x) => String(x.id) === e.target.value);
                    setD((p) => ({ ...p, locality_id: e.target.value, lat: l?.lat ?? p.lat, lng: l?.lng ?? p.lng }));
                    setErrors((er) => { const n = { ...er }; delete n.locality_id; delete n.lat; return n; });
                  }}
                >
                  <option value="">Select locality</option>
                  {cityLocs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </Select>
              </Field>
              <Field label="Society / building and street" error={err("address")}>
                <Input id="address" value={d.address} data-error={!!err("address")} onChange={(e) => set("address", e.target.value)} placeholder="e.g. Prestige Lakeside Habitat, Varthur Road" maxLength={200} />
              </Field>
            </div>
            <div>
              <div className="flex items-end justify-between gap-3 mb-1.5">
                <span className="text-[13px] font-medium text-ink-2">Map pin</span>
                {loc && (
                  <button type="button" onClick={() => setD((p) => ({ ...p, lat: loc.lat, lng: loc.lng }))} className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink">
                    <LocateFixed size={12} /> Reset to {loc.name}
                  </button>
                )}
              </div>
              <div className="h-72 sm:h-80 rounded-[var(--radius-md)] overflow-hidden border border-line relative z-0">
                {d.lat != null && d.lng != null ? (
                  <MapPicker lat={d.lat} lng={d.lng} centerKey={`${d.city_id}-${d.locality_id}`} onChange={(lat, lng) => { setD((p) => ({ ...p, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 })); }} />
                ) : (
                  <div className="h-full grid place-items-center text-sm text-muted bg-paper-2">Choose a city first</div>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted">Click the map or drag the pin. <span className="num">{d.lat != null ? `${d.lat.toFixed(5)}, ${d.lng?.toFixed(5)}` : ""}</span> Exact location is only shown to seekers as an approximate area.</p>
              {err("lat") && <p className="mt-1 text-xs text-danger">{err("lat")}</p>}
            </div>
          </StepWrap>
        )}

        {step === 3 && (
          <StepWrap title="Property details" sub="Accurate details get more genuine enquiries.">
            {isHome(t) && (
              <>
                <Group label="Bedrooms" error={err("bhk")}>
                  <Seg value={d.bhk} options={["1", "2", "3", "4", "5", "6"].map((n) => ({ value: n, label: n === "6" ? "5+ BHK" : `${n} BHK` }))} onChange={(v) => set("bhk", v)} />
                </Group>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <Field label="Bathrooms" error={err("bathrooms")}>
                    <Select id="bathrooms" value={d.bathrooms} data-error={!!err("bathrooms")} onChange={(e) => set("bathrooms", e.target.value)}>
                      <option value="">Select</option>
                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </Field>
                  <Field label="Balconies" error={err("balconies")}>
                    <Select id="balconies" value={d.balconies} onChange={(e) => set("balconies", e.target.value)}>
                      <option value="">Select</option>
                      {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </Field>
                </div>
              </>
            )}
            {(isCommercialBuilt(t) || t === "pg") && (
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <Field label={t === "pg" ? "Bathrooms (total)" : "Washrooms"} error={err("bathrooms")}>
                  <Select id="bathrooms" value={d.bathrooms} onChange={(e) => set("bathrooms", e.target.value)}>
                    <option value="">Select</option>
                    {[0, 1, 2, 3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </Field>
              </div>
            )}

            <div>
              <p className="text-[13px] font-medium text-ink-2 mb-1.5">Area <span className="font-normal text-muted">in sq ft</span></p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {t !== "plot" && (
                  <>
                    <NumInput id="carpet_area" label="Carpet" value={d.carpet_area} onChange={(v) => set("carpet_area", v)} error={err("carpet_area")} />
                    <NumInput id="builtup_area" label="Built-up" value={d.builtup_area} onChange={(v) => set("builtup_area", v)} error={err("builtup_area")} />
                    <NumInput id="super_area" label="Super built-up" value={d.super_area} onChange={(v) => set("super_area", v)} error={err("super_area")} />
                  </>
                )}
                {(t === "plot" || t === "house" || t === "villa") && (
                  <NumInput id="plot_area" label="Plot area" value={d.plot_area} onChange={(v) => set("plot_area", v)} error={err("plot_area")} />
                )}
              </div>
            </div>

            {t !== "plot" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <NumInput id="floor" label={t === "apartment" || isCommercialBuilt(t) ? "Floor number" : "Floor (optional)"} value={d.floor} onChange={(v) => set("floor", v)} error={err("floor")} hint="0 = ground" />
                <NumInput id="total_floors" label="Total floors" value={d.total_floors} onChange={(v) => set("total_floors", v)} error={err("total_floors")} />
                <Field label="Facing" error={err("facing")}>
                  <Select id="facing" value={d.facing} onChange={(e) => set("facing", e.target.value)}>
                    <option value="">Not specified</option>
                    {FACING.map((f) => <option key={f} value={f}>{f}</option>)}
                  </Select>
                </Field>
              </div>
            )}
            {t === "plot" && (
              <Field label="Facing" className="max-w-xs">
                <Select id="facing" value={d.facing} onChange={(e) => set("facing", e.target.value)}>
                  <option value="">Not specified</option>
                  {FACING.map((f) => <option key={f} value={f}>{f}</option>)}
                </Select>
              </Field>
            )}

            {d.transaction_type === "sell" && t !== "plot" && (
              <>
                <Group label="Construction status" error={err("construction_status")}>
                  <Seg value={d.construction_status} options={[{ value: "ready", label: "Ready to move" }, { value: "under_construction", label: "Under construction" }]} onChange={(v) => set("construction_status", v)} />
                </Group>
                {d.construction_status === "under_construction" ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Expected possession" error={err("possession_date")}>
                      <Input id="possession_date" type="month" value={d.possession_date.slice(0, 7)} data-error={!!err("possession_date")} onChange={(e) => set("possession_date", e.target.value)} />
                    </Field>
                    <Field label="RERA registration number" error={err("rera_id")} hint={d.category === "residential" ? "required" : "optional"}>
                      <Input id="rera_id" value={d.rera_id} data-error={!!err("rera_id")} onChange={(e) => set("rera_id", e.target.value.toUpperCase())} placeholder="e.g. PRM/KA/RERA/1251/446/PR/171015/000712" />
                    </Field>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <NumInput id="age_years" label="Age of property (years)" value={d.age_years} onChange={(v) => set("age_years", v)} error={err("age_years")} />
                    <Field label="RERA number" hint="optional" error={err("rera_id")}>
                      <Input id="rera_id" value={d.rera_id} onChange={(e) => set("rera_id", e.target.value.toUpperCase())} />
                    </Field>
                  </div>
                )}
              </>
            )}
            {d.transaction_type !== "sell" && t !== "pg" && (
              <NumInput id="age_years" label="Age of property (years)" value={d.age_years} onChange={(v) => set("age_years", v)} error={err("age_years")} className="max-w-xs" />
            )}

            {t !== "plot" && (
              <Group label="Furnishing" error={err("furnishing")}>
                <Seg value={d.furnishing} options={FURNISHING.map((f) => ({ value: f.value, label: f.label }))} onChange={(v) => set("furnishing", v)} allowEmpty />
              </Group>
            )}

            {d.transaction_type === "rent" && (
              <>
                {isHome(t) && (
                  <Group label="Preferred tenants" error={err("tenant_types")}>
                    <Multi values={d.tenant_types} options={TENANT_TYPES.filter((x) => ["family", "bachelor", "company"].includes(x.value))} onToggle={(v) => toggleIn("tenant_types", v)} />
                  </Group>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Available from" error={err("available_from")}>
                    <Input id="available_from" type="date" value={d.available_from} data-error={!!err("available_from")} onChange={(e) => set("available_from", e.target.value)} />
                  </Field>
                  <NumInput id="deposit" label="Security deposit (₹)" value={d.deposit} onChange={(v) => set("deposit", v)} error={err("deposit")} money />
                </div>
              </>
            )}

            {d.transaction_type === "pg" && (
              <>
                <Group label="PG is for" error={err("tenant_types")}>
                  <Multi values={d.tenant_types} options={TENANT_TYPES.filter((x) => ["girls", "boys"].includes(x.value)).map((x) => ({ value: x.value, label: x.value === "girls" ? "Girls" : "Boys" }))} onToggle={(v) => toggleIn("tenant_types", v)} />
                </Group>
                <Group label="Room sharing" error={err("pg_sharing")}>
                  <Multi values={d.pg_sharing} options={PG_SHARING.map((x) => ({ value: x.value, label: x.label }))} onToggle={(v) => toggleIn("pg_sharing", v)} />
                </Group>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={d.pg_meals} onChange={(e) => set("pg_meals", e.target.checked)} className="w-4 h-4 accent-[var(--color-ink)]" /> Meals included
                </label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Available from" error={err("available_from")}>
                    <Input id="available_from" type="date" value={d.available_from} data-error={!!err("available_from")} onChange={(e) => set("available_from", e.target.value)} />
                  </Field>
                  <NumInput id="deposit" label="Deposit per bed (₹)" value={d.deposit} onChange={(v) => set("deposit", v)} error={err("deposit")} money />
                </div>
              </>
            )}
          </StepWrap>
        )}

        {step === 4 && (
          <StepWrap title={d.transaction_type === "sell" ? "Expected price" : d.transaction_type === "pg" ? "Rent per bed" : "Monthly rent"} sub="We show how your price compares with the locality average so you can price realistically.">
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
              <div>
                <NumInput id="price" label={d.transaction_type === "sell" ? "Sale price (₹)" : "Rent per month (₹)"} value={d.price} onChange={(v) => set("price", v)} error={err("price")} money />
                {priceNum > 0 && <p className="mt-1 text-xs text-ink-2 num">{d.transaction_type === "sell" ? formatPrice(priceNum) : `₹${formatINR(priceNum)} a month`}</p>}
              </div>
              <NumInput id="maintenance" label="Maintenance (₹ / month)" value={d.maintenance} onChange={(v) => set("maintenance", v)} error={err("maintenance")} money hint="optional" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={d.price_negotiable} onChange={(e) => set("price_negotiable", e.target.checked)} className="w-4 h-4 accent-[var(--color-ink)]" /> Price is negotiable
            </label>
            <PriceInsight tx={d.transaction_type} category={d.category} type={t} price={priceNum} area={areaNum} bhk={Number(d.bhk) || 0} avg={avg} localityName={loc?.name} />
          </StepWrap>
        )}

        {step === 5 && (
          <StepWrap title="Amenities" sub="Tick everything that's available to residents or occupants.">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {AMENITIES.map((a) => {
                const on = d.amenities.includes(a.value);
                return (
                  <label key={a.value} className={cx("flex items-center gap-2 h-11 px-3 rounded-[var(--radius-sm)] border text-sm cursor-pointer select-none", on ? "border-ink bg-paper-2" : "border-line hover:border-line-2")}>
                    <input type="checkbox" checked={on} onChange={() => toggleIn("amenities", a.value)} className="w-4 h-4 accent-[var(--color-ink)]" />
                    {a.label}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted"><span className="num">{d.amenities.length}</span> selected</p>
          </StepWrap>
        )}

        {step === 6 && (
          <StepWrap title="Photos and media" sub={`Listings with 5 or more clear photos get far more enquiries. Up to ${MAX_PHOTOS} photos. The first photo is the cover.`}>
            <PhotoUploader photos={d.photos} onChange={(p) => set("photos", p)} max={MAX_PHOTOS} />
            {err("photos") && <p className="text-xs text-danger" role="alert">{err("photos")}</p>}
            <div className="grid md:grid-cols-2 gap-3">
              <FileUploader id="video" kind="video" label="Walkthrough video" hint="MP4 or WebM, up to 4 MB (optional). For longer videos, add a YouTube link in the description." value={d.video} onChange={(v) => set("video", v)} />
              <FileUploader id="floorplan" kind="image_or_pdf" label="Floor plan" hint="Image or PDF (optional)" value={d.floorplan} onChange={(v) => set("floorplan", v)} />
            </div>
          </StepWrap>
        )}

        {step === 7 && (
          <StepWrap title="Describe and review" sub="Write what a buyer or tenant would want to know. Don't include phone numbers or emails; enquiries reach you through 10cent.">
            <Field label="Description" error={err("description")}>
              <Textarea id="description" rows={7} value={d.description} data-error={!!err("description")} onChange={(e) => set("description", e.target.value)} maxLength={4000} placeholder="Layout, light and ventilation, water supply, parking, nearby schools and metro, why you're selling or renting…" />
            </Field>
            <div className="flex justify-between text-xs -mt-3">
              <span className={cx(stripContactInfo(d.description).found ? "text-warn" : "text-muted")}>
                {stripContactInfo(d.description).found ? "Phone numbers and emails will be removed when you submit." : "Minimum 30 characters."}
              </span>
              <span className="num text-muted">{d.description.length}/4000</span>
            </div>
            <Review d={d} city={city?.name} locality={loc?.name} onEdit={go} />
          </StepWrap>
        )}

        {/* Nav */}
        <div className="mt-8 pt-5 border-t border-line flex items-center justify-between gap-3">
          <button type="button" onClick={() => go(step - 1)} disabled={step === 1} className={btnClass("ghost", "md")}>
            <ChevronLeft size={16} /> Back
          </button>
          {step < STEPS.length ? (
            <button type="button" onClick={next} className={btnClass("primary", "md")}>
              Next: {STEPS[step]} <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={pending} className={btnClass("accent", "md")}>
              {pending ? "Submitting…" : editId ? "Save and send for review" : "Submit for review"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepWrap({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby="step-title">
      <h2 id="step-title" className="font-display text-[28px] md:text-[32px] leading-tight">{title}</h2>
      {sub && <p className="text-sm text-muted mt-1 max-w-2xl">{sub}</p>}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

function Group({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-[13px] font-medium text-ink-2 mb-2">{label}</legend>
      {children}
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </fieldset>
  );
}

function Seg({ value, options, onChange, allowEmpty }: { value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void; allowEmpty?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on && allowEmpty ? "" : o.value)}
            className={cx("h-10 px-3.5 rounded-[var(--radius-sm)] border text-sm transition-colors", on ? "bg-ink text-white border-ink" : "bg-card border-line-2 text-ink-2 hover:border-ink")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Multi({ values, options, onToggle }: { values: string[]; options: ReadonlyArray<{ value: string; label: string }>; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onToggle(o.value)} className={cx("h-10 px-3.5 rounded-[var(--radius-sm)] border text-sm inline-flex items-center gap-1.5", on ? "bg-ink text-white border-ink" : "bg-card border-line-2 text-ink-2 hover:border-ink")}>
            {on && <Check size={14} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function NumInput({ id, label, value, onChange, error, hint, money, className }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string | null; hint?: string; money?: boolean; className?: string }) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      <Input
        id={id}
        inputMode="numeric"
        value={money && value ? formatINR(Number(value.replace(/,/g, "")) || 0) : value}
        data-error={!!error}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value.replace(/[^\d-]/g, ""))}
        className="num"
      />
    </Field>
  );
}

function PriceInsight({ tx, category, type, price, area, bhk, avg, localityName }: { tx: string; category: string; type: string; price: number; area: number; bhk: number; avg?: Avg; localityName?: string }) {
  if (!avg || !localityName) return <p className="text-sm text-muted">Pick a locality to compare your price with the local average.</p>;
  if (tx === "sell" && category === "residential" && type !== "plot") {
    const psf = area ? Math.round(price / area) : 0;
    const ratio = psf ? psf / avg.psf : 0;
    return (
      <InsightBox
        line={psf ? <>Your price works out to <b className="num">₹{formatINR(psf)}/sq ft</b>.</> : <>Enter the area on the Details step to see your price per sq ft.</>}
        avgLine={<>Average in {localityName}: <span className="num">₹{formatINR(avg.psf)}/sq ft</span></>}
        ratio={ratio}
      />
    );
  }
  if (tx === "rent" && category === "residential" && bhk) {
    const expected = avg.rent2 * Math.max(0.6, bhk / 2);
    const ratio = price ? price / expected : 0;
    return (
      <InsightBox
        line={area && price ? <>That&apos;s <b className="num">₹{(price / area).toFixed(1)}/sq ft</b> a month.</> : <>Typical rent for a {bhk} BHK here is about <b className="num">₹{formatINR(Math.round(expected / 500) * 500)}</b>.</>}
        avgLine={<>Average 2 BHK rent in {localityName}: <span className="num">₹{formatINR(avg.rent2)}/mo</span></>}
        ratio={ratio}
      />
    );
  }
  return <p className="text-sm text-muted">Locality comparison is available for residential homes. Price it in line with similar listings in {localityName}.</p>;
}

function InsightBox({ line, avgLine, ratio }: { line: React.ReactNode; avgLine: React.ReactNode; ratio: number }) {
  const pct = ratio ? Math.round((ratio - 1) * 100) : null;
  const outlier = ratio > 2 || (ratio > 0 && ratio < 0.4);
  const pos = ratio ? Math.min(100, Math.max(0, (ratio / 2) * 100)) : null;
  return (
    <div className={cx("rounded-[var(--radius-md)] border p-4", outlier ? "border-warn/30 bg-warn-soft" : "border-line bg-paper")}>
      <p className="text-sm text-ink-2">{line}</p>
      <p className="text-xs text-muted mt-1">{avgLine}</p>
      {pos != null && (
        <div className="mt-4">
          <div className="relative h-2 rounded-full bg-paper-2 border border-line" aria-hidden>
            <div className="absolute inset-y-0 left-[35%] right-[35%] bg-trust-soft" />
            <div className="absolute top-1/2 -translate-y-1/2 left-1/2 w-px h-4 bg-ink/40" />
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-ink border-2 border-white shadow" style={{ left: `${pos}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-muted mt-1.5"><span>Below</span><span>Locality average</span><span>2x</span></div>
          <p className={cx("mt-2 text-sm font-medium", outlier ? "text-warn" : "text-ink")}>
            {pct === 0 ? "Right at the locality average." : `${Math.abs(pct!)}% ${pct! > 0 ? "above" : "below"} the locality average.`}
            {outlier && <span className="block font-normal text-xs mt-0.5"><AlertTriangle size={12} className="inline -mt-0.5" /> Prices this far from the average are reviewed manually and may take longer to approve.</span>}
          </p>
        </div>
      )}
    </div>
  );
}

function Review({ d, city, locality, onEdit }: { d: ListingDraft; city?: string; locality?: string; onEdit: (s: number) => void }) {
  const price = Number(d.price.replace(/,/g, "")) || 0;
  const rows: Array<[string, string, number]> = [
    ["Listing", `${d.transaction_type === "sell" ? "For sale" : d.transaction_type === "rent" ? "For rent" : "PG"} · ${d.category} · ${PROPERTY_TYPE_LABEL[d.property_type] ?? d.property_type}`, 1],
    ["Location", [d.address, locality, city].filter(Boolean).join(", ") || "—", 2],
    ["Size", [d.bhk && isHome(d.property_type) ? `${d.bhk} BHK` : null, d.carpet_area && `${formatINR(+d.carpet_area)} sq ft carpet`, d.super_area && `${formatINR(+d.super_area)} sq ft super`, d.builtup_area && `${formatINR(+d.builtup_area)} sq ft built-up`, d.plot_area && `${formatINR(+d.plot_area)} sq ft plot`].filter(Boolean).join(" · ") || "—", 3],
    ["Details", [d.furnishing && FURNISHING_LABEL[d.furnishing], d.floor && `Floor ${d.floor}${d.total_floors ? ` of ${d.total_floors}` : ""}`, d.facing && `${d.facing} facing`, d.transaction_type === "sell" && d.construction_status === "under_construction" ? `Possession ${d.possession_date}` : null, d.rera_id && `RERA ${d.rera_id}`, d.available_from && `Available ${d.available_from}`].filter(Boolean).join(" · ") || "—", 3],
    ["Price", price ? `${d.transaction_type === "sell" ? formatPrice(price) : `₹${formatINR(price)}/month`}${d.price_negotiable ? " · negotiable" : ""}${d.deposit ? ` · deposit ₹${formatINR(+d.deposit)}` : ""}${d.maintenance ? ` · maintenance ₹${formatINR(+d.maintenance)}/mo` : ""}` : "—", 4],
    ["Amenities", d.amenities.map((a) => AMENITY_LABEL[a]).join(", ") || "None selected", 5],
    ["Media", `${d.photos.length} photo${d.photos.length === 1 ? "" : "s"}${d.video ? " · video" : ""}${d.floorplan ? " · floor plan" : ""}`, 6],
  ];
  return (
    <div className="border border-line rounded-[var(--radius-md)] overflow-hidden">
      <div className="px-4 py-2.5 bg-paper-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Review</div>
      <dl className="divide-y divide-line">
        {rows.map(([k, v, s]) => (
          <div key={k} className="grid grid-cols-[96px_1fr_auto] sm:grid-cols-[140px_1fr_auto] gap-3 px-4 py-3 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="text-ink min-w-0 break-words">{v}</dd>
            <dd><button type="button" onClick={() => onEdit(s)} className="text-xs font-medium text-accent-ink hover:underline">Edit</button></dd>
          </div>
        ))}
      </dl>
      {d.photos.length === 0 && (
        <p className="flex gap-2 items-start px-4 py-3 text-xs text-warn bg-warn-soft border-t border-line"><Info size={14} className="shrink-0 mt-px" /> Listings without photos rank lower and get fewer enquiries. You can still submit and add photos later.</p>
      )}
    </div>
  );
}
