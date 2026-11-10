import { nowMs } from "@/lib/supply/time";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { Download } from "lucide-react";
import { db } from "@/lib/db";
import { formatPhone, timeAgo } from "@/lib/format";
import { btnClass, Card, EmptyState, Input, Pagination, Select, Stat } from "@/components/ui";
import { dashboardContext } from "@/lib/supply/account";
import { LeadChannel, PageTitle } from "@/components/supply/bits";
import { LeadStatusButtons } from "@/components/supply/lead-controls";
import { WebhookPanel } from "@/components/supply/webhook-panel";
import { parseLeadFilters, queryLeads } from "@/lib/supply/leads";
import { getWebhook, syncPendingLeads } from "@/lib/supply/webhook";

export const metadata: Metadata = { title: "Leads and CRM", robots: { index: false } };
const PER = 25;

export default async function LeadsPage({ searchParams }: PageProps<"/dashboard/leads">) {
  const sp = await searchParams;
  const { subject, impersonating } = await dashboardContext("/dashboard/leads");
  if (!["agent", "builder", "admin"].includes(subject.role)) redirect("/dashboard/responses");
  const f = parseLeadFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = queryLeads(subject.id, f, PER, (page - 1) * PER);
  const projects = db.prepare("SELECT id, name FROM projects WHERE builder_id = ? ORDER BY name").all(subject.id) as { id: number; name: string }[];
  const stats = db.prepare(
    `SELECT COUNT(*) total, SUM(created_at >= ?) last7, SUM(status = 'new') fresh, SUM(project_id IS NOT NULL) project
     FROM leads WHERE poster_id = ?`
  ).get(new Date(nowMs() - 7 * 86400000).toISOString(), subject.id) as { total: number; last7: number | null; fresh: number | null; project: number | null };
  const hook = getWebhook(subject.id);
  if (hook?.active && !impersonating) after(() => syncPendingLeads(subject.id));

  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  const hrefFor = (p: number) => `/dashboard/leads?${new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), page: String(p) })}`;

  return (
    <div>
      <PageTitle
        eyebrow="CRM"
        title="Leads"
        sub="All enquiries on your listings and projects. Export to CSV or push them to your CRM by webhook."
        action={<a href={`/api/dashboard/leads/export${qs ? `?${qs}` : ""}`} className={btnClass("primary", "md")} download><Download size={15} /> Export CSV</a>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="All leads" value={stats.total} />
        <Stat label="Last 7 days" value={stats.last7 ?? 0} />
        <Stat label="Not contacted yet" value={stats.fresh ?? 0} />
        <Stat label="From projects" value={stats.project ?? 0} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="min-w-0">
          <form action="/dashboard/leads" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4 items-end">
            <div className="col-span-2 md:col-span-1 lg:col-span-2"><label htmlFor="q" className="text-xs text-muted">Search</label><Input id="q" name="q" defaultValue={f.q} placeholder="Name, phone, email" className="h-9" /></div>
            <div><label htmlFor="status" className="text-xs text-muted">Status</label>
              <Select id="status" name="status" defaultValue={f.status} className="h-9"><option value="">Any</option><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option><option value="spam">Spam</option></Select></div>
            {projects.length > 0 ? (
              <div><label htmlFor="project" className="text-xs text-muted">Project</label>
                <Select id="project" name="project" defaultValue={f.project} className="h-9"><option value="">All</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
            ) : (
              <div><label htmlFor="channel" className="text-xs text-muted">Channel</label>
                <Select id="channel" name="channel" defaultValue={f.channel} className="h-9"><option value="">Any</option><option value="contact">Contact form</option><option value="phone_reveal">Viewed number</option><option value="callback">Callback</option><option value="visit">Site visit</option><option value="enquiry">Enquiry</option><option value="brochure">Brochure</option></Select></div>
            )}
            <div><label htmlFor="from" className="text-xs text-muted">From</label><Input id="from" type="date" name="from" defaultValue={f.from} className="h-9" /></div>
            <div><label htmlFor="to" className="text-xs text-muted">To</label><Input id="to" type="date" name="to" defaultValue={f.to} className="h-9" /></div>
            <div className="col-span-2 md:col-span-3 lg:col-span-6 flex gap-2">
              <button className={btnClass("secondary", "sm")}>Apply filters</button>
              {qs && <Link href="/dashboard/leads" className={btnClass("ghost", "sm")}>Clear</Link>}
              <span className="ml-auto text-xs text-muted self-center num">{total} lead{total === 1 ? "" : "s"}</span>
            </div>
          </form>

          {rows.length === 0 ? (
            <EmptyState title="No leads match" body={qs ? "Try clearing the filters." : "Leads appear when seekers contact you, request a callback or download a brochure."} />
          ) : (
            <Card className="divide-y divide-line">
              {rows.map((r) => (
                <div key={r.id} className="p-3.5 grid md:grid-cols-[1fr_auto] gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm">{r.name || "Seeker"}</span>
                      {r.phone && <a href={`tel:+91${r.phone}`} className="num text-sm text-ink-2 hover:underline">{formatPhone(r.phone)}</a>}
                      <LeadChannel channel={r.channel} />
                      <span className="text-xs text-muted">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="text-xs text-muted mt-0.5 truncate">
                      {r.project_id ? <>Project · {r.project_name}</> : r.listing_id ? <>Listing #{r.listing_id} · {r.listing_title}</> : "Listing removed"}{r.locality ? ` · ${r.locality}` : ""}{r.email ? ` · ${r.email}` : ""}
                    </p>
                    {r.message && <p className="text-sm text-ink-2 mt-1 line-clamp-2">{r.message}</p>}
                  </div>
                  <div className="md:self-center"><LeadStatusButtons id={r.id} status={r.status} /></div>
                </div>
              ))}
            </Card>
          )}
          <Pagination page={page} pages={Math.ceil(total / PER)} hrefFor={hrefFor} />
        </div>

        <aside>
          <Card className="p-5">
            <h2 className="font-display text-2xl">CRM webhook</h2>
            <p className="text-sm text-muted mt-1 mb-4">Every new lead is sent to your CRM (Salesforce, Zoho, LeadSquared, or your own endpoint) as signed JSON within seconds.</p>
            {impersonating ? (
              <p className="text-sm text-ink-2">{hook ? <>Configured: <span className="break-all">{hook.url}</span> · last delivery {hook.last_status ?? "none"}</> : "No webhook configured."}</p>
            ) : (
              <WebhookPanel hook={hook ? { url: hook.url, secret: hook.secret, active: hook.active, last_status: hook.last_status } : null} />
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
