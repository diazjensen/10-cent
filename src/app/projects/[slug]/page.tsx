import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, CalendarClock, ExternalLink, FileDown, MapPin, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getUser, can } from "@/lib/auth";
import { searchListings } from "@/lib/listings";
import { formatArea, formatDate, formatINR, formatPrice } from "@/lib/format";
import { AMENITY_LABEL, RERA_PORTALS } from "@/lib/constants";
import { getProjectBySlug, projectParts, parseJsonArray, yearsInBusiness } from "@/lib/content/projects";
import { projectEnquiry, projectBrochure, projectVisit } from "../actions";
import { Gallery, ZoomThumb } from "@/components/content/lightbox";
import { ProjectActions } from "@/components/content/project-actions";
import { PROJECT_STATUS, priceRange, bhkLabel } from "@/components/content/project-card";
import { MiniMap } from "@/components/content/mini-map";
import { ListingCard } from "@/components/listing-card";
import { Badge, Breadcrumbs, Container, Notice, btnClass } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProjectBySlug(slug);
  if (!p || !p.approved) return { title: "Project not found" };
  const { units } = await projectParts(p.id);
  return {
    title: `${p.name}, ${p.loc_name ?? p.city_name}: price list, floor plans, RERA`,
    description: `${p.name} by ${p.builder_company ?? p.builder_name} in ${[p.loc_name, p.city_name].filter(Boolean).join(", ")}. ${bhkLabel(units.map((u) => u.bhk).join(",")) ?? ""} from ${formatPrice(p.price_min)}. ${PROJECT_STATUS[p.status]?.label ?? ""}${p.rera_id ? `, RERA ${p.rera_id}` : ""}.`,
    alternates: { canonical: `/projects/${p.slug}` },
    openGraph: { images: (await projectParts(p.id)).media.slice(0, 1).map((m) => m.url) },
  };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const p = await getProjectBySlug(slug);
  if (!p) notFound();
  const user = await getUser();
  const preview = !p.approved;
  if (preview && !(user && (user.id === p.builder_id || can(user, "projects")))) notFound();

  const { units, towers, media } = await projectParts(p.id);
  const photos = media.filter((m) => m.kind !== "floorplan").map((m, i) => ({ url: m.url, caption: `${p.name} photo ${i + 1}` }));
  const amenities = parseJsonArray<string>(p.amenities);
  const advantages = parseJsonArray<{ name: string; distance: string }>(p.location_advantages);
  const plans = units.filter((u) => u.floor_plan_url).map((u) => ({ url: u.floor_plan_url!, caption: `${u.label} floor plan` }));
  const listings = await searchListings({ project: String(p.id), sort: "newest" }, { pageSize: 8 });
  const saved = new Set(user ? (await db.prepare("SELECT listing_id FROM shortlists WHERE user_id = ?").all(user.id) as { listing_id: number }[]).map((r) => r.listing_id) : []);
  const now = new Date().toISOString();
  const banner = await db.prepare(`SELECT id, title, subtitle FROM banners WHERE placement = 'project_sidebar' AND active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?)
    AND (project_id IS NULL OR project_id <> ?) ORDER BY (project_id IS NULL), id DESC LIMIT 1`).get(now, now, p.id) as { id: number; title: string; subtitle: string | null } | undefined;
  if (banner) await db.prepare("UPDATE banners SET impressions = impressions + 1 WHERE id = ?").run(banner.id);
  const more = await db.prepare("SELECT slug, name, status FROM projects WHERE builder_id = ? AND id <> ? AND approved = 1 ORDER BY created_at DESC LIMIT 4").all(p.builder_id, p.id) as Array<{ slug: string; name: string; status: string }>;
  const reraUrl = p.rera_state ? RERA_PORTALS[p.rera_state] : undefined;
  const st = PROJECT_STATUS[p.status];
  const builder = p.builder_company ?? p.builder_name ?? "the builder";
  const yrs = yearsInBusiness(p.builder_est, p.builder_exp);
  const path = `/projects/${p.slug}`;
  const me = user ? { name: user.name ?? "", phone: user.phone ?? "", email: user.email ?? "" } : null;
  const avgCompletion = towers.length ? Math.round(towers.reduce((s, t) => s + (t.completion_pct ?? 0), 0) / towers.length) : null;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "ApartmentComplex", name: p.name, description: p.description ?? undefined,
    address: { "@type": "PostalAddress", streetAddress: p.address ?? undefined, addressLocality: p.city_name, addressRegion: p.city_state, addressCountry: "IN" },
    ...(p.lat && p.lng ? { geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } } : {}),
    ...(p.price_min ? { offers: { "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: p.price_min, highPrice: p.price_max ?? p.price_min } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Container className="pt-6 pb-14">
        {preview && <Notice tone="warn" className="mb-4">Preview: this project is awaiting approval and is not visible to the public yet.</Notice>}
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Projects", href: "/projects" }, { label: p.city_name, href: `/projects?city=${p.city_slug}` }, { label: p.name }]} />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {st && <Badge tone={st.tone}>{st.label}</Badge>}
              {p.rera_id && <Badge tone="trust" icon={<ShieldCheck size={12} aria-hidden />}>RERA registered</Badge>}
            </div>
            <h1 className="font-display text-[40px] md:text-[60px] leading-[1] mt-2">{p.name}</h1>
            <p className="text-ink-2 mt-1 flex items-center gap-1.5"><MapPin size={15} aria-hidden className="text-muted" />{[p.address, ...[p.loc_name, p.city_name].filter((x) => x && !(p.address ?? "").includes(x))].filter(Boolean).join(", ")}</p>
            <p className="text-sm text-muted mt-1">by <Link href={`/builders/${p.builder_id}`} className="text-ink font-medium hover:text-accent-ink">{builder}</Link></p>
          </div>
          <div className="text-right">
            <div className="num text-[28px] md:text-[34px] font-semibold tracking-tight">{priceRange(p.price_min, p.price_max)}</div>
            <div className="text-sm text-muted">{bhkLabel(units.map((u) => u.bhk).join(","))}</div>
          </div>
        </div>

        <div className="mt-6"><Gallery shots={photos} /></div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
          <div className="space-y-12 min-w-0">
            <dl className="grid grid-cols-2 md:grid-cols-4 border border-line rounded-[var(--radius-md)] bg-card divide-line [&>div]:p-4 [&>div]:border-line [&>div:nth-child(odd)]:border-r md:[&>div]:border-r md:[&>div:last-child]:border-r-0 [&>div:nth-child(-n+2)]:border-b md:[&>div:nth-child(-n+2)]:border-b-0">
              <div><dt className="text-xs text-muted">Possession</dt><dd className="font-medium mt-0.5">{p.status === "ready" ? "Ready to move" : formatDate(p.possession_date, { month: "short", year: "numeric" })}</dd></div>
              <div><dt className="text-xs text-muted">Total units</dt><dd className="num font-medium mt-0.5">{p.total_units ? formatINR(p.total_units) : "—"}</dd></div>
              <div><dt className="text-xs text-muted">Land area</dt><dd className="num font-medium mt-0.5">{p.land_area_acres ? `${p.land_area_acres} acres` : "—"}</dd></div>
              <div><dt className="text-xs text-muted">Launched</dt><dd className="font-medium mt-0.5">{formatDate(p.launch_date, { month: "short", year: "numeric" })}</dd></div>
            </dl>

            {p.rera_id && (
              <section className="flex flex-wrap items-center justify-between gap-3 bg-trust-soft border border-trust/20 rounded-[var(--radius-md)] px-4 py-3">
                <div className="text-sm">
                  <div className="font-medium text-trust flex items-center gap-1.5"><ShieldCheck size={16} aria-hidden /> {p.rera_state} RERA</div>
                  <div className="num text-ink-2 break-all">{p.rera_id}</div>
                </div>
                {reraUrl && <a href={reraUrl} target="_blank" rel="noopener noreferrer" className={btnClass("trust", "sm")}>Verify on {p.rera_state} RERA portal <ExternalLink size={14} aria-hidden /></a>}
              </section>
            )}

            {p.description && (
              <section>
                <h2 className="font-display text-3xl mb-3">About {p.name}</h2>
                <p className="text-ink-2 leading-relaxed whitespace-pre-line">{p.description}</p>
              </section>
            )}

            <section aria-labelledby="prices-h">
              <div className="flex items-end justify-between gap-3 mb-4">
                <h2 id="prices-h" className="font-display text-3xl">Price list & floor plans</h2>
                <Link href={`${path}/brochure`} className="text-sm font-medium inline-flex items-center gap-1 hover:text-accent-ink"><FileDown size={15} aria-hidden /> Printable version</Link>
              </div>
              {units.length ? (
                <div className="overflow-x-auto bg-card border border-line rounded-[var(--radius-md)]">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead className="bg-paper-2 text-xs text-muted"><tr className="text-left"><th className="font-medium px-4 py-2.5">Unit</th><th className="font-medium px-4 py-2.5 text-right">Price</th><th className="font-medium px-4 py-2.5 text-right">Carpet</th><th className="font-medium px-4 py-2.5 text-right">Super built-up</th><th className="font-medium px-4 py-2.5">Floor plan</th></tr></thead>
                    <tbody>
                      {units.map((u) => {
                        const idx = plans.findIndex((x) => x.url === u.floor_plan_url);
                        return (
                          <tr key={u.id} className="border-t border-line">
                            <td className="px-4 py-3"><div className="font-medium">{u.label}</div>{u.available_units != null && <div className="text-xs text-muted num">{u.available_units} available</div>}</td>
                            <td className="px-4 py-3 text-right num font-semibold">{formatPrice(u.price)}{u.price && u.super_area ? <div className="text-xs font-normal text-muted">₹{formatINR(Math.round(u.price / u.super_area))}/sq ft</div> : null}</td>
                            <td className="px-4 py-3 text-right num">{formatArea(u.carpet_area)}</td>
                            <td className="px-4 py-3 text-right num">{formatArea(u.super_area)}</td>
                            <td className="px-4 py-3">
                              {idx >= 0 ? (
                                <ZoomThumb shots={plans} index={idx} className="block w-16 h-12 rounded border border-line overflow-hidden bg-white hover:border-ink">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={u.floor_plan_url!} alt={`${u.label} floor plan`} className="w-full h-full object-cover" loading="lazy" />
                                </ZoomThumb>
                              ) : <span className="text-xs text-muted">On request</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-sm text-muted">The builder hasn&apos;t published a price list yet. Send an enquiry to get it.</p>}
              <p className="text-xs text-muted mt-2">Prices are base prices shared by the builder and exclude GST, stamp duty, registration, parking and floor-rise charges.</p>
            </section>

            {towers.length > 0 && (
              <section aria-labelledby="towers-h">
                <div className="flex items-end justify-between gap-3 mb-4">
                  <h2 id="towers-h" className="font-display text-3xl">Construction progress</h2>
                  {avgCompletion != null && <span className="text-sm text-muted num">{avgCompletion}% overall</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {towers.map((t) => (
                    <div key={t.id} className="bg-card border border-line rounded-[var(--radius-md)] p-4">
                      <div className="flex justify-between text-sm"><span className="font-medium">{t.name}</span><span className="num font-semibold">{t.completion_pct ?? 0}%</span></div>
                      <div className="h-2 rounded-full bg-paper-2 mt-2 overflow-hidden" role="progressbar" aria-valuenow={t.completion_pct ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`${t.name} completion`}>
                        <div className={(t.completion_pct ?? 0) >= 100 ? "h-full bg-trust" : "h-full bg-accent"} style={{ width: `${Math.min(100, t.completion_pct ?? 0)}%` }} />
                      </div>
                      <div className="text-xs text-muted mt-2 num">{t.floors ?? "—"} floors · {t.units ?? "—"} units</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {p.master_plan_url && (
              <section>
                <h2 className="font-display text-3xl mb-4">Master plan</h2>
                <ZoomThumb shots={[{ url: p.master_plan_url, caption: `${p.name} master plan` }]} className="block w-full bg-white border border-line rounded-[var(--radius-md)] overflow-hidden hover:border-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.master_plan_url} alt={`${p.name} master plan`} className="w-full max-h-[420px] object-contain" loading="lazy" />
                </ZoomThumb>
              </section>
            )}

            {amenities.length > 0 && (
              <section>
                <h2 className="font-display text-3xl mb-4">Amenities</h2>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5 text-sm">
                  {amenities.map((a) => <li key={a} className="flex items-center gap-2"><BadgeCheck size={15} className="text-trust shrink-0" aria-hidden />{AMENITY_LABEL[a] ?? a}</li>)}
                </ul>
              </section>
            )}

            <section>
              <h2 className="font-display text-3xl mb-4">Location</h2>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px] gap-4">
                {p.lat && p.lng ? <MiniMap center={[p.lat, p.lng]} zoom={14} className="h-72" points={[{ lat: p.lat, lng: p.lng, label: p.name, active: true }]} /> : <div className="h-72 bg-paper-2 rounded-[var(--radius-md)]" />}
                <div>
                  <h3 className="text-sm font-medium mb-2">Location advantages</h3>
                  {advantages.length ? (
                    <ul className="divide-y divide-line text-sm">
                      {advantages.map((a) => <li key={a.name} className="flex justify-between gap-3 py-2"><span className="text-ink-2">{a.name}</span><span className="num text-muted shrink-0">{a.distance}</span></li>)}
                    </ul>
                  ) : <p className="text-sm text-muted">Not shared yet.</p>}
                  {p.loc_slug && <Link href={`/localities/${p.city_slug}/${p.loc_slug}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:gap-2 transition-all">About {p.loc_name} <ArrowRight size={14} /></Link>}
                </div>
              </div>
            </section>

            {listings.rows.length > 0 && (
              <section>
                <div className="flex items-end justify-between gap-3 mb-4">
                  <h2 className="font-display text-3xl">Resale & rent in {p.name}</h2>
                  {listings.total > listings.rows.length && <Link href={`/search?project=${p.id}`} className="text-sm font-medium inline-flex items-center gap-1">All {listings.total} <ArrowRight size={14} /></Link>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{listings.rows.map((l) => <ListingCard key={l.id} l={l} saved={saved.has(l.id)} />)}</div>
              </section>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20">
            <ProjectActions
              me={me}
              loginHref={`/login?next=${encodeURIComponent(path + "#enquire")}`}
              builder={builder}
              projectName={p.name}
              enquiry={projectEnquiry.bind(null, p.id)}
              brochure={projectBrochure.bind(null, p.id)}
              visit={projectVisit.bind(null, p.id)}
            />
            <div className="bg-card border border-line rounded-[var(--radius-md)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Developer</div>
              <Link href={`/builders/${p.builder_id}`} className="flex items-center gap-3 mt-2 group">
                <span className="w-11 h-11 rounded-[var(--radius-sm)] bg-ink text-white grid place-items-center font-display text-xl shrink-0">{builder.slice(0, 1)}</span>
                <span className="min-w-0">
                  <span className="block font-medium group-hover:text-accent-ink truncate">{builder}</span>
                  <span className="block text-xs text-muted num">{yrs ? `${yrs} years in business` : ""}{p.builder_rating ? ` · ${p.builder_rating.toFixed(1)}/5` : ""}</span>
                </span>
              </Link>
              {p.builder_about && <p className="text-sm text-ink-2 mt-3 line-clamp-3">{p.builder_about}</p>}
              {more.length > 0 && (
                <ul className="mt-3 pt-3 border-t border-line text-sm space-y-1.5">
                  {more.map((m) => <li key={m.slug} className="flex justify-between gap-2"><Link href={`/projects/${m.slug}`} className="hover:text-accent-ink truncate">{m.name}</Link><span className="text-xs text-muted shrink-0">{PROJECT_STATUS[m.status]?.label}</span></li>)}
                </ul>
              )}
            </div>
            {p.possession_date && p.status !== "ready" && (
              <div className="flex items-center gap-3 text-sm bg-paper-2 rounded-[var(--radius-md)] p-4">
                <CalendarClock size={18} className="text-ink-2 shrink-0" aria-hidden />
                <span>RERA possession date <b className="num">{formatDate(p.possession_date)}</b></span>
              </div>
            )}
            {banner && (
              <Link href={`/api/banner/${banner.id}`} className="block bg-ink text-white rounded-[var(--radius-md)] p-4 hover:bg-black">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Sponsored</span>
                <span className="block font-display text-2xl mt-1">{banner.title}</span>
                {banner.subtitle && <span className="block text-sm text-white/70 mt-1">{banner.subtitle}</span>}
              </Link>
            )}
          </aside>
        </div>
      </Container>
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-card/95 backdrop-blur border-t border-line px-4 py-2.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="num text-sm font-semibold truncate">{priceRange(p.price_min, p.price_max)}</div>
          <div className="text-[11px] text-muted truncate">{p.name}</div>
        </div>
        <a href="#enquire" className={btnClass("accent", "md")}>Enquire</a>
      </div>
      <div className="lg:hidden h-16" aria-hidden />
    </>
  );
}
