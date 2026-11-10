import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { pgInt } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { formatDate, timeAgo } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { ListingReview } from "@/components/admin/listing-review";
import { ToggleForm } from "@/components/admin/listing-forms";
import { getAdminListing, modLog } from "@/lib/admin/moderation";

export async function generateMetadata({ params }: PageProps<"/admin/listings/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Listing #${id}` };
}

export default async function AdminListingPage({ params }: PageProps<"/admin/listings/[id]">) {
  await requireAdmin("moderation");
  const { id } = await params;
  const l = await getAdminListing(pgInt(id));
  if (!l) notFound();
  const log = await modLog(l.id);
  const stats = await db.prepare("SELECT SUM(impressions) i, SUM(views) v, SUM(contacts) c, SUM(shortlists) s FROM listing_stats WHERE listing_id = ?").get(l.id) as { i: number | null; v: number | null; c: number | null; s: number | null };
  const reports = await db.prepare("SELECT id, reason, status, created_at FROM reports WHERE listing_id = ? ORDER BY id DESC").all(l.id) as { id: number; reason: string; status: string; created_at: string }[];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "All listings", href: "/admin/listings" }, { label: `#${l.id}` }]} />
      <div className="mt-3" />
      <AdminHeader
        title={`Listing #${l.id}`}
        sub={`Submitted ${formatDate(l.created_at)}${l.published_at ? ` · published ${formatDate(l.published_at)}` : ""}${l.expires_at ? ` · expires ${formatDate(l.expires_at)}` : ""}`}
        actions={l.status === "live" ? <><ToggleForm id={l.id} field="featured" on={!!l.featured} /><ToggleForm id={l.id} field="premium" on={!!l.premium} /></> : null}
      />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <ListingReview l={l} full />
        <div className="space-y-4">
          <Panel title="Performance (all time)">
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              {[["Impressions", stats.i], ["Detail views", stats.v], ["Contacts", stats.c], ["Shortlists", stats.s]].map(([k, v]) => (
                <div key={k as string}><dt className="text-muted text-xs">{k}</dt><dd className="num text-lg font-semibold">{Number(v ?? 0).toLocaleString("en-IN")}</dd></div>
              ))}
            </dl>
          </Panel>
          <Panel title={`Fraud reports (${reports.length})`}>
            {reports.length ? (
              <ul className="space-y-1.5 text-[13px]">
                {reports.map((r) => <li key={r.id} className="flex justify-between gap-2"><a className="hover:underline" href={`/admin/reports?id=${r.id}`}>#{r.id} {r.reason.replace(/_/g, " ")}</a><span className="text-muted">{r.status} · {timeAgo(r.created_at)}</span></li>)}
              </ul>
            ) : <p className="text-[13px] text-muted">No reports filed.</p>}
          </Panel>
          <Panel title="Moderation history" pad={false}>
            <ol className="divide-y divide-line">
              {log.map((m) => (
                <li key={m.id} className="px-4 py-2.5 text-[13px]">
                  <div className="flex justify-between gap-2"><span className="font-medium capitalize">{m.action.replace(/_/g, " ")}</span><span className="text-muted whitespace-nowrap">{timeAgo(m.created_at)}</span></div>
                  <div className="text-xs text-muted">{m.actor_name ?? "Automated"}</div>
                  {m.reason && <div className="text-xs text-ink-2 mt-0.5">{m.action === "verify_scheduled" ? m.reason.replace("|", " · ") : m.reason}</div>}
                </li>
              ))}
              {!log.length && <li className="px-4 py-3 text-[13px] text-muted">No history.</li>}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
