import type { Metadata } from "next";
import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatINR, formatPrice } from "@/lib/format";
import { cancelVisit } from "../actions";
import { AccountHeading } from "@/components/account/heading";
import { Badge, EmptyState, btnClass } from "@/components/ui";

export const metadata: Metadata = { title: "Contacted properties", robots: { index: false } };

const CHANNEL: Record<string, string> = { service: "Service request", contact: "Message", phone_reveal: "Viewed phone", callback: "Callback", visit: "Site visit", enquiry: "Enquiry", brochure: "Brochure" };
const LEAD_STATUS: Record<string, { label: string; tone: "neutral" | "trust" | "warn" | "danger" }> = {
  new: { label: "Sent", tone: "neutral" }, contacted: { label: "Responded", tone: "trust" }, closed: { label: "Closed", tone: "neutral" }, spam: { label: "Sent", tone: "neutral" },
};
const VISIT_STATUS: Record<string, { label: string; tone: "neutral" | "trust" | "warn" | "danger" }> = {
  requested: { label: "Awaiting confirmation", tone: "warn" }, confirmed: { label: "Confirmed", tone: "trust" }, done: { label: "Completed", tone: "neutral" }, cancelled: { label: "Cancelled", tone: "danger" },
};

type Lead = { id: number; channel: string; status: string; created_at: string; message: string | null; listing_id: number | null; project_id: number | null; l_title: string | null; l_price: number | null; l_tx: string | null; l_status: string | null; p_name: string | null; p_slug: string | null; loc: string | null; city: string | null; poster: string | null };
type Visit = { id: number; scheduled_at: string; status: string; listing_id: number | null; l_title: string | null; p_name: string | null; p_slug: string | null };

export default async function ContactedPage() {
  const u = await requireUser("/account/contacted");
  const leads = await db.prepare(`SELECT ld.id, ld.channel, ld.status, ld.created_at, ld.message, ld.listing_id, ld.project_id,
      l.title l_title, l.price l_price, l.transaction_type l_tx, l.status l_status, p.name p_name, p.slug p_slug,
      COALESCE(lo1.name, lo2.name) loc, COALESCE(c1.name, c2.name) city, COALESCE(pr.company_name, pu.name) poster
    FROM leads ld LEFT JOIN listings l ON l.id = ld.listing_id LEFT JOIN projects p ON p.id = ld.project_id
    LEFT JOIN localities lo1 ON lo1.id = l.locality_id LEFT JOIN localities lo2 ON lo2.id = p.locality_id
    LEFT JOIN cities c1 ON c1.id = l.city_id LEFT JOIN cities c2 ON c2.id = p.city_id
    LEFT JOIN users pu ON pu.id = ld.poster_id LEFT JOIN profiles pr ON pr.user_id = ld.poster_id
    WHERE ld.seeker_id = ? ORDER BY ld.created_at DESC LIMIT 200`).all(u.id) as Lead[];
  const visits = await db.prepare(`SELECT v.id, v.scheduled_at, v.status, v.listing_id, l.title l_title, p.name p_name, p.slug p_slug
    FROM visits v LEFT JOIN listings l ON l.id = v.listing_id LEFT JOIN projects p ON p.id = v.project_id
    WHERE v.seeker_id = ? ORDER BY v.scheduled_at DESC`).all(u.id) as Visit[];
  const now = new Date().toISOString();
  const upcoming = visits.filter((v) => v.scheduled_at >= now && v.status !== "cancelled");
  const pastVisits = visits.filter((v) => !(v.scheduled_at >= now && v.status !== "cancelled"));

  const what = (l: { listing_id: number | null; l_title: string | null; p_name: string | null; p_slug: string | null }) =>
    l.listing_id && l.l_title ? <Link href={`/property/${l.listing_id}`} className="font-medium hover:text-accent-ink">{l.l_title}</Link>
    : l.p_slug ? <Link href={`/projects/${l.p_slug}`} className="font-medium hover:text-accent-ink">{l.p_name}</Link>
    : <span className="font-medium text-muted">Listing removed</span>;

  return (
    <>
      <AccountHeading title="Contacted" sub="Owners, agents and builders you've reached out to, and your site visits." />
      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-2">Upcoming visits</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcoming.map((v) => (
              <li key={v.id} className="bg-card border border-line rounded-[var(--radius-md)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate">{what({ listing_id: v.listing_id, l_title: v.l_title, p_name: v.p_name, p_slug: v.p_slug })}</div>
                    <div className="num text-sm mt-1">{formatDate(v.scheduled_at, { weekday: "short", day: "numeric", month: "short" })}, {new Date(v.scheduled_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</div>
                  </div>
                  <Badge tone={VISIT_STATUS[v.status]?.tone}>{VISIT_STATUS[v.status]?.label ?? v.status}</Badge>
                </div>
                <form action={cancelVisit} className="mt-3"><input type="hidden" name="visit_id" value={v.id} /><button className="text-xs text-muted hover:text-danger">Cancel visit</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!leads.length ? (
        <EmptyState icon={<PhoneCall size={18} />} title="You haven't contacted anyone yet" body="When you message an owner, view a phone number, request a callback or enquire on a project, it shows up here with its status." action={<Link href="/search" className={btnClass("primary", "sm")}>Find a home</Link>} />
      ) : (
        <div className="bg-card border border-line rounded-[var(--radius-md)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-2 text-xs text-muted text-left hidden md:table-header-group">
              <tr><th className="font-medium px-4 py-2.5">Property</th><th className="font-medium px-4 py-2.5">How</th><th className="font-medium px-4 py-2.5">Date</th><th className="font-medium px-4 py-2.5">Status</th></tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-line first:border-t-0 md:first:border-t grid grid-cols-[1fr_auto] md:table-row px-4 py-3 md:p-0 gap-x-3 gap-y-1">
                  <td className="md:px-4 md:py-3 min-w-0 col-span-2 md:col-span-1">
                    {!l.listing_id && !l.project_id && l.message?.startsWith("[") ? (
                      <>
                        <div className="font-medium truncate">{l.message.slice(1, l.message.indexOf("]"))} request</div>
                        <div className="text-xs text-muted truncate">{l.message.slice(l.message.indexOf("]") + 1).trim()}</div>
                      </>
                    ) : (
                      <>
                        <div className="truncate">{what(l)}</div>
                        <div className="text-xs text-muted truncate">
                          {[[l.loc, l.city].filter(Boolean).join(", "), l.l_price ? (l.l_tx === "sell" ? formatPrice(l.l_price) : `₹${formatINR(l.l_price)}/mo`) : null, l.poster].filter(Boolean).join(" · ")}
                        </div>
                      </>
                    )}
                    {l.l_status && l.l_status !== "live" && <div className="text-xs text-warn mt-0.5">No longer live</div>}
                  </td>
                  <td className="md:px-4 md:py-3 text-ink-2">{CHANNEL[!l.listing_id && !l.project_id && l.message?.startsWith("[") ? "service" : l.channel] ?? l.channel}<span className="md:hidden text-muted"> · {formatDate(l.created_at)}</span></td>
                  <td className="md:px-4 md:py-3 text-muted num hidden md:table-cell whitespace-nowrap">{formatDate(l.created_at)}</td>
                  <td className="md:px-4 md:py-3 text-right md:text-left"><Badge tone={LEAD_STATUS[l.status]?.tone}>{LEAD_STATUS[l.status]?.label ?? l.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pastVisits.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-2">Past and cancelled visits</h2>
          <ul className="divide-y divide-line bg-card border border-line rounded-[var(--radius-md)]">
            {pastVisits.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 truncate">{what({ listing_id: v.listing_id, l_title: v.l_title, p_name: v.p_name, p_slug: v.p_slug })}</span>
                <span className="flex items-center gap-3"><span className="num text-muted text-xs">{formatDate(v.scheduled_at)}</span><Badge tone={VISIT_STATUS[v.status]?.tone}>{VISIT_STATUS[v.status]?.label ?? v.status}</Badge></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
