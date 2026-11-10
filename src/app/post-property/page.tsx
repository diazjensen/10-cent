import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Camera, Clock, IndianRupee, MessageSquare, ShieldCheck } from "lucide-react";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCities } from "@/lib/listings";
import { btnClass, Container, Notice } from "@/components/ui";
import { PostForm } from "@/components/supply/post-form";
import { listingQuota } from "@/lib/supply/account";
import { listingToDraft } from "@/lib/supply/listing-service";

export const metadata: Metadata = {
  title: "Post property free: sell or rent out your home",
  description: "List your flat, house, plot, PG or commercial space on 10cent for free. Verified buyers and tenants contact you directly. Live within 24 hours.",
};

export default async function PostPropertyPage({ searchParams }: PageProps<"/post-property">) {
  const sp = await searchParams;
  const user = await getUser();
  if (!user) return <Landing />;

  const editId = typeof sp.edit === "string" ? Number(sp.edit) || null : null;
  let initial: Omit<NonNullable<ReturnType<typeof listingToDraft>>, "_user_id" | "_status"> | null = null;
  let status: string | undefined;
  if (editId) {
    const draft = listingToDraft(editId);
    if (!draft || (draft._user_id !== user.id && user.role !== "admin")) {
      return (
        <Container className="py-16 max-w-xl">
          <h1 className="font-display text-4xl">Listing not found</h1>
          <p className="text-muted mt-2">This listing doesn&apos;t exist or isn&apos;t yours to edit.</p>
          <Link href="/dashboard/listings" className={btnClass("primary", "md", "mt-6")}>Go to my listings</Link>
        </Container>
      );
    }
    if (["sold", "rented", "removed"].includes(draft._status)) {
      return (
        <Container className="py-16 max-w-xl">
          <h1 className="font-display text-4xl">This listing is closed</h1>
          <p className="text-muted mt-2">Sold, rented or taken-down listings can&apos;t be edited. Post a new listing instead.</p>
          <Link href="/post-property" className={btnClass("primary", "md", "mt-6")}>Post a new listing</Link>
        </Container>
      );
    }
    const { _user_id, _status, ...rest } = draft;
    void _user_id;
    initial = rest;
    status = _status;
  }

  const cities = getCities().map((c) => ({ id: c.id, name: c.name, state: c.state, lat: c.lat, lng: c.lng }));
  const localities = db.prepare("SELECT id, city_id, name, lat, lng FROM localities ORDER BY name").all() as Array<{ id: number; city_id: number; name: string; lat: number; lng: number }>;
  const avgRows = db.prepare(
    `SELECT t.locality_id, t.avg_price_sqft psf, t.avg_rent_2bhk rent2 FROM price_trends t
     JOIN (SELECT locality_id, MAX(month) m FROM price_trends GROUP BY locality_id) x ON x.locality_id = t.locality_id AND x.m = t.month`
  ).all() as Array<{ locality_id: number; psf: number; rent2: number }>;
  const averages = Object.fromEntries(avgRows.map((r) => [r.locality_id, { psf: r.psf, rent2: r.rent2 }]));
  const q = listingQuota(user.id);

  return (
    <Container className="py-8 md:py-10 max-w-4xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{editId ? `Editing listing #${editId}` : "Post property"}</p>
      <h1 className="font-display text-4xl md:text-5xl leading-[1.02] mt-1.5">{editId ? "Update your listing" : "List your property in about 5 minutes"}</h1>
      <p className="text-ink-2 mt-2 text-sm">
        {editId
          ? "Changes are reviewed before they go live."
          : <>Posting as <b>{user.name || user.phone}</b>{user.role === "seeker" ? " (you'll be listed as an owner)" : ` · ${user.role}`}. <span className="num">{q.used}</span> of <span className="num">{q.limit}</span> listings used{q.plan ? ` on ${q.plan.name}` : " on the free plan"}.</>}
      </p>
      {status === "live" && <Notice tone="warn" className="mt-4">This listing is live. Saving changes sends it back for review; it stays hidden from search until approved (usually within 24 hours).</Notice>}
      {status === "rejected" && <Notice tone="danger" className="mt-4">This listing was rejected. Fix the issues and resubmit.</Notice>}
      <div className="mt-6">
        <PostForm
          cities={cities}
          localities={localities}
          averages={averages}
          initial={initial}
          editId={editId}
          quota={{ used: q.used, limit: q.limit, planName: q.plan?.name ?? null }}
        />
      </div>
    </Container>
  );
}

function Landing() {
  const loginHref = "/login?next=/post-property&intent=post";
  const live = (db.prepare("SELECT COUNT(*) n FROM listings WHERE status = 'live'").get() as { n: number }).n;
  return (
    <>
      <section className="border-b border-line">
        <Container className="py-12 md:py-20 grid md:grid-cols-[1.15fr_1fr] gap-10 items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">For owners, agents and builders</p>
            <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mt-3">Sell or rent out<br />your property, <em className="text-accent">free</em>.</h1>
            <p className="text-ink-2 mt-5 max-w-lg text-[17px] leading-relaxed">
              Owners post up to 3 listings at no cost. Buyers and tenants who contact you have verified their phone number with OTP, so you get fewer spam calls.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={loginHref} className={btnClass("accent", "lg")}>Post property free</Link>
              <Link href="/plans" className={btnClass("secondary", "lg")}>See paid plans</Link>
            </div>
            <p className="text-xs text-muted mt-3">Log in with your mobile number. No password needed.</p>
          </div>
          <div className="bg-card border border-line rounded-[var(--radius-lg)] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">The free plan includes</p>
            <ul className="mt-4 divide-y divide-line">
              {[
                ["3 active listings", "Sale, rent, PG or commercial"],
                ["Up to 20 photos, video and floor plan", "Listings with photos get more enquiries"],
                ["60 days of visibility", "Renew in one click when it expires"],
                ["Enquiries by SMS and email", "Plus a responses inbox in your dashboard"],
              ].map(([a, b]) => (
                <li key={a} className="py-3 flex gap-3">
                  <BadgeCheck size={18} className="text-trust shrink-0 mt-0.5" aria-hidden />
                  <span><span className="font-medium">{a}</span><span className="block text-sm text-muted">{b}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>
      <Container className="py-12 md:py-16">
        <h2 className="font-display text-3xl md:text-4xl">How it works</h2>
        <ol className="mt-8 grid md:grid-cols-4 gap-6">
          {[
            [Camera, "Add details and photos", "Seven short steps: type, location pin, specs, price, amenities, photos and description. Your draft saves as you go."],
            [ShieldCheck, "Automated checks", "We check for duplicates, reused photos and unusual prices, and remove phone numbers from descriptions."],
            [Clock, "Live within 24 hours", "Our moderation team reviews every listing. You get an SMS when it goes live."],
            [MessageSquare, "Get enquiries", "Every enquiry lands in your responses inbox with the seeker's verified number."],
          ].map(([Icon, t, b], i) => {
            const I = Icon as typeof Camera;
            return (
              <li key={i} className="border-t-2 border-ink pt-4">
                <div className="flex items-center gap-2"><span className="font-display text-2xl text-accent num">0{i + 1}</span><I size={16} className="text-ink-2" aria-hidden /></div>
                <h3 className="font-medium mt-2">{t as string}</h3>
                <p className="text-sm text-muted mt-1 leading-relaxed">{b as string}</p>
              </li>
            );
          })}
        </ol>
        <div className="mt-12 grid sm:grid-cols-3 gap-4">
          <div className="bg-card border border-line rounded-[var(--radius-md)] p-5"><p className="num text-3xl font-semibold">{live.toLocaleString("en-IN")}</p><p className="text-sm text-muted mt-1">live listings on 10cent today</p></div>
          <div className="bg-card border border-line rounded-[var(--radius-md)] p-5"><p className="num text-3xl font-semibold">₹0</p><p className="text-sm text-muted mt-1">brokerage charged to owners or seekers</p></div>
          <div className="bg-card border border-line rounded-[var(--radius-md)] p-5 flex items-start gap-3"><IndianRupee size={18} className="text-accent mt-1" aria-hidden /><p className="text-sm text-ink-2">Agents and builders posting in volume can pick a <Link href="/plans" className="underline underline-offset-2">paid plan</Link> with more listings and higher placement.</p></div>
        </div>
      </Container>
    </>
  );
}
