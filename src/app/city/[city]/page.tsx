import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { CARD_FROM, CARD_SELECT, getCity, type ListingCard as Card } from "@/lib/listings";
import { PROPERTY_TYPES } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import { shortlistIds } from "@/lib/seeker/detail";
import { Breadcrumbs, Container, SectionHeading, btnClass } from "@/components/ui";
import { ResultCard } from "@/components/search/result-card";
import { CompareTray } from "@/components/property/compare-ui";

export async function generateMetadata({ params }: PageProps<"/city/[city]">): Promise<Metadata> {
  const { city: slug } = await params;
  const city = await getCity(slug);
  if (!city) return { title: "City not found" };
  const n = (await db.prepare("SELECT COUNT(*) n FROM listings WHERE status = 'live' AND city_id = ?").get(city.id) as { n: number }).n;
  return {
    title: `Property in ${city.name}: flats, houses and plots for sale and rent`,
    description: `${formatINR(n)} verified properties in ${city.name}, ${city.state}. Flats, independent houses, villas, plots, PGs and commercial space for sale and rent, direct from owners, agents and builders.`,
    alternates: { canonical: `/property-in-${city.slug}` },
  };
}

export default async function CityPage({ params }: PageProps<"/city/[city]">) {
  const { city: slug } = await params;
  const city = await getCity(slug);
  if (!city) notFound();
  const user = await getUser();
  const saved = await shortlistIds(user?.id);

  const byType = await db.prepare(`SELECT property_type, transaction_type, COUNT(*) n FROM listings WHERE status = 'live' AND city_id = ? GROUP BY 1, 2`).all(city.id) as Array<{ property_type: string; transaction_type: string; n: number }>;
  const count = (type: string | null, tx: string | null) => byType.filter((r) => (!type || r.property_type === type) && (!tx || r.transaction_type === tx)).reduce((s, r) => s + r.n, 0);
  const total = count(null, null);

  const locs = await db.prepare(`
    SELECT lo.id, lo.name, lo.slug, lo.rating, lo.trending,
      (SELECT COUNT(*) FROM listings l WHERE l.locality_id = lo.id AND l.status = 'live') n,
      (SELECT COUNT(*) FROM listings l WHERE l.locality_id = lo.id AND l.status = 'live' AND l.transaction_type = 'sell') sale,
      (SELECT COUNT(*) FROM listings l WHERE l.locality_id = lo.id AND l.status = 'live' AND l.transaction_type = 'rent') rent,
      (SELECT avg_price_sqft FROM price_trends t WHERE t.locality_id = lo.id ORDER BY month DESC LIMIT 1) psf,
      (SELECT avg_price_sqft FROM price_trends t WHERE t.locality_id = lo.id ORDER BY month DESC LIMIT 1 OFFSET 12) psf_ly,
      (SELECT avg_rent_2bhk FROM price_trends t WHERE t.locality_id = lo.id ORDER BY month DESC LIMIT 1) rent2
    FROM localities lo WHERE lo.city_id = ? ORDER BY n DESC, lo.trending DESC, lo.name LIMIT 12`).all(city.id) as Array<{ id: number; name: string; slug: string; rating: number | null; trending: number; n: number; sale: number; rent: number; psf: number | null; psf_ly: number | null; rent2: number | null }>;

  const latest = await db.prepare(`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE l.status = 'live' AND l.city_id = ? ORDER BY l.published_at DESC LIMIT 8`).all(city.id) as Card[];
  const avgPsf = locs.filter((l) => l.psf).reduce((s, l, _, a) => s + (l.psf ?? 0) / a.length, 0);
  const projects = (await db.prepare("SELECT COUNT(*) n FROM projects WHERE city_id = ? AND approved = 1").get(city.id) as { n: number }).n;

  const s = (q: string) => `/search?city=${city.slug}${q ? `&${q}` : ""}`;
  const quick = [
    { label: `Flats for sale in ${city.name}`, href: s("tx=sell&type=apartment"), n: count("apartment", "sell") },
    { label: `Flats for rent in ${city.name}`, href: s("tx=rent&type=apartment"), n: count("apartment", "rent") },
    { label: "Independent houses & villas for sale", href: s("tx=sell&type=house,villa"), n: count("house", "sell") + count("villa", "sell") },
    { label: "Houses & villas for rent", href: s("tx=rent&type=house,villa"), n: count("house", "rent") + count("villa", "rent") },
    { label: "Plots and land", href: s("tx=sell&type=plot"), n: count("plot", "sell") },
    { label: "PG and co-living", href: s("tx=pg"), n: count(null, "pg") },
    { label: "Office space", href: s("cat=commercial&type=office"), n: count("office", null) },
    { label: "Shops and showrooms", href: s("cat=commercial&type=shop"), n: count("shop", null) },
  ];
  const budgets = [
    { label: "2 BHK under ₹75 L", href: s("tx=sell&bhk=2&max=7500000") },
    { label: "3 BHK under ₹1.5 Cr", href: s("tx=sell&bhk=3&max=15000000") },
    { label: "Ready to move flats", href: s("tx=sell&type=apartment&cs=ready") },
    { label: "New launch, RERA approved", href: s("tx=sell&newlaunch=1&rera=1") },
    { label: "1 BHK rent under ₹20,000", href: s("tx=rent&bhk=1&max=20000") },
    { label: "Furnished 2 BHK for rent", href: s("tx=rent&bhk=2&furn=furnished") },
    { label: "Verified owner listings", href: s("by=owner&verified=1") },
    { label: "Family-friendly rentals", href: s("tx=rent&tenant=family") },
  ];

  return (
    <>
      <section className="border-b border-line">
        <Container className="pt-6 pb-10 md:pb-14">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: `Property in ${city.name}` }]} />
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{city.state}</p>
          <h1 className="font-display text-[44px] md:text-[68px] leading-[0.98] tracking-[-0.02em] mt-2">Property in {city.name}</h1>
          <p className="mt-4 max-w-2xl text-ink-2 text-[15px] leading-relaxed">
            Flats, houses, plots, PGs and offices across {locs.length} localities, posted directly by owners, agents and builders. Every listing passes automated checks before it goes live; look for the Verified badge for physically inspected homes.
          </p>
          <dl className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line rounded-[var(--radius-md)] overflow-hidden max-w-3xl">
            {[
              ["Live listings", formatINR(total)],
              ["For sale", formatINR(count(null, "sell"))],
              ["For rent & PG", formatINR(count(null, "rent") + count(null, "pg"))],
              ["Avg. price", avgPsf ? `₹${formatINR(Math.round(avgPsf))}/sq ft` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="bg-card px-4 py-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="num text-xl font-semibold tracking-tight mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href={s("tx=sell")} className={btnClass("primary", "md")}>Buy in {city.name}</Link>
            <Link href={s("tx=rent")} className={btnClass("secondary", "md")}>Rent in {city.name}</Link>
            {projects > 0 && <Link href={`/projects?city=${city.slug}`} className={btnClass("ghost", "md")}>{projects} new projects <ArrowUpRight size={15} aria-hidden /></Link>}
          </div>
        </Container>
      </section>

      <Container className="py-12 space-y-14 pb-24">
        <section>
          <SectionHeading eyebrow="Browse by type" title={`What's available in ${city.name}`} />
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-[var(--radius-md)] overflow-hidden">
            {quick.map((q) => (
              <li key={q.label} className="bg-card">
                <Link href={q.href} className="group flex items-center justify-between gap-3 px-4 py-4 h-full hover:bg-paper-2">
                  <span className="text-sm leading-snug">{q.label}</span>
                  <span className="num text-sm text-muted group-hover:text-ink">{formatINR(q.n)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid md:grid-cols-[1fr_1fr] gap-6">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-2">Listings by property type</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="font-normal py-1.5">Type</th><th className="font-normal py-1.5 text-right">Sale</th><th className="font-normal py-1.5 text-right">Rent / PG</th></tr></thead>
                <tbody>
                  {PROPERTY_TYPES.filter((t) => count(t.value, null) > 0).map((t) => (
                    <tr key={t.value} className="border-t border-line">
                      <td className="py-2">{t.label}</td>
                      <td className="py-2 text-right num">{count(t.value, "sell") ? <Link className="underline underline-offset-2" href={s(`tx=sell&type=${t.value}`)}>{count(t.value, "sell")}</Link> : <span className="text-muted">0</span>}</td>
                      <td className="py-2 text-right num">{count(t.value, "rent") + count(t.value, "pg") ? <Link className="underline underline-offset-2" href={s(`${t.value === "pg" ? "tx=pg" : "tx=rent"}&type=${t.value}`)}>{count(t.value, "rent") + count(t.value, "pg")}</Link> : <span className="text-muted">0</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-2">Popular searches</h3>
              <ul className="flex flex-wrap gap-1.5">
                {budgets.map((b) => (
                  <li key={b.label}><Link href={b.href} className="inline-flex items-center h-8 px-3 rounded-full border border-line-2 bg-card text-[13px] hover:border-ink">{b.label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="Neighbourhoods" title={`Popular localities in ${city.name}`} />
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {locs.map((l) => {
              const chg = l.psf && l.psf_ly ? ((l.psf - l.psf_ly) / l.psf_ly) * 100 : null;
              return (
                <li key={l.id} className="bg-card border border-line rounded-[var(--radius-md)] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={s(`loc=${l.id}`)} className="font-medium hover:underline underline-offset-2">{l.name}</Link>
                      {l.trending ? <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-accent-ink">Trending</span> : null}
                      <div className="text-xs text-muted mt-0.5 num">{l.n} listings · {l.sale} sale · {l.rent} rent</div>
                    </div>
                    {l.rating ? <span className="num text-xs bg-paper-2 rounded px-1.5 py-0.5" title="Locality rating out of 5">{l.rating.toFixed(1)}</span> : null}
                  </div>
                  <div className="mt-3 flex items-baseline gap-3 text-sm">
                    {l.psf ? <span className="num">₹{formatINR(l.psf)}<span className="text-muted text-xs">/sq ft</span></span> : null}
                    {chg != null && <span className={`num text-xs ${chg >= 0 ? "text-trust" : "text-danger"}`}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}% YoY</span>}
                    {l.rent2 ? <span className="num text-xs text-muted ml-auto">2 BHK ~₹{formatINR(l.rent2)}/mo</span> : null}
                  </div>
                  <div className="mt-3 pt-3 border-t border-line flex gap-4 text-xs">
                    <Link href={s(`tx=sell&loc=${l.id}`)} className="underline underline-offset-2">Buy</Link>
                    <Link href={s(`tx=rent&loc=${l.id}`)} className="underline underline-offset-2">Rent</Link>
                    <Link href={`/localities/${city.slug}/${l.slug}`} className="text-muted hover:text-ink ml-auto">Locality guide</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {latest.length > 0 && (
          <section>
            <SectionHeading eyebrow="Just listed" title={`Latest properties in ${city.name}`} action={<Link href={s("sort=newest")} className="text-sm underline underline-offset-2 shrink-0">See all</Link>} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {latest.map((l) => <ResultCard key={l.id} l={l} saved={saved.has(l.id)} />)}
            </div>
          </section>
        )}
      </Container>
      <CompareTray />
    </>
  );
}
