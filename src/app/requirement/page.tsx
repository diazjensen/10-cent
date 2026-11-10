import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCities, getLocalities, searchListings } from "@/lib/listings";
import { formatDate, formatINR, formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABEL } from "@/lib/constants";
import { createRequirement, toggleRequirement, deleteRequirement } from "./actions";
import { RequirementForm } from "@/components/account/requirement-form";
import { ListingCard } from "@/components/listing-card";
import { Badge, Breadcrumbs, Container, Notice, btnClass, cx } from "@/components/ui";

export const metadata: Metadata = {
  title: "Post your property requirement",
  description: "Tell us what you're looking for and see matching verified listings instantly. We'll alert you when new ones are posted.",
  alternates: { canonical: "/requirement" },
};

type Req = { id: number; transaction_type: string; city_id: number; city_slug: string; city_name: string; locality_ids: string | null; property_type: string | null; bhk: number | null; budget_min: number | null; budget_max: number | null; notes: string | null; active: number; created_at: string };

export default async function RequirementPage({ searchParams }: PageProps<"/requirement">) {
  const sp = await searchParams;
  const posted = Number(sp.posted) || 0;
  const user = await getUser();
  const jar = await cookies();
  const cities = await getCities();
  const defaultCity = cities.find((c) => c.slug === jar.get("tc_city")?.value)?.slug ?? cities[0]?.slug ?? "";
  const cityData = await Promise.all(cities.map(async (c) => ({ slug: c.slug, name: c.name, localities: (await getLocalities(c.id)).map((l) => ({ id: l.id, name: l.name })) })));
  const locName = Object.fromEntries(cityData.flatMap((c) => c.localities.map((l) => [l.id, l.name])));
  const reqs = user ? (await db.prepare(`SELECT r.*, c.slug city_slug, c.name city_name FROM requirements r JOIN cities c ON c.id = r.city_id WHERE r.user_id = ? ORDER BY r.active DESC, r.created_at DESC`).all(user.id) as Req[]) : [];
  const saved = new Set(user ? (await db.prepare("SELECT listing_id FROM shortlists WHERE user_id = ?").all(user.id) as { listing_id: number }[]).map((r) => r.listing_id) : []);

  const filtersFor = (r: Req) => ({
    city: r.city_slug, tx: r.transaction_type, loc: r.locality_ids ?? undefined, type: r.property_type ?? undefined,
    bhk: r.bhk ? String(r.bhk) : undefined, min: r.budget_min ? String(r.budget_min) : undefined, max: r.budget_max ? String(r.budget_max) : undefined,
  });
  const matches = await Promise.all(reqs.map((r) => (r.active ? searchListings(filtersFor(r), { pageSize: 4 }) : null)));
  const qs = (r: Req) => new URLSearchParams(Object.entries(filtersFor(r)).filter(([, v]) => v) as [string, string][]).toString();
  const money = (r: Req, n: number) => (r.transaction_type === "sell" ? formatPrice(n, { short: true }) : `₹${formatINR(n)}`);

  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, ...(user ? [{ label: "My account", href: "/account" }] : []), { label: "Requirements" }]} />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-10 mt-4 items-start">
        <div>
          <h1 className="font-display text-[44px] md:text-[60px] leading-[1]">Tell us what you need.</h1>
          <p className="text-ink-2 mt-3 leading-relaxed max-w-lg">Post a requirement and we&apos;ll show matching live listings right away, then alert you when new ones are posted. Your number is never shown to posters unless you contact them.</p>
          {!user && (
            <div className="mt-6 bg-card border border-line rounded-[var(--radius-md)] p-5">
              <p className="text-sm text-ink-2">Log in with your mobile number to post a requirement and get alerts.</p>
              <Link href="/login?next=/requirement" className={btnClass("primary", "md", "mt-3")}>Log in to continue</Link>
            </div>
          )}
        </div>
        {user && <RequirementForm cities={cityData} defaultCity={defaultCity} action={createRequirement} />}
      </div>

      {user && reqs.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-3xl mb-4">Your requirements</h2>
          {posted > 0 && reqs.some((r) => r.id === posted) && <Notice tone="trust" className="mb-4">Requirement posted. Here are the listings that match it today.</Notice>}
          <div className="space-y-8">
            {reqs.map((r, ri) => {
              const m = matches[ri];
              const chips = [
                r.transaction_type === "sell" ? "Buy" : r.transaction_type === "rent" ? "Rent" : "PG", r.city_name,
                r.locality_ids ? r.locality_ids.split(",").map((id) => locName[Number(id)]).filter(Boolean).join(", ") : null,
                r.property_type ? PROPERTY_TYPE_LABEL[r.property_type] : null, r.bhk ? `${r.bhk >= 5 ? "5+" : r.bhk} BHK` : null,
                r.budget_min && r.budget_max ? `${money(r, r.budget_min)} – ${money(r, r.budget_max)}` : r.budget_max ? `Up to ${money(r, r.budget_max)}` : null,
              ].filter(Boolean) as string[];
              return (
                <div key={r.id} id={`req-${r.id}`} className={cx("scroll-mt-24 bg-card border rounded-[var(--radius-md)] p-4 md:p-5", r.id === posted ? "border-accent" : "border-line")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-1.5">{chips.map((c) => <span key={c} className="text-xs bg-paper-2 text-ink-2 rounded-full px-2 py-0.5">{c}</span>)}</div>
                      {r.notes && <p className="text-sm text-ink-2 mt-2">{r.notes}</p>}
                      <p className="text-xs text-muted mt-2">Posted {formatDate(r.created_at)} · {r.active ? <Badge tone="trust">Active</Badge> : <Badge>Paused</Badge>}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {r.active ? <Link href={`/search?${qs(r)}`} className={btnClass("secondary", "sm")}>{m?.total === 1 ? "1 match" : `All ${m?.total ?? 0} matches`}</Link> : null}
                      <form action={toggleRequirement}><input type="hidden" name="id" value={r.id} /><button className={btnClass("ghost", "sm")}>{r.active ? "Pause" : "Reactivate"}</button></form>
                      <form action={deleteRequirement}><input type="hidden" name="id" value={r.id} /><button className={btnClass("ghost", "sm", "hover:text-danger")}>Delete</button></form>
                    </div>
                  </div>
                  {m && (m.rows.length ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">{m.rows.map((l) => <ListingCard key={l.id} l={l} saved={saved.has(l.id)} compact />)}</div>
                  ) : <p className="text-sm text-muted mt-4">No live listings match yet. We&apos;ll notify you as soon as one is posted. Widening the budget or localities usually helps.</p>)}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </Container>
  );
}
