import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { formatPhone, timeAgo } from "@/lib/format";
import { Card, cx, EmptyState, Pagination, Select, btnClass } from "@/components/ui";
import { dashboardContext } from "@/lib/supply/account";
import { LeadChannel, LeadStatusBadge, PageTitle } from "@/components/supply/bits";
import { LeadStatusButtons, VisitButtons } from "@/components/supply/lead-controls";

export const metadata: Metadata = { title: "Responses", robots: { index: false } };

const PER = 20;
const STATUSES = ["all", "new", "contacted", "closed", "spam"] as const;

export default async function Responses({ searchParams }: PageProps<"/dashboard/responses">) {
  const sp = await searchParams;
  const { subject } = await dashboardContext("/dashboard/responses");
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? (sp.status as string) : "all";
  const listing = Number(sp.listing) || null;
  const page = Math.max(1, Number(sp.page) || 1);

  const where = ["ld.poster_id = ?"];
  const args: (string | number)[] = [subject.id];
  if (status !== "all") { where.push("ld.status = ?"); args.push(status); }
  else where.push("ld.status <> 'spam'");
  if (listing) { where.push("ld.listing_id = ?"); args.push(listing); }
  const total = (db.prepare(`SELECT COUNT(*) n FROM leads ld WHERE ${where.join(" AND ")}`).get(...args) as { n: number }).n;
  const leads = db.prepare(
    `SELECT ld.*, l.title listing_title, p.name project_name, p.slug project_slug, u.name seeker_name
     FROM leads ld LEFT JOIN listings l ON l.id = ld.listing_id LEFT JOIN projects p ON p.id = ld.project_id LEFT JOIN users u ON u.id = ld.seeker_id
     WHERE ${where.map((w) => w).join(" AND ")} ORDER BY ld.created_at DESC LIMIT ${PER} OFFSET ${(page - 1) * PER}`
  ).all(...args) as Array<{ id: number; listing_id: number | null; project_id: number | null; name: string | null; phone: string | null; email: string | null; message: string | null; channel: string; status: string; created_at: string; listing_title: string | null; project_name: string | null; project_slug: string | null; seeker_name: string | null }>;
  const counts = Object.fromEntries((db.prepare("SELECT status, COUNT(*) n FROM leads WHERE poster_id = ? GROUP BY status").all(subject.id) as { status: string; n: number }[]).map((r) => [r.status, r.n]));
  const myListings = db.prepare("SELECT l.id, l.title, (SELECT COUNT(*) FROM leads WHERE listing_id = l.id) n FROM listings l WHERE l.user_id = ? AND EXISTS (SELECT 1 FROM leads WHERE listing_id = l.id) ORDER BY n DESC").all(subject.id) as { id: number; title: string; n: number }[];

  const visits = db.prepare(
    `SELECT v.id, v.scheduled_at, v.status, v.listing_id, v.project_id, COALESCE(l.title, p.name) what, u.name seeker_name, u.phone seeker_phone
     FROM visits v LEFT JOIN listings l ON l.id = v.listing_id LEFT JOIN projects p ON p.id = v.project_id LEFT JOIN users u ON u.id = v.seeker_id
     WHERE (l.user_id = ? OR p.builder_id = ?) AND v.status IN ('requested','confirmed')
     ORDER BY v.scheduled_at LIMIT 20`
  ).all(subject.id, subject.id) as Array<{ id: number; scheduled_at: string; status: string; listing_id: number | null; project_id: number | null; what: string; seeker_name: string | null; seeker_phone: string | null }>;

  const href = (o: Record<string, string | number | null>) => {
    const q = new URLSearchParams();
    const merged = { status, listing, ...o };
    for (const [k, v] of Object.entries(merged)) if (v != null && v !== "" && !(k === "status" && v === "all")) q.set(k, String(v));
    const s = q.toString();
    return `/dashboard/responses${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <PageTitle eyebrow="Inbox" title="Responses" sub="Every enquiry, phone view, callback and site-visit request on your listings." />

      {visits.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-2xl mb-3">Site visits</h2>
          <Card className="divide-y divide-line">
            {visits.map((v) => (
              <div key={v.id} className="p-3.5 grid sm:grid-cols-[1fr_auto] gap-3 items-center">
                <div className="min-w-0">
                  <p className="text-sm"><b className="num">{new Date(v.scheduled_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</b> · {v.seeker_name || "Seeker"}{v.seeker_phone && <> · <a className="underline underline-offset-2" href={`tel:+91${v.seeker_phone}`}>{formatPhone(v.seeker_phone)}</a></>}</p>
                  <p className="text-xs text-muted truncate">{v.what} · <span className={cx(v.status === "confirmed" ? "text-trust font-medium" : "text-warn font-medium")}>{v.status === "confirmed" ? "Confirmed" : "Awaiting your confirmation"}</span></p>
                </div>
                <VisitButtons id={v.id} status={v.status} />
              </div>
            ))}
          </Card>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <Link key={s} href={href({ status: s, page: null })} aria-current={status === s ? "page" : undefined} className={cx("inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] border capitalize", status === s ? "bg-ink text-white border-ink" : "border-line-2 text-ink-2 hover:border-ink")}>
              {s === "all" ? "All" : s}
              <span className="num opacity-70">{s === "all" ? Object.entries(counts).filter(([k]) => k !== "spam").reduce((a, [, n]) => a + n, 0) : counts[s] ?? 0}</span>
            </Link>
          ))}
        </nav>
        {myListings.length > 0 && (
          <form action="/dashboard/responses" className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
            {status !== "all" && <input type="hidden" name="status" value={status} />}
            <label htmlFor="listing" className="sr-only">Listing</label>
            <Select id="listing" name="listing" defaultValue={listing ?? ""} className="h-8 text-[13px] sm:w-64">
              <option value="">All listings</option>
              {myListings.map((l) => <option key={l.id} value={l.id}>#{l.id} {l.title.slice(0, 40)} ({l.n})</option>)}
            </Select>
            <button className={btnClass("secondary", "sm")}>Filter</button>
          </form>
        )}
      </div>

      {leads.length === 0 ? (
        <EmptyState title={status === "all" ? "No responses yet" : `No ${status} responses`} body="Enquiries from seekers appear here. You also get an SMS and email for each one (see Alerts)." />
      ) : (
        <ul className="space-y-3">
          {leads.map((l) => {
            const name = l.name || l.seeker_name || "Seeker";
            const wa = l.phone ? `https://wa.me/91${l.phone}?text=${encodeURIComponent(`Hi ${name}, this is regarding your enquiry on 10cent for ${l.listing_title ?? l.project_name ?? "my property"}.`)}` : null;
            return (
              <li key={l.id}>
                <Card className={cx("p-4", l.status === "new" && "border-l-[3px] border-l-accent")}>
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{name}</span>
                        <LeadChannel channel={l.channel} />
                        <LeadStatusBadge status={l.status} />
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        {timeAgo(l.created_at)} · {new Date(l.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} ·{" "}
                        {l.listing_id ? <Link href={`/property/${l.listing_id}`} className="hover:underline">{l.listing_title}</Link> : l.project_slug ? <Link href={`/projects/${l.project_slug}`} className="hover:underline">{l.project_name}</Link> : "Listing removed"}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {l.phone && <a href={`tel:+91${l.phone}`} className={btnClass("primary", "sm", "h-8")}><Phone size={14} /> <span className="num">{formatPhone(l.phone)}</span></a>}
                      {wa && <a href={wa} target="_blank" rel="noreferrer" className={btnClass("secondary", "sm", "h-8")} aria-label={`WhatsApp ${name}`}><MessageCircle size={14} /> <span className="hidden sm:inline">WhatsApp</span></a>}
                      {l.email && <a href={`mailto:${l.email}`} className={btnClass("ghost", "sm", "h-8 w-8 px-0")} aria-label={`Email ${name}`}><Mail size={14} /></a>}
                    </div>
                  </div>
                  {l.message && <p className="mt-3 text-sm text-ink-2 bg-paper rounded-[var(--radius-sm)] px-3 py-2 whitespace-pre-line">{l.message}</p>}
                  <div className="mt-3"><LeadStatusButtons id={l.id} status={l.status} /></div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={(p) => href({ page: p })} />
    </div>
  );
}
