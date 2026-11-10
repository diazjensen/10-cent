import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { CARD_FROM, CARD_SELECT, getCities, type ListingCard as Card } from "@/lib/listings";
import { formatINR } from "@/lib/format";
import { median } from "@/lib/tools/valuation";
import { ToolShell } from "@/components/tools/shell";
import { ValuationForm, type ValuationParams } from "@/components/tools/valuation-form";
import { ListingCard } from "@/components/listing-card";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Property valuation estimator",
  description: "Estimate the market value of a flat from its locality, size, age, floor and furnishing, with comparable live listings.",
  alternates: { canonical: "/tools/valuation" },
};

const n = (v: unknown, d: number) => { const x = Number(v); return Number.isFinite(x) && v !== "" && v != null ? x : d; };

export default async function ValuationPage({ searchParams }: PageProps<"/tools/valuation">) {
  const sp = await searchParams;
  const cities = getCities();
  const locs = db.prepare(`SELECT lo.id, lo.name, c.slug city,
      (SELECT avg_price_sqft FROM price_trends t WHERE t.locality_id = lo.id ORDER BY month DESC LIMIT 1) psf
    FROM localities lo JOIN cities c ON c.id = lo.city_id ORDER BY lo.name`).all() as Array<{ id: number; name: string; city: string; psf: number | null }>;
  const city = cities.find((c) => c.slug === sp.city)?.slug ?? cities[0].slug;
  const locId = n(sp.loc, 0);
  const loc = locs.find((l) => l.id === locId && l.city === city) ?? locs.find((l) => l.city === city)!;
  const furn = (["unfurnished", "semi", "furnished"] as const).find((f) => f === sp.furn) ?? "semi";
  const p: ValuationParams = { city, loc: loc.id, bhk: Math.min(5, Math.max(1, n(sp.bhk, 2))), area: Math.max(0, n(sp.area, 1200)), age: Math.max(0, n(sp.age, 5)), floor: Math.max(0, n(sp.floor, 4)), tf: Math.max(0, n(sp.tf, 12)), furn };

  const comps = p.area > 0 ? db.prepare(`SELECT ${CARD_SELECT} ${CARD_FROM}
      WHERE l.status = 'live' AND l.transaction_type = 'sell' AND l.locality_id = ? AND l.property_type IN ('apartment','house','villa')
        AND ${p.bhk >= 5 ? "l.bhk >= 5" : "l.bhk = ?"}
        AND COALESCE(l.super_area, l.builtup_area, l.carpet_area) BETWEEN ? AND ?
      ORDER BY ABS(COALESCE(l.super_area, l.builtup_area, l.carpet_area) - ?) LIMIT 8`)
      .all(...[loc.id, ...(p.bhk >= 5 ? [] : [p.bhk]), p.area * 0.65, p.area * 1.35, p.area]) as Card[] : [];
  const user = await getUser();
  const saved = new Set(user ? (db.prepare("SELECT listing_id FROM shortlists WHERE user_id = ?").all(user.id) as { listing_id: number }[]).map((r) => r.listing_id) : []);
  const compPsf = median(comps.filter((c) => c.area).map((c) => c.price / (c.area as number)));

  return (
    <ToolShell slug="valuation" title="Property valuation" intro="A quick, explainable estimate for a flat: the locality's average rate, adjusted for size, age, floor and furnishing. Use it to sanity-check an asking price, not as a bank valuation.">
      <ValuationForm cities={cities.map((c) => ({ slug: c.slug, name: c.name }))} locs={locs} initial={p} />
      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Comparable live listings</p>
            <h2 className="font-display text-3xl mt-1">{p.bhk >= 5 ? "5+" : p.bhk} BHK for sale in {loc.name}</h2>
          </div>
          {compPsf && <p className="text-sm text-ink-2 num">Median asking rate of these: <b>₹{formatINR(Math.round(compPsf))}/sq ft</b></p>}
        </div>
        {comps.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {comps.map((c) => <ListingCard key={c.id} l={c} saved={saved.has(c.id)} compact />)}
          </div>
        ) : (
          <EmptyState title="No close matches live right now" body="We look for listings in the same locality with the same configuration and an area within 35% of yours. Try a different BHK or area." />
        )}
      </section>
    </ToolShell>
  );
}
