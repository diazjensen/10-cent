import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCity, getCities } from "@/lib/listings";
import { localityStats, pctChange } from "@/lib/content/localities";
import { formatINR } from "@/lib/format";
import { Change } from "@/components/content/change";
import { Breadcrumbs, Container, cx } from "@/components/ui";

export async function generateMetadata({ params }: PageProps<"/localities/[city]">): Promise<Metadata> {
  const { city } = await params;
  const c = await getCity(city);
  if (!c) return { title: "City not found" };
  return {
    title: `Localities in ${c.name}: prices, rents and ratings`,
    description: `Compare ${c.name} localities by price per sq ft, 2 BHK rent, one-year change and resident ratings.`,
    alternates: { canonical: `/localities/${c.slug}` },
  };
}

export default async function CityLocalities({ params }: PageProps<"/localities/[city]">) {
  const { city } = await params;
  const c = await getCity(city);
  if (!c) notFound();
  const rows = await localityStats(c.id);
  const cities = await getCities();
  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: `Localities in ${c.name}` }]} />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{c.state}</p>
          <h1 className="font-display text-[44px] md:text-[64px] leading-[1]">Localities in {c.name}</h1>
        </div>
        <nav aria-label="Other cities" className="flex flex-wrap gap-1.5">
          {cities.map((x) => (
            <Link key={x.slug} href={`/localities/${x.slug}`} aria-current={x.slug === c.slug ? "page" : undefined} className={cx("h-8 px-3 inline-flex items-center rounded-full text-[13px] border", x.slug === c.slug ? "bg-ink text-white border-ink" : "bg-card border-line text-ink-2 hover:border-ink-2")}>{x.name}</Link>
          ))}
        </nav>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r) => (
          <Link key={r.id} href={`/localities/${c.slug}/${r.slug}`} className="group bg-card border border-line rounded-[var(--radius-md)] p-5 hover:shadow-[var(--shadow-pop)] transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-medium text-lg group-hover:text-accent-ink">{r.name}</h2>
                <p className="text-xs text-muted num">{r.live} live listing{r.live === 1 ? "" : "s"}{r.trending ? " · Trending" : ""}</p>
              </div>
              {r.rating && <span className="num text-sm font-semibold bg-paper-2 rounded px-1.5 py-0.5">{r.rating.toFixed(1)}</span>}
            </div>
            <dl className="grid grid-cols-2 gap-3 mt-4 text-sm num">
              <div><dt className="text-xs text-muted">Price / sq ft</dt><dd className="font-semibold">{r.psf ? `₹${formatINR(r.psf)}` : "—"} <Change value={pctChange(r.psf, r.psf_ly)} className="text-xs" /></dd></div>
              <div><dt className="text-xs text-muted">2 BHK rent</dt><dd className="font-semibold">{r.rent ? `₹${formatINR(r.rent)}` : "—"} <Change value={pctChange(r.rent, r.rent_ly)} className="text-xs" /></dd></div>
            </dl>
          </Link>
        ))}
      </div>
    </Container>
  );
}
