import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { STATES } from "@/lib/constants";
import { Badge, inputClass, cx } from "@/components/ui";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/action-form";
import { saveCity, saveLocality, toggleTrending } from "@/lib/admin/actions-content";

export const metadata: Metadata = { title: "Cities & localities" };

type City = { id: number; slug: string; name: string; state: string; lat: number; lng: number; is_launch: number; sort: number; locs: number; live: number };
type Loc = { id: number; slug: string; name: string; lat: number; lng: number; rating: number | null; connectivity: number | null; safety: number | null; lifestyle: number | null; description: string | null; trending: number; live: number };
const inp = cx(inputClass, "h-9 mt-1 text-[13px]");
const lbl = "block text-[12px] font-medium text-ink-2";

function CityForm({ c }: { c?: City }) {
  return (
    <ActionForm action={saveCity} resetOnSuccess={!c} className="grid grid-cols-2 gap-2.5">
      {c && <input type="hidden" name="id" value={c.id} />}
      <label className={lbl}>Name<input name="name" defaultValue={c?.name} className={inp} placeholder="Kochi" /><FieldError name="name" /></label>
      <label className={lbl}>Slug<input name="slug" defaultValue={c?.slug} className={cx(inp, "font-mono")} placeholder="auto" /><FieldError name="slug" /></label>
      <label className={cx(lbl, "col-span-2")}>State
        <select name="state" defaultValue={c?.state ?? ""} className={inp}><option value="">Choose…</option>{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <FieldError name="state" />
      </label>
      <label className={lbl}>Latitude<input name="lat" defaultValue={c?.lat} inputMode="decimal" className={cx(inp, "num")} placeholder="9.9312" /><FieldError name="lat" /></label>
      <label className={lbl}>Longitude<input name="lng" defaultValue={c?.lng} inputMode="decimal" className={cx(inp, "num")} placeholder="76.2673" /><FieldError name="lng" /></label>
      <label className={lbl}>Sort<input name="sort" defaultValue={c?.sort ?? 10} inputMode="numeric" className={cx(inp, "num")} /></label>
      <label className="flex items-end gap-2 text-[13px] pb-2"><input type="checkbox" name="is_launch" defaultChecked={c ? !!c.is_launch : true} className="accent-[var(--color-ink)]" /> Launch city</label>
      <div className="col-span-2"><SubmitButton>{c ? "Save city" : "Add city"}</SubmitButton></div>
    </ActionForm>
  );
}

function LocalityForm({ cityId, l }: { cityId: number; l?: Loc }) {
  return (
    <ActionForm action={saveLocality} resetOnSuccess={!l} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <input type="hidden" name="city_id" value={cityId} />
      {l && <input type="hidden" name="id" value={l.id} />}
      <label className={cx(lbl, "col-span-2")}>Name<input name="name" defaultValue={l?.name} className={inp} /><FieldError name="name" /></label>
      <label className={cx(lbl, "col-span-2")}>Slug<input name="slug" defaultValue={l?.slug} className={cx(inp, "font-mono")} placeholder="auto from name" /><FieldError name="slug" /></label>
      <label className={lbl}>Latitude<input name="lat" defaultValue={l?.lat} inputMode="decimal" className={cx(inp, "num")} /><FieldError name="lat" /></label>
      <label className={lbl}>Longitude<input name="lng" defaultValue={l?.lng} inputMode="decimal" className={cx(inp, "num")} /><FieldError name="lng" /></label>
      {(["rating", "connectivity", "safety", "lifestyle"] as const).map((k) => (
        <label key={k} className={cx(lbl, "capitalize")}>{k} <span className="font-normal text-muted">0–5</span><input name={k} defaultValue={l?.[k] ?? ""} inputMode="decimal" className={cx(inp, "num")} /><FieldError name={k} /></label>
      ))}
      <label className={cx(lbl, "col-span-2 sm:col-span-4")}>Description<textarea name="description" rows={3} defaultValue={l?.description ?? ""} className={cx(inputClass, "h-auto py-2 mt-1 text-[13px]")} /><FieldError name="description" /></label>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="trending" defaultChecked={!!l?.trending} className="accent-[var(--color-ink)]" /> Trending</label>
      <div className="col-span-2 sm:col-span-4"><SubmitButton>{l ? "Save locality" : "Add locality"}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function LocationsPage({ searchParams }: PageProps<"/admin/locations">) {
  await requireAdmin("cms");
  const sp = await searchParams;
  const cities = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM localities l WHERE l.city_id = c.id) locs, (SELECT COUNT(*) FROM listings x WHERE x.city_id = c.id AND x.status = 'live') live FROM cities c ORDER BY c.sort, c.name`).all() as City[];
  const city = cities.find((c) => c.slug === sp.city) ?? cities[0];
  const locs = city ? (db.prepare(`SELECT l.*, (SELECT COUNT(*) FROM listings x WHERE x.locality_id = l.id AND x.status = 'live') live FROM localities l WHERE city_id = ? ORDER BY l.trending DESC, l.name`).all(city.id) as Loc[]) : [];

  return (
    <div>
      <AdminHeader eyebrow="AD7 · Content" title="Cities & localities" sub="Master data behind search, locality pages, price trends and the city picker. Coordinates drive map pins and radius search." />
      <div className="grid xl:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
        <div className="space-y-4">
          <Panel title={`Cities (${cities.length})`} pad={false}>
            <ul className="divide-y divide-line">
              {cities.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/locations?city=${c.slug}`} aria-current={c.id === city?.id ? "page" : undefined} className={cx("flex items-center justify-between px-4 py-2.5 text-[13px]", c.id === city?.id ? "bg-ink text-white" : "hover:bg-paper/60")}>
                    <span><span className="font-medium">{c.name}</span> <span className={c.id === city?.id ? "text-white/70" : "text-muted"}>{c.state}</span></span>
                    <span className={cx("num text-xs", c.id === city?.id ? "text-white/70" : "text-muted")}>{c.locs} loc · {c.live} live</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Add a city"><CityForm /></Panel>
        </div>

        {city && (
          <div className="space-y-4 min-w-0">
            <Panel title={`${city.name}: city details`}><CityForm key={city.id} c={city} /></Panel>
            <Panel title={`Localities in ${city.name} (${locs.length})`} pad={false}>
              <ul className="divide-y divide-line">
                {locs.map((l) => (
                  <li key={l.id}>
                    <details>
                      <summary className="list-none cursor-pointer px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] hover:bg-paper/40">
                        <span className="font-medium">{l.name}</span>
                        {l.trending ? <Badge tone="accent">Trending</Badge> : null}
                        <span className="text-xs text-muted num">{l.lat.toFixed(4)}, {l.lng.toFixed(4)}</span>
                        <span className="ml-auto text-xs text-muted num">{l.rating != null ? `★ ${l.rating.toFixed(1)} · ` : ""}{l.live} live</span>
                      </summary>
                      <div className="px-4 pb-4 pt-2 bg-paper/40 border-t border-line">
                        <LocalityForm cityId={city.id} l={l} />
                        <ActionForm action={toggleTrending} className="mt-2" inline>
                          <input type="hidden" name="id" value={l.id} />
                          <SubmitButton variant="ghost">{l.trending ? "Remove from trending" : "Mark trending"}</SubmitButton>
                        </ActionForm>
                        <a href={`/localities/${city.slug}/${l.slug}`} target="_blank" className="text-xs underline">Public locality page</a>
                      </div>
                    </details>
                  </li>
                ))}
                {!locs.length && <li className="px-4 py-4 text-[13px] text-muted">No localities yet. Add the first one below.</li>}
              </ul>
            </Panel>
            <Panel title={`Add a locality to ${city.name}`}><LocalityForm key={`new-${city.id}`} cityId={city.id} /></Panel>
          </div>
        )}
      </div>
    </div>
  );
}
