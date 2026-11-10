import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser, can } from "@/lib/auth";
import { formatArea, formatDate, formatINR, formatPhone, formatPrice } from "@/lib/format";
import { AMENITY_LABEL } from "@/lib/constants";
import { getProjectBySlug, projectParts, parseJsonArray, yearsInBusiness } from "@/lib/content/projects";
import { PROJECT_STATUS, priceRange } from "@/components/content/project-card";
import { PrintButton } from "@/components/content/print-button";

export async function generateMetadata({ params }: PageProps<"/projects/[slug]/brochure">): Promise<Metadata> {
  const { slug } = await params;
  const p = getProjectBySlug(slug);
  return { title: p ? `${p.name} brochure` : "Brochure", robots: { index: false } };
}

/** Printable brochure generated from project data, used when the builder hasn't uploaded a PDF. */
export default async function Brochure({ params }: PageProps<"/projects/[slug]/brochure">) {
  const { slug } = await params;
  const p = getProjectBySlug(slug);
  if (!p) notFound();
  const u = await getUser();
  if (!p.approved) {
    if (!(u && (u.id === p.builder_id || can(u, "projects")))) notFound();
  }
  const { units, towers, media } = projectParts(p.id);
  const amenities = parseJsonArray<string>(p.amenities);
  const adv = parseJsonArray<{ name: string; distance: string }>(p.location_advantages);
  const builder = p.builder_company ?? p.builder_name ?? "";
  const yrs = yearsInBusiness(p.builder_est, p.builder_exp);
  const photos = media.filter((m) => m.kind !== "floorplan").slice(0, 3);

  return (
    <div className="bg-paper-2 print:bg-white py-8 print:py-0">
      <style>{`@media print { header, footer, .skip-print { display: none !important; } @page { margin: 14mm; } }`}</style>
      <div className="max-w-[860px] mx-auto px-4 print:px-0">
        <div className="skip-print flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
          <Link href={`/projects/${p.slug}`} className="text-sm text-ink-2 hover:text-ink">← Back to {p.name}</Link>
          <PrintButton />
        </div>
        <article className="bg-white border border-line print:border-0 rounded-[var(--radius-md)] print:rounded-none p-8 md:p-12 print:p-0 text-ink">
          <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{builder}</div>
              <h1 className="font-display text-5xl md:text-6xl leading-[0.95] mt-2">{p.name}</h1>
              <p className="mt-2 text-ink-2">{[p.address, p.loc_name, p.city_name].filter(Boolean).join(", ")}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-muted">Starting at</div>
              <div className="num text-2xl font-semibold">{formatPrice(p.price_min)}</div>
              <div className="text-xs text-muted mt-1">{PROJECT_STATUS[p.status]?.label}</div>
            </div>
          </header>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-6">
              {photos.map((m, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m.id} src={m.url} alt="" className={i === 0 ? "col-span-2 row-span-2 w-full h-full object-cover aspect-[4/3]" : "w-full aspect-[4/3] object-cover"} />
              ))}
            </div>
          )}

          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 text-sm">
            <div><div className="text-xs text-muted">Price range</div><div className="num font-medium">{priceRange(p.price_min, p.price_max)}</div></div>
            <div><div className="text-xs text-muted">Possession</div><div className="font-medium">{p.status === "ready" ? "Ready to move" : formatDate(p.possession_date, { month: "long", year: "numeric" })}</div></div>
            <div><div className="text-xs text-muted">Units · Land</div><div className="num font-medium">{p.total_units ?? "—"} · {p.land_area_acres ? `${p.land_area_acres} acres` : "—"}</div></div>
            <div><div className="text-xs text-muted">RERA</div><div className="num font-medium break-all text-xs">{p.rera_id ?? "Not applicable"}</div></div>
          </section>

          {p.description && <p className="mt-8 leading-relaxed text-ink-2">{p.description}</p>}

          {units.length > 0 && (
            <section className="mt-10 break-inside-avoid">
              <h2 className="font-display text-3xl mb-3">Price list</h2>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted border-b border-ink"><tr className="text-left"><th className="py-2 font-medium">Unit</th><th className="py-2 font-medium text-right">Carpet</th><th className="py-2 font-medium text-right">Super built-up</th><th className="py-2 font-medium text-right">Base price</th></tr></thead>
                <tbody className="num">
                  {units.map((u) => <tr key={u.id} className="border-b border-line"><td className="py-2">{u.label}</td><td className="py-2 text-right">{formatArea(u.carpet_area)}</td><td className="py-2 text-right">{formatArea(u.super_area)}</td><td className="py-2 text-right font-medium">{u.price ? `₹${formatINR(u.price)}` : "On request"}</td></tr>)}
                </tbody>
              </table>
              <p className="text-xs text-muted mt-2">Excludes GST, stamp duty, registration, parking and floor-rise charges. Prices as on {formatDate(new Date().toISOString())}.</p>
            </section>
          )}

          {units.some((u) => u.floor_plan_url) && (
            <section className="mt-10">
              <h2 className="font-display text-3xl mb-3">Floor plans</h2>
              <div className="grid grid-cols-2 gap-4">
                {units.filter((u) => u.floor_plan_url).map((u) => (
                  <figure key={u.id} className="border border-line p-2 break-inside-avoid">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u.floor_plan_url!} alt={`${u.label} floor plan`} className="w-full aspect-[4/3] object-contain" />
                    <figcaption className="text-xs text-center mt-1 num">{u.label} · {formatArea(u.carpet_area)} carpet</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
            {amenities.length > 0 && (
              <section className="break-inside-avoid">
                <h2 className="font-display text-3xl mb-3">Amenities</h2>
                <ul className="grid grid-cols-2 gap-1.5 text-sm text-ink-2">{amenities.map((a) => <li key={a}>· {AMENITY_LABEL[a] ?? a}</li>)}</ul>
              </section>
            )}
            {adv.length > 0 && (
              <section className="break-inside-avoid">
                <h2 className="font-display text-3xl mb-3">Connectivity</h2>
                <ul className="text-sm divide-y divide-line">{adv.map((a) => <li key={a.name} className="flex justify-between py-1.5"><span>{a.name}</span><span className="num text-muted">{a.distance}</span></li>)}</ul>
              </section>
            )}
          </div>

          {towers.length > 0 && (
            <section className="mt-10 break-inside-avoid">
              <h2 className="font-display text-3xl mb-3">Towers</h2>
              <table className="w-full text-sm num">
                <thead className="text-xs text-muted border-b border-ink"><tr className="text-left"><th className="py-2 font-medium">Tower</th><th className="py-2 font-medium text-right">Floors</th><th className="py-2 font-medium text-right">Units</th><th className="py-2 font-medium text-right">Completion</th></tr></thead>
                <tbody>{towers.map((t) => <tr key={t.id} className="border-b border-line"><td className="py-2">{t.name}</td><td className="py-2 text-right">{t.floors}</td><td className="py-2 text-right">{t.units}</td><td className="py-2 text-right">{t.completion_pct ?? 0}%</td></tr>)}</tbody>
              </table>
            </section>
          )}

          <footer className="mt-12 pt-6 border-t-2 border-ink grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium">{builder}</div>
              <div className="text-ink-2">{yrs ? `${yrs} years in real estate` : ""}</div>
              {u && p.builder_phone && <div className="num text-ink-2">Sales: {formatPhone(p.builder_phone)}</div>}
            </div>
            <div className="text-xs text-muted md:text-right">
              Generated by 10cent from information provided by the developer. Verify the RERA registration, approvals and final price
              before booking. 10cent is not a party to any transaction.
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
