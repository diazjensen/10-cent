import { nowMs } from "@/lib/supply/time";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { db, addDays } from "@/lib/db";
import { formatDate, formatINR, timeAgo } from "@/lib/format";
import { btnClass, Card, EmptyState, Input, Stat } from "@/components/ui";
import { dashboardContext, listingQuota } from "@/lib/supply/account";
import { QuotaBar, LeadChannel } from "@/components/supply/bits";
import { viewAsAction } from "./actions";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardHome({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const { viewer, subject } = await dashboardContext();
  const uid = subject.id;
  const since = addDays(-30);
  const day30 = since.slice(0, 10);

  const live = (await db.prepare("SELECT COUNT(*) n FROM listings WHERE user_id = ? AND status = 'live'").get(uid) as { n: number }).n;
  const pending = (await db.prepare("SELECT COUNT(*) n FROM listings WHERE user_id = ? AND status = 'pending'").get(uid) as { n: number }).n;
  const st = await db.prepare(
      "SELECT COALESCE(SUM(s.views),0) views, COALESCE(SUM(s.impressions),0) imp, COALESCE(SUM(s.contacts),0) contacts FROM listing_stats s JOIN listings l ON l.id = s.listing_id WHERE l.user_id = ? AND s.day >= ?"
    ).get(uid, day30) as { views: number; imp: number; contacts: number };
  const leads30 = await db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN status <> 'new' THEN 1 ELSE 0 END) handled FROM leads WHERE poster_id = ? AND created_at >= ?").get(uid, since) as { total: number; handled: number | null };
  const rate = leads30.total ? Math.round(((leads30.handled ?? 0) / leads30.total) * 100) : null;
  const q = await listingQuota(uid);

  const latest = await db.prepare(
      `SELECT ld.id, ld.name, ld.phone, ld.message, ld.channel, ld.status, ld.created_at, COALESCE(l.title, p.name) what
     FROM leads ld LEFT JOIN listings l ON l.id = ld.listing_id LEFT JOIN projects p ON p.id = ld.project_id
     WHERE ld.poster_id = ? ORDER BY ld.created_at DESC LIMIT 6`
    ).all(uid) as Array<{ id: number; name: string | null; phone: string | null; message: string | null; channel: string; status: string; created_at: string; what: string | null }>;

  const attention = await db.prepare(
      `SELECT id, title, status, expires_at, reject_reason FROM listings WHERE user_id = ? AND (
       status IN ('expired','rejected') OR (status = 'live' AND expires_at <= ?)) ORDER BY expires_at LIMIT 6`
    ).all(uid, addDays(7)) as Array<{ id: number; title: string; status: string; expires_at: string | null; reject_reason: string | null }>;
  const noPhotos = (await db.prepare("SELECT COUNT(*) n FROM listings l WHERE user_id = ? AND status IN ('live','pending') AND NOT EXISTS (SELECT 1 FROM listing_media m WHERE m.listing_id = l.id AND m.kind = 'photo')").get(uid) as { n: number }).n;
  const unverified = (await db.prepare("SELECT COUNT(*) n FROM listings WHERE user_id = ? AND status = 'live' AND verified = 0 AND verification_requested_at IS NULL").get(uid) as { n: number }).n;

  const hour = new Date(nowMs() + 5.5 * 3600000).getUTCHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Overview · last 30 days</p>
          <h1 className="font-display text-4xl md:text-5xl leading-tight mt-1">{greet}, {(subject.name || "there").split(" ")[0]}</h1>
        </div>
        <Link href="/post-property" className={btnClass("accent", "md", "md:hidden")}>Post property</Link>
      </div>

      {viewer.role === "admin" && subject.id === viewer.id && (
        <Card className="p-4">
          <p className="font-medium">View a poster&apos;s dashboard</p>
          <p className="text-sm text-muted">Admins can open any owner, agent or builder dashboard to help with support tickets. This is logged.</p>
          <form action={viewAsAction} className="mt-3 flex gap-2 max-w-md">
            <label htmlFor="who" className="sr-only">User ID, phone or email</label>
            <Input id="who" name="who" placeholder="User ID, phone or email" required />
            <button className={btnClass("primary", "md")}>Open</button>
          </form>
          {sp.viewas === "notfound" && <p className="text-xs text-danger mt-2">No owner, agent or builder found for that ID, phone or email.</p>}
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Live listings" value={live} sub={pending ? `${pending} under review` : "None under review"} />
        <Stat label="Listing views" value={formatINR(st.views)} sub={`${formatINR(st.imp)} search impressions`} />
        <Stat label="Enquiries" value={leads30.total} sub={`${formatINR(st.contacts)} contact clicks`} />
        <Stat label="Response rate" value={rate == null ? "—" : `${rate}%`} sub={rate == null ? "No enquiries yet" : rate >= 80 ? "Great, keep it up" : "Reply to new leads faster"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <section className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-2xl">Latest responses</h2>
            <Link href="/dashboard/responses" className="text-sm text-ink-2 hover:text-ink inline-flex items-center gap-1">Inbox <ArrowRight size={14} /></Link>
          </div>
          {latest.length === 0 ? (
            <EmptyState title="No enquiries yet" body="When a buyer or tenant contacts you, they'll appear here and you'll get an SMS and email." />
          ) : (
            <Card className="divide-y divide-line">
              {latest.map((l) => (
                <div key={l.id} className="p-3.5 flex gap-3 items-start">
                  <div className="w-9 h-9 rounded-full bg-paper-2 grid place-items-center text-sm font-semibold text-ink-2 shrink-0">{(l.name || "?").slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium text-sm">{l.name || "Seeker"}</span>
                      <LeadChannel channel={l.channel} />
                      {l.status === "new" && <span className="text-[10px] font-bold uppercase tracking-wider text-accent-ink">New</span>}
                      <span className="text-xs text-muted ml-auto">{timeAgo(l.created_at)}</span>
                    </div>
                    <p className="text-xs text-muted truncate mt-0.5">{l.what}</p>
                    {l.message && <p className="text-sm text-ink-2 mt-1 line-clamp-1">{l.message}</p>}
                  </div>
                  {l.phone && <a href={`tel:+91${l.phone}`} className="w-8 h-8 grid place-items-center rounded-full border border-line-2 hover:border-ink shrink-0" aria-label={`Call ${l.name || "seeker"}`}><Phone size={14} /></a>}
                </div>
              ))}
            </Card>
          )}
        </section>

        <aside className="space-y-6 min-w-0">
          <Card className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Your plan</p>
            <p className="font-display text-3xl mt-1">{q.plan?.name ?? "Free"}</p>
            <p className="text-sm text-muted">{q.plan ? `Active until ${formatDate(q.plan.ends_at)}` : "Upgrade for more listings and higher placement"}</p>
            <QuotaBar used={q.used} limit={q.limit} className="mt-4" />
            <div className="mt-4 flex gap-2">
              <Link href="/plans" className={btnClass(q.plan ? "secondary" : "accent", "sm")}>{q.plan ? "Change plan" : "Upgrade"}</Link>
              <Link href="/dashboard/billing" className={btnClass("ghost", "sm")}>Billing</Link>
            </div>
          </Card>

          {attention.length > 0 && (
            <Card className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Needs attention</p>
              <ul className="mt-3 space-y-3">
                {attention.map((a) => (
                  <li key={a.id} className="text-sm">
                    <Link href={`/dashboard/listings?highlight=${a.id}`} className="font-medium hover:underline line-clamp-1">{a.title}</Link>
                    <p className="text-xs text-muted">
                      {a.status === "rejected" ? `Rejected: ${a.reject_reason ?? "see details"}` : a.status === "expired" ? "Expired. Renew in one click." : `Expires ${formatDate(a.expires_at)}`}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Tips</p>
            <ul className="mt-3 space-y-3 text-sm text-ink-2">
              {noPhotos > 0 && <li><b className="text-ink">{noPhotos} listing{noPhotos > 1 ? "s have" : " has"} no photos.</b> Listings with 5+ photos get noticeably more views.</li>}
              {unverified > 0 && <li><b className="text-ink">Get the Verified badge.</b> Request a field visit from My listings; verified listings rank higher.</li>}
              {rate != null && rate < 80 && <li><b className="text-ink">Reply within an hour.</b> Seekers usually contact 3 to 4 posters; the first to call back wins.</li>}
              <li><b className="text-ink">Price it right.</b> Listings priced within 10% of the locality average get the most enquiries.</li>
              <li><b className="text-ink">Renew before expiry</b> so your listing keeps its position in search.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
