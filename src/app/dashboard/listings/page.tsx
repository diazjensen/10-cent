import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Clock } from "lucide-react";
import { db, addDays } from "@/lib/db";
import { formatDate, formatINR } from "@/lib/format";
import { priceLabel } from "@/components/listing-card";
import { btnClass, Card, cx, EmptyState } from "@/components/ui";
import { dashboardContext, listingQuota } from "@/lib/supply/account";
import { ListingStatusBadge, PageTitle, QuotaBar } from "@/components/supply/bits";
import { ListingActions } from "@/components/supply/listing-actions";

export const metadata: Metadata = { title: "My listings", robots: { index: false } };

const TABS = [
  { key: "all", label: "All", statuses: null },
  { key: "live", label: "Live", statuses: ["live"] },
  { key: "pending", label: "Under review", statuses: ["pending"] },
  { key: "paused", label: "Paused", statuses: ["paused"] },
  { key: "expired", label: "Expired", statuses: ["expired"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected", "removed"] },
  { key: "closed", label: "Sold / rented", statuses: ["sold", "rented"] },
] as const;

type Row = {
  id: number; title: string; status: string; transaction_type: string; price: number; created_at: string; published_at: string | null; expires_at: string | null;
  reject_reason: string | null; verified: number; verification_requested_at: string | null; locality: string | null; city: string; cover: string | null;
  views: number; impressions: number; shortlists: number; enquiries: number; new_enquiries: number; boost: number; premium: number;
};

export default async function MyListings({ searchParams }: PageProps<"/dashboard/listings">) {
  const sp = await searchParams;
  const { subject } = await dashboardContext("/dashboard/listings");
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const highlight = Number(sp.highlight) || null;
  const counts = Object.fromEntries(
    (await db.prepare("SELECT status, COUNT(*) n FROM listings WHERE user_id = ? GROUP BY status").all(subject.id) as { status: string; n: number }[]).map((r) => [r.status, r.n])
  );
  const countFor = (t: (typeof TABS)[number]) => (t.statuses ? t.statuses.reduce((a, s) => a + (counts[s] ?? 0), 0) : Object.values(counts).reduce((a, b) => a + b, 0));

  const where = tab.statuses ? `AND l.status IN (${tab.statuses.map(() => "?").join(",")})` : "";
  const rows = await db.prepare(
      `SELECT l.id, l.title, l.status, l.transaction_type, l.price, l.created_at, l.published_at, l.expires_at, l.reject_reason, l.verified, l.verification_requested_at, l.boost, l.premium,
       lo.name locality, c.name city,
       (SELECT url FROM listing_media m WHERE m.listing_id = l.id AND m.kind = 'photo' ORDER BY sort LIMIT 1) cover,
       (SELECT COALESCE(SUM(views),0) FROM listing_stats s WHERE s.listing_id = l.id) views,
       (SELECT COALESCE(SUM(impressions),0) FROM listing_stats s WHERE s.listing_id = l.id) impressions,
       (SELECT COUNT(*) FROM shortlists sh WHERE sh.listing_id = l.id) shortlists,
       (SELECT COUNT(*) FROM leads ld WHERE ld.listing_id = l.id) enquiries,
       (SELECT COUNT(*) FROM leads ld WHERE ld.listing_id = l.id AND ld.status = 'new') new_enquiries
     FROM listings l JOIN cities c ON c.id = l.city_id LEFT JOIN localities lo ON lo.id = l.locality_id
     WHERE l.user_id = ? ${where}
     ORDER BY CASE WHEN l.id = ? THEN 0 ELSE 1 END, l.created_at DESC`
    ).all(subject.id, ...(tab.statuses ?? []), highlight ?? -1) as Row[];
  const q = await listingQuota(subject.id);
  const soon = addDays(7);

  return (
    <div>
      <PageTitle
        eyebrow="Listings"
        title="My listings"
        sub="Listings stay live for 60 days. Renew, pause or close them here."
        action={<Link href="/post-property" className={btnClass("accent", "md")}>Post property</Link>}
      />
      <Card className="p-4 mb-5 grid sm:grid-cols-[1fr_auto] gap-3 items-center">
        <QuotaBar used={q.used} limit={q.limit} />
        <p className="text-xs text-muted sm:text-right">Live, under review and paused listings count toward your limit. <Link href="/plans" className="underline underline-offset-2">Get more</Link></p>
      </Card>

      <nav aria-label="Filter by status" className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto scrollbar-none mb-4">
        <ul className="flex gap-1.5 min-w-max">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={t.key === "all" ? "/dashboard/listings" : `/dashboard/listings?tab=${t.key}`}
                aria-current={tab.key === t.key ? "page" : undefined}
                className={cx("inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] border", tab.key === t.key ? "bg-ink text-white border-ink" : "border-line-2 text-ink-2 hover:border-ink")}
              >
                {t.label} <span className="num opacity-70">{countFor(t)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          title={tab.key === "all" ? "You haven't posted anything yet" : `No ${tab.label.toLowerCase()} listings`}
          body={tab.key === "all" ? "Post your first property free. It takes about 5 minutes." : "Listings will show up here when their status changes."}
          action={tab.key === "all" ? <Link href="/post-property" className={btnClass("accent", "md")}>Post property</Link> : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const canRenew = r.status === "expired" || (r.status === "live" && !!r.expires_at && r.expires_at <= soon);
            const ctr = r.impressions ? ((r.views / r.impressions) * 100).toFixed(1) : null;
            return (
              <li key={r.id} id={`l-${r.id}`}>
                <Card className={cx("p-3.5 md:p-4 grid grid-cols-[84px_1fr] md:grid-cols-[120px_1fr_auto] gap-x-4 gap-y-3", highlight === r.id && "ring-2 ring-accent/50")}>
                  <div className="row-span-2 md:row-span-1">
                    {r.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.cover} alt="" className="w-full aspect-[4/3] object-cover rounded-[var(--radius-sm)] border border-line" />
                    ) : (
                      <div className="w-full aspect-[4/3] grid place-items-center rounded-[var(--radius-sm)] bg-paper-2 text-[11px] text-muted text-center px-1">No photos</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ListingStatusBadge status={r.status} />
                      {r.verified ? <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-trust"><BadgeCheck size={13} /> Verified</span> : r.verification_requested_at ? <span className="inline-flex items-center gap-1 text-[11px] text-ink-2"><Clock size={12} /> Verification requested</span> : null}
                      {r.premium ? <span className="text-[11px] font-semibold text-ink">Premium</span> : r.boost ? <span className="text-[11px] font-semibold text-accent-ink">Boosted</span> : null}
                      <span className="text-[11px] text-muted num">#{r.id}</span>
                    </div>
                    <p className="font-medium mt-1.5 leading-snug line-clamp-2">{r.title}</p>
                    <p className="text-xs text-muted mt-0.5">
                      <span className="num text-ink font-semibold">{priceLabel(r)}{r.transaction_type !== "sell" && "/mo"}</span> · {[r.locality, r.city].filter(Boolean).join(", ")}
                    </p>
                    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                      <div><dt className="inline text-muted">Views </dt><dd className="inline num font-medium">{formatINR(r.views)}</dd></div>
                      <div><dt className="inline text-muted">Shortlists </dt><dd className="inline num font-medium">{r.shortlists}</dd></div>
                      <div>
                        <dt className="inline text-muted">Enquiries </dt>
                        <dd className="inline num font-medium">
                          <Link href={`/dashboard/responses?listing=${r.id}`} className="hover:underline">{r.enquiries}{r.new_enquiries ? <span className="text-accent-ink"> ({r.new_enquiries} new)</span> : null}</Link>
                        </dd>
                      </div>
                      {ctr && <div><dt className="inline text-muted">CTR </dt><dd className="inline num font-medium">{ctr}%</dd></div>}
                      <div>
                        <dt className="inline text-muted">{r.status === "expired" ? "Expired " : r.expires_at ? "Expires " : "Posted "}</dt>
                        <dd className={cx("inline num", canRenew && "text-accent-ink font-medium")}>{formatDate(r.expires_at ?? r.created_at)}</dd>
                      </div>
                    </dl>
                    {r.status === "rejected" && r.reject_reason && <p className="mt-2 text-xs text-danger">Reason: {r.reject_reason}. Edit and resubmit to fix it.</p>}
                    {r.status === "pending" && <p className="mt-2 text-xs text-warn">In the review queue. Usually live within 24 hours.</p>}
                  </div>
                  <div className="col-span-2 md:col-span-1 md:justify-self-end">
                    <ListingActions id={r.id} status={r.status} canRenew={canRenew} txType={r.transaction_type} verificationRequested={!!r.verification_requested_at} verified={!!r.verified} />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
