import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, BadgeCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { searchListings } from "@/lib/listings";
import { formatDate } from "@/lib/format";
import { RERA_PORTALS } from "@/lib/constants";
import { submitReview } from "@/lib/content/review-actions";
import { ListingCard } from "@/components/listing-card";
import { ReviewForm, Stars } from "@/components/content/review-form";
import { ReviewList, ReviewSummary, shortName, type ReviewRow } from "@/components/content/reviews";
import { Badge, Breadcrumbs, Container, EmptyState, Pagination, Stat } from "@/components/ui";

type Agent = { id: number; name: string | null; created_at: string; kyc_status: string; company_name: string | null; about: string | null; experience_years: number | null; rera_number: string | null; website: string | null; city: string | null; state: string | null; city_slug: string | null };

async function getAgent(id: number) {
  return await db.prepare(`SELECT u.id, u.name, u.created_at, u.kyc_status, pr.company_name, pr.about, pr.experience_years, pr.rera_number, pr.website, c.name city, c.state, c.slug city_slug
    FROM users u LEFT JOIN profiles pr ON pr.user_id = u.id LEFT JOIN cities c ON c.id = pr.city_id
    WHERE u.id = ? AND u.role = 'agent' AND u.deleted_at IS NULL AND u.blocked = 0`).get(id) as Agent | undefined;
}

export async function generateMetadata({ params }: PageProps<"/agents/[id]">): Promise<Metadata> {
  const { id } = await params;
  const a = await getAgent(Number(id));
  if (!a) return { title: "Agent not found" };
  const name = a.company_name ?? a.name ?? "Agent";
  return { title: `${name}${a.city ? `, ${a.city}` : ""}: RERA agent, listings and reviews`, description: (a.about ?? `${name} on 10cent.`).slice(0, 160), alternates: { canonical: `/agents/${a.id}` } };
}

export default async function AgentPage({ params, searchParams }: PageProps<"/agents/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const a = await getAgent(Number(id));
  if (!a) notFound();
  const name = a.company_name ?? a.name ?? "Agent";
  const user = await getUser();
  const path = `/agents/${a.id}`;
  const page = Math.max(1, Number(sp.page) || 1);
  const listings = await searchListings({ poster: String(a.id), sort: "newest", page: String(page) }, { pageSize: 12 });
  const saved = new Set(user ? (await db.prepare("SELECT listing_id FROM shortlists WHERE user_id = ?").all(user.id) as { listing_id: number }[]).map((r) => r.listing_id) : []);
  const reviews = (await db.prepare(`SELECT r.id, r.rating, r.body, r.created_at, r.user_id, u.name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.agent_id = ? AND r.status = 'published' ORDER BY r.created_at DESC`).all(a.id) as ReviewRow[]).map((r) => ({ ...r, name: shortName(r.name) }));
  const mine = user ? (await db.prepare("SELECT rating, body FROM reviews WHERE user_id = ? AND agent_id = ?").get(user.id, a.id) as { rating: number; body: string } | undefined) : undefined;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;
  const mix = await db.prepare("SELECT transaction_type tx, COUNT(*) n FROM listings WHERE user_id = ? AND status = 'live' GROUP BY tx").all(a.id) as Array<{ tx: string; n: number }>;
  const localities = await db.prepare(`SELECT lo.name, COUNT(*) n FROM listings l JOIN localities lo ON lo.id = l.locality_id WHERE l.user_id = ? AND l.status = 'live' GROUP BY lo.id ORDER BY n DESC LIMIT 6`).all(a.id) as Array<{ name: string; n: number }>;
  const portal = a.state ? RERA_PORTALS[a.state] : undefined;

  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, ...(a.city_slug ? [{ label: a.city ?? "", href: `/search?city=${a.city_slug}&by=agent` }] : []), { label: name }]} />
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-8 items-start">
        <div className="flex gap-5">
          <span className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-paper-2 border border-line grid place-items-center font-display text-4xl shrink-0">{name.slice(0, 1)}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Badge>Agent</Badge>
              {a.rera_number && <Badge tone="trust" icon={<ShieldCheck size={12} aria-hidden />}>RERA registered</Badge>}
              {a.kyc_status === "verified" && <Badge tone="trust" icon={<BadgeCheck size={12} aria-hidden />}>KYC verified</Badge>}
            </div>
            <h1 className="font-display text-[40px] md:text-[56px] leading-[1] mt-2">{name}</h1>
            {a.company_name && a.name && <p className="text-sm text-muted mt-1">{a.name}{a.city ? ` · ${a.city}` : ""} · on 10cent since {formatDate(a.created_at, { month: "short", year: "numeric" })}</p>}
            {avg != null && <div className="flex items-center gap-2 mt-2 text-sm"><Stars value={avg} /> <span className="num font-medium">{avg.toFixed(1)}</span><span className="text-muted">({reviews.length})</span></div>}
            {a.about && <p className="mt-3 text-ink-2 leading-relaxed max-w-2xl">{a.about}</p>}
            {a.rera_number && (
              <p className="mt-3 text-sm"><span className="text-muted">RERA no. </span><span className="num break-all">{a.rera_number}</span>
                {portal && <> · <a href={portal} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline underline-offset-2">verify on {a.state} RERA</a></>}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Experience" value={a.experience_years ? `${a.experience_years} yrs` : "—"} />
          <Stat label="Active listings" value={listings.total} sub={mix.map((m) => `${m.n} ${m.tx === "sell" ? "sale" : m.tx}`).join(" · ") || undefined} />
          <div className="col-span-2 p-4 bg-card border border-line rounded-[var(--radius-md)]">
            <div className="text-xs text-muted">Works mostly in</div>
            <div className="text-sm mt-1">{localities.length ? localities.map((l) => l.name).join(", ") : "—"}</div>
          </div>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-3xl mb-4">Active listings</h2>
        {listings.rows.length ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{listings.rows.map((l) => <ListingCard key={l.id} l={l} saved={saved.has(l.id)} />)}</div> : <EmptyState title={`${name} has no live listings right now`} />}
        <Pagination page={listings.page} pages={listings.pages} hrefFor={(n) => `${path}${n > 1 ? `?page=${n}` : ""}`} />
      </section>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start" aria-labelledby="agent-reviews">
        <div>
          <h2 id="agent-reviews" className="font-display text-3xl mb-4">Reviews</h2>
          <ReviewSummary reviews={reviews} />
          <div className="mt-4"><ReviewList reviews={reviews} meId={user?.id} /></div>
        </div>
        <div className="lg:sticky lg:top-24">
          {user?.id === a.id ? <p className="text-sm text-muted bg-paper-2 rounded-[var(--radius-md)] p-4">This is how your public profile looks. Reviews come from people you&apos;ve worked with. <Link href="/dashboard" className="underline">Go to dashboard</Link></p> :
            <ReviewForm action={submitReview.bind(null, { kind: "agent", id: a.id, path })} signedIn={!!user} loginHref={`/login?next=${encodeURIComponent(path + "#agent-reviews")}`} existing={mine ?? null} subject={name} />}
        </div>
      </section>
    </Container>
  );
}
