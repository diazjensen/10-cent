import type { Metadata } from "next";
import Link from "next/link";
import { getCities, getCity } from "@/lib/listings";
import { localityStats, priceTrend, pctChange, monthLabel, getLocalityById } from "@/lib/content/localities";
import { formatINR } from "@/lib/format";
import { ToolShell } from "@/components/tools/shell";
import { Change } from "@/components/content/change";
import { Card, LineChart, Select, btnClass, cx } from "@/components/ui";

export const metadata: Metadata = {
  title: "Property price trends by city and locality",
  description: "Average price per sq ft and 2 BHK rent by locality over the last three years, with year-on-year change.",
  alternates: { canonical: "/tools/price-trends" },
};

export default async function PriceTrends({ searchParams }: PageProps<"/tools/price-trends">) {
  const sp = await searchParams;
  const cities = await getCities();
  const city = await getCity(typeof sp.city === "string" ? sp.city : "") ?? (await getCity(cities[0].slug))!;
  const stats = await localityStats(city.id);
  const sort = typeof sp.sort === "string" ? sp.sort : "name";
  const sorted = [...stats].sort((a, b) =>
    sort === "psf" ? (b.psf ?? 0) - (a.psf ?? 0)
    : sort === "change" ? (pctChange(b.psf, b.psf_ly) ?? -99) - (pctChange(a.psf, a.psf_ly) ?? -99)
    : sort === "rent" ? (b.rent ?? 0) - (a.rent ?? 0)
    : a.name.localeCompare(b.name));
  const locId = Number(sp.loc) || 0;
  const loc = locId ? await getLocalityById(locId) : undefined;
  const selected = loc && loc.city_id === city.id ? loc : await getLocalityById(sorted.find((s) => s.trending)?.id ?? sorted[0]?.id ?? 0);
  const trend = selected ? await priceTrend(selected.id) : [];
  const selStat = stats.find((s) => s.id === selected?.id);
  const cityAvg = stats.filter((s) => s.psf).reduce((a, s) => a + (s.psf ?? 0), 0) / Math.max(1, stats.filter((s) => s.psf).length);
  const q = (o: Record<string, string | number>) => `/tools/price-trends?${new URLSearchParams({ city: city.slug, sort, ...(selected ? { loc: String(selected.id) } : {}), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) })}`;

  return (
    <ToolShell slug="price-trends" title="Price trends" intro="10cent's locality index: the average asking rate per sq ft (super built-up) for resale flats and the average monthly rent for a 2 BHK, updated monthly.">
      <form method="get" className="flex flex-wrap items-end gap-3 mb-6">
        <div className="w-56">
          <label htmlFor="pt-city" className="block text-[13px] font-medium text-ink-2 mb-1.5">City</label>
          <Select id="pt-city" name="city" defaultValue={city.slug}>
            {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
        </div>
        <button className={btnClass("primary")}>Show localities</button>
        <p className="text-sm text-muted ml-auto num">City average <b className="text-ink">₹{formatINR(Math.round(cityAvg))}/sq ft</b> across {stats.length} localities</p>
      </form>

      {selected && (
        <Card className="p-5 md:p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{city.name} · last 36 months</p>
              <h2 className="font-display text-4xl mt-1">{selected.name}</h2>
            </div>
            <Link href={`/localities/${city.slug}/${selected.slug}`} className={btnClass("secondary", "sm")}>Locality guide</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
            <div>
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-medium">Price per sq ft</h3>
                <span className="num text-sm">₹{formatINR(selStat?.psf ?? 0)} <Change value={pctChange(selStat?.psf ?? null, selStat?.psf_ly ?? null)} className="text-xs ml-1" /></span>
              </div>
              <LineChart points={trend.map((t) => ({ x: monthLabel(t.month), y: t.psf }))} format={(n) => `₹${formatINR(n)}`} labelEvery={9} color="var(--color-ink)" />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-medium">2 BHK rent per month</h3>
                <span className="num text-sm">₹{formatINR(selStat?.rent ?? 0)} <Change value={pctChange(selStat?.rent ?? null, selStat?.rent_ly ?? null)} className="text-xs ml-1" /></span>
              </div>
              <LineChart points={trend.map((t) => ({ x: monthLabel(t.month), y: t.rent }))} format={(n) => `₹${formatINR(n)}`} labelEvery={9} color="var(--color-accent)" />
            </div>
          </div>
        </Card>
      )}

      <div className="overflow-x-auto bg-card border border-line rounded-[var(--radius-md)]">
        <table className="w-full text-sm min-w-[620px]">
          <thead className="bg-paper-2 text-xs text-muted">
            <tr className="text-right">
              <th className="text-left font-medium px-4 py-2.5"><Link href={q({ sort: "name" })} className={cx(sort === "name" && "text-ink")}>Locality</Link></th>
              <th className="font-medium px-4 py-2.5"><Link href={q({ sort: "psf" })} className={cx(sort === "psf" && "text-ink")}>Price / sq ft</Link></th>
              <th className="font-medium px-4 py-2.5"><Link href={q({ sort: "change" })} className={cx(sort === "change" && "text-ink")}>1-year change</Link></th>
              <th className="font-medium px-4 py-2.5"><Link href={q({ sort: "rent" })} className={cx(sort === "rent" && "text-ink")}>2 BHK rent</Link></th>
              <th className="font-medium px-4 py-2.5">Rent change</th>
              <th className="font-medium px-4 py-2.5">Live listings</th>
            </tr>
          </thead>
          <tbody className="num">
            {sorted.map((s) => (
              <tr key={s.id} className={cx("border-t border-line text-right", s.id === selected?.id && "bg-accent-soft/40")}>
                <td className="text-left px-4 py-2.5">
                  <Link href={q({ loc: s.id })} scroll={false} className="font-medium hover:text-accent-ink" aria-current={s.id === selected?.id ? "true" : undefined}>{s.name}</Link>
                  {s.trending ? <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-accent-ink">Trending</span> : null}
                </td>
                <td className="px-4 py-2.5">{s.psf ? `₹${formatINR(s.psf)}` : "—"}</td>
                <td className="px-4 py-2.5"><Change value={pctChange(s.psf, s.psf_ly)} /></td>
                <td className="px-4 py-2.5">{s.rent ? `₹${formatINR(s.rent)}` : "—"}</td>
                <td className="px-4 py-2.5"><Change value={pctChange(s.rent, s.rent_ly)} /></td>
                <td className="px-4 py-2.5"><Link className="underline underline-offset-2 decoration-line-2 hover:decoration-ink" href={`/search?city=${city.slug}&loc=${s.id}`}>{s.live}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mt-3">Rates are averages of asking prices on 10cent and partner data, not registered transaction values. Individual projects can differ by 20% or more.</p>
    </ToolShell>
  );
}
