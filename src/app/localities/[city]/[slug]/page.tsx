import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, GraduationCap, Hospital, TrainFront, ShoppingBag, Building2, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { CARD_FROM, CARD_SELECT, type ListingCard as Card } from "@/lib/listings";
import { formatINR, formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABEL } from "@/lib/constants";
import { getLocality, priceTrend, pctChange, monthLabel, parseLandmarks, LANDMARK_KINDS } from "@/lib/content/localities";
import { submitReview } from "@/lib/content/review-actions";
import { ListingCard } from "@/components/listing-card";
import { MiniMap } from "@/components/content/mini-map";
import { Change } from "@/components/content/change";
import { ReviewForm } from "@/components/content/review-form";
import { ReviewList, ReviewSummary, shortName, type ReviewRow } from "@/components/content/reviews";
import { ProjectCard, PROJECT_CARD_SQL, type ProjectCardRow } from "@/components/content/project-card";
import { Breadcrumbs, Container, LineChart, SectionHeading, EmptyState, btnClass } from "@/components/ui";

const KIND_ICON: Record<string, typeof MapPin> = { school: GraduationCap, hospital: Hospital, metro: TrainFront, mall: ShoppingBag, it_park: Building2 };

export async function generateMetadata({ params }: PageProps<"/localities/[city]/[slug]">): Promise<Metadata> {
  const { city, slug } = await params;
  const loc = await getLocality(city, slug);
  if (!loc) return { title: "Locality not found" };
  const t = (await priceTrend(loc.id, 1))[0];
  return {
    title: `${loc.name}, ${loc.city_name}: prices, reviews and homes`,
    description: `${loc.name} locality guide: ${t ? `₹${formatINR(t.psf)}/sq ft average, 2 BHK rent around ₹${formatINR(t.rent)}. ` : ""}Ratings for connectivity, safety and lifestyle, nearby schools, hospitals and metro, and live listings.`,
    alternates: { canonical: `/localities/${loc.city_slug}/${loc.slug}` },
  };
}

export default async function LocalityPage({ params }: PageProps<"/localities/[city]/[slug]">) {
  const { city, slug } = await params;
  const loc = await getLocality(city, slug);
  if (!loc) notFound();
  const path = `/localities/${loc.city_slug}/${loc.slug}`;
  const user = await getUser();
  const trend = await priceTrend(loc.id, 36);
  const last = trend.at(-1), ly = trend.at(-13);
  const landmarks = parseLandmarks(loc.landmarks);
  const groups = Object.keys(LANDMARK_KINDS).map((k) => ({ kind: k, items: landmarks.filter((l) => l.kind === k) })).filter((g) => g.items.length);
  const others = landmarks.filter((l) => !LANDMARK_KINDS[l.kind]);
  if (others.length) groups.push({ kind: "other", items: others });

  const counts = await db.prepare(`SELECT transaction_type tx, property_type type, COUNT(*) n, MIN(price) min FROM listings
    WHERE status = 'live' AND locality_id = ? GROUP BY tx, type ORDER BY tx, n DESC`).all(loc.id) as Array<{ tx: string; type: string; n: number; min: number }>;
  const total = counts.reduce((s, c) => s + c.n, 0);
  const latest = await db.prepare(`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE l.status = 'live' AND l.locality_id = ? ORDER BY l.published_at DESC LIMIT 8`).all(loc.id) as Card[];
  const saved = new Set(user ? (await db.prepare("SELECT listing_id FROM shortlists WHERE user_id = ?").all(user.id) as { listing_id: number }[]).map((r) => r.listing_id) : []);
  const projects = await db.prepare(`${PROJECT_CARD_SQL} WHERE p.approved = 1 AND p.locality_id = ? ORDER BY p.featured DESC, p.created_at DESC LIMIT 6`).all(loc.id) as ProjectCardRow[];
  const reviews = (await db.prepare(`SELECT r.id, r.rating, r.body, r.created_at, r.user_id, u.name FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.locality_id = ? AND r.status = 'published' ORDER BY r.created_at DESC`).all(loc.id) as ReviewRow[]).map((r) => ({ ...r, name: shortName(r.name) }));
  const mine = user ? (await db.prepare("SELECT rating, body FROM reviews WHERE user_id = ? AND locality_id = ?").get(user.id, loc.id) as { rating: number; body: string } | undefined) : undefined;
  const nearby = await db.prepare(`SELECT slug, name, ((lat-?)*(lat-?) + (lng-?)*(lng-?)) d FROM localities WHERE city_id = ? AND id <> ? ORDER BY d LIMIT 6`).all(loc.lat, loc.lat, loc.lng, loc.lng, loc.city_id, loc.id) as Array<{ slug: string; name: string }>;
  const ratings = [["Overall", loc.rating], ["Connectivity", loc.connectivity], ["Safety", loc.safety], ["Lifestyle", loc.lifestyle]] as const;
  const searchBase = `/search?city=${loc.city_slug}&loc=${loc.id}`;
  const jsonLd = { "@context": "https://schema.org", "@type": "Place", name: `${loc.name}, ${loc.city_name}`, geo: { "@type": "GeoCoordinates", latitude: loc.lat, longitude: loc.lng }, ...(reviews.length ? { aggregateRating: { "@type": "AggregateRating", ratingValue: (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1), reviewCount: reviews.length } } : {}) };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="border-b border-line bg-card">
        <Container className="py-8 md:py-12">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: loc.city_name, href: `/localities/${loc.city_slug}` }, { label: loc.name }]} />
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-8 items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Locality guide · {loc.city_name}</p>
              <h1 className="font-display text-[48px] md:text-[72px] leading-[0.95] mt-2">{loc.name}</h1>
              {loc.description && <p className="mt-4 text-ink-2 leading-relaxed max-w-2xl">{loc.description}</p>}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`${searchBase}&tx=sell`} className={btnClass("primary")}>Buy in {loc.name}</Link>
                <Link href={`${searchBase}&tx=rent`} className={btnClass("secondary")}>Rent in {loc.name}</Link>
              </div>
            </div>
            <dl className="grid grid-cols-3 border border-line rounded-[var(--radius-md)] divide-x divide-line bg-paper">
              <div className="p-4"><dt className="text-xs text-muted">Avg. price</dt><dd className="num text-lg font-semibold mt-1">{last ? `₹${formatINR(last.psf)}` : "—"}<span className="text-xs font-normal text-muted">/sq ft</span></dd><dd className="text-xs"><Change value={pctChange(last?.psf ?? null, ly?.psf ?? null)} /> <span className="text-muted">1y</span></dd></div>
              <div className="p-4"><dt className="text-xs text-muted">2 BHK rent</dt><dd className="num text-lg font-semibold mt-1">{last ? `₹${formatINR(last.rent)}` : "—"}</dd><dd className="text-xs"><Change value={pctChange(last?.rent ?? null, ly?.rent ?? null)} /> <span className="text-muted">1y</span></dd></div>
              <div className="p-4"><dt className="text-xs text-muted">Live listings</dt><dd className="num text-lg font-semibold mt-1">{total}</dd><dd className="text-xs text-muted">{projects.length} project{projects.length === 1 ? "" : "s"}</dd></div>
            </dl>
          </div>
        </Container>
      </section>

      <Container className="py-10 space-y-14">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-8">
          <section aria-labelledby="ratings-h">
            <h2 id="ratings-h" className="font-display text-3xl mb-4">Ratings</h2>
            <div className="space-y-4">
              {ratings.map(([label, v]) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1.5"><span className={label === "Overall" ? "font-medium" : "text-ink-2"}>{label}</span><span className="num font-semibold">{v ? v.toFixed(1) : "—"}<span className="text-muted font-normal">/5</span></span></div>
                  <div className="h-2 rounded-full bg-paper-2 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={5} aria-valuenow={v ?? 0} aria-label={`${label} rating`}>
                    <div className={label === "Overall" ? "h-full bg-ink" : "h-full bg-accent"} style={{ width: `${((v ?? 0) / 5) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-4">Based on resident reviews and 10cent field surveys.</p>
          </section>
          <section aria-labelledby="trend-h" className="min-w-0">
            <div className="flex items-end justify-between gap-3 mb-4">
              <h2 id="trend-h" className="font-display text-3xl">Price trend</h2>
              <Link href={`/tools/price-trends?city=${loc.city_slug}&loc=${loc.id}`} className="text-sm font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">Compare localities <ArrowRight size={15} /></Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card border border-line rounded-[var(--radius-md)] p-4">
                <div className="text-sm font-medium mb-1">Price per sq ft</div>
                <LineChart points={trend.map((t) => ({ x: monthLabel(t.month), y: t.psf }))} format={(n) => `₹${formatINR(n)}`} labelEvery={12} />
              </div>
              <div className="bg-card border border-line rounded-[var(--radius-md)] p-4">
                <div className="text-sm font-medium mb-1">2 BHK rent / month</div>
                <LineChart points={trend.map((t) => ({ x: monthLabel(t.month), y: t.rent }))} format={(n) => `₹${formatINR(n)}`} labelEvery={12} color="var(--color-accent)" />
              </div>
            </div>
          </section>
        </div>

        <section aria-labelledby="near-h">
          <h2 id="near-h" className="font-display text-3xl mb-4">What&apos;s nearby</h2>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 content-start">
              {groups.length ? groups.map((g) => {
                const Icon = KIND_ICON[g.kind] ?? MapPin;
                return (
                  <div key={g.kind}>
                    <h3 className="flex items-center gap-2 text-sm font-medium"><Icon size={16} className="text-accent-ink" aria-hidden />{LANDMARK_KINDS[g.kind] ?? "Other places"}</h3>
                    <ul className="mt-2 space-y-1 text-sm text-ink-2">{g.items.map((l) => <li key={l.name}>{l.name}</li>)}</ul>
                  </div>
                );
              }) : <p className="text-sm text-muted">We haven&apos;t mapped landmarks for {loc.name} yet.</p>}
            </div>
            <MiniMap center={[loc.lat, loc.lng]} zoom={14} className="h-80" points={[{ lat: loc.lat, lng: loc.lng, label: loc.name, active: true }, ...landmarks.filter((l) => l.lat && l.lng).map((l) => ({ lat: l.lat!, lng: l.lng!, label: l.name }))]} />
          </div>
        </section>

        <section aria-labelledby="supply-h">
          <h2 id="supply-h" className="font-display text-3xl mb-4">Homes and spaces on 10cent</h2>
          {counts.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-line">
              {counts.map((c) => (
                <Link key={`${c.tx}-${c.type}`} href={`${searchBase}&tx=${c.tx}&type=${c.type}`} className="group border-r border-b border-line bg-card p-4 hover:bg-paper-2">
                  <div className="text-xs text-muted">{c.tx === "sell" ? "For sale" : c.tx === "rent" ? "For rent" : "PG"}</div>
                  <div className="font-medium mt-0.5">{PROPERTY_TYPE_LABEL[c.type] ?? c.type}</div>
                  <div className="flex items-end justify-between mt-3">
                    <span className="num text-2xl font-semibold">{c.n}</span>
                    <span className="num text-xs text-muted">from {c.tx === "sell" ? formatPrice(c.min) : `₹${formatINR(c.min)}/mo`}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : <EmptyState title={`No live listings in ${loc.name} yet`} body="Post a requirement and we'll alert you when something matching comes up." action={<Link href="/requirement" className={btnClass("secondary", "sm")}>Post a requirement</Link>} />}
        </section>

        {latest.length > 0 && (
          <section>
            <SectionHeading eyebrow="Latest" title={`New in ${loc.name}`} action={<Link href={`${searchBase}&sort=newest`} className="text-sm font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">All {total} <ArrowRight size={15} /></Link>} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {latest.map((l) => <ListingCard key={l.id} l={l} saved={saved.has(l.id)} />)}
            </div>
          </section>
        )}

        {projects.length > 0 && (
          <section>
            <SectionHeading eyebrow="New projects" title={`Projects in ${loc.name}`} action={<Link href={`/projects?city=${loc.city_slug}&loc=${loc.id}`} className="text-sm font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">All projects <ArrowRight size={15} /></Link>} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{projects.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
          </section>
        )}

        <section aria-labelledby="reviews-h" className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
          <div>
            <h2 id="reviews-h" className="font-display text-3xl mb-4">What residents say</h2>
            <ReviewSummary reviews={reviews} />
            <div className="mt-4"><ReviewList reviews={reviews} meId={user?.id} /></div>
          </div>
          <div className="lg:sticky lg:top-24">
            <ReviewForm action={submitReview.bind(null, { kind: "locality", id: loc.id, path })} signedIn={!!user} loginHref={`/login?next=${encodeURIComponent(path + "#reviews-h")}`} existing={mine ?? null} subject={loc.name} />
          </div>
        </section>

        {nearby.length > 0 && (
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-3">Nearby localities</h2>
            <div className="flex flex-wrap gap-2">
              {nearby.map((n) => <Link key={n.slug} href={`/localities/${loc.city_slug}/${n.slug}`} className="h-8 px-3 inline-flex items-center rounded-full border border-line bg-card text-sm hover:border-ink-2">{n.name}</Link>)}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}
