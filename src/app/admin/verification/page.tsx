import type { Metadata } from "next";
import { nowMs } from "@/lib/admin/clock";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPhone, timeAgo, formatDate } from "@/lib/format";
import { EmptyState, inputClass, cx } from "@/components/ui";
import { AdminHeader, Hours, StatusBadge } from "@/components/admin/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/action-form";
import { scheduleVisit, completeVerification } from "@/lib/admin/actions-listings";
import { priceText } from "@/components/admin/listing-review";

export const metadata: Metadata = { title: "Verification visits" };

type Row = { id: number; title: string; status: string; price: number; transaction_type: string; address: string | null; verification_requested_at: string; city: string; locality: string | null; user_id: number; name: string | null; phone: string | null; cover: string | null; sched: string | null };

export default async function VerificationPage() {
  await requireAdmin("moderation");
  const rows = db.prepare(`
    SELECT l.id, l.title, l.status, l.price, l.transaction_type, l.address, l.verification_requested_at, c.name city, lo.name locality, l.user_id, u.name, u.phone,
      (SELECT url FROM listing_media m WHERE m.listing_id = l.id AND m.kind = 'photo' ORDER BY sort LIMIT 1) cover,
      (SELECT reason FROM moderation_logs m WHERE m.listing_id = l.id AND m.action = 'verify_scheduled' AND m.created_at >= l.verification_requested_at ORDER BY m.id DESC LIMIT 1) sched
    FROM listings l JOIN users u ON u.id = l.user_id JOIN cities c ON c.id = l.city_id LEFT JOIN localities lo ON lo.id = l.locality_id
    WHERE l.verification_requested_at IS NOT NULL AND l.verified = 0 AND l.status IN ('live','pending','paused')
    ORDER BY l.verification_requested_at ASC`).all() as Row[];
  const recent = db.prepare(`SELECT ml.listing_id, ml.action, ml.created_at, l.title, u.name actor FROM moderation_logs ml JOIN listings l ON l.id = ml.listing_id LEFT JOIN users u ON u.id = ml.actor_id WHERE ml.action IN ('verified','verify_declined') ORDER BY ml.id DESC LIMIT 8`).all() as { listing_id: number; action: string; created_at: string; title: string; actor: string | null }[];
  const minDate = new Date(nowMs() + 5.5 * 3600000).toISOString().slice(0, 16);

  return (
    <div>
      <AdminHeader eyebrow="P6 · Listings" title="Verification visits" sub="Posters request a physical check to earn the Verified badge. Schedule a field visit, then mark it verified or decline with a reason. The poster is told at each step." actions={<span className="text-[13px]"><strong className="num">{rows.length}</strong> <span className="text-muted">open requests</span></span>} />
      {!rows.length ? (
        <EmptyState title="No open verification requests" body="When an owner or agent asks for a field visit from their dashboard, it appears here." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const [when, agent] = (r.sched ?? "").split("|");
            return (
              <article key={r.id} className="bg-card border border-line rounded-[var(--radius-md)] grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden">
                <div className="p-4 flex gap-3 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.cover ? <img src={r.cover} alt="" className="w-24 h-20 object-cover rounded-[var(--radius-xs)] border border-line shrink-0" /> : <div className="w-24 h-20 bg-paper-2 rounded-[var(--radius-xs)] shrink-0" />}
                  <div className="min-w-0 text-[13px]">
                    <Link href={`/admin/listings/${r.id}`} className="font-semibold hover:underline line-clamp-2">#{r.id} {r.title}</Link>
                    <div className="text-muted">{[r.address, r.locality, r.city].filter(Boolean).join(", ")}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2"><StatusBadge status={r.status} /><span className="num">{priceText(r)}</span></div>
                    <div className="mt-1.5 text-xs"><Link href={`/admin/users/${r.user_id}`} className="underline">{r.name || "Poster"}</Link> <span className="num text-muted">{formatPhone(r.phone)}</span></div>
                    <div className="mt-1 text-xs">Requested {timeAgo(r.verification_requested_at)} · waiting <Hours iso={r.verification_requested_at} sla={72} /></div>
                  </div>
                </div>
                <div className="p-4 border-t lg:border-t-0 lg:border-l border-line space-y-3">
                  {when ? (
                    <p className="text-[13px] bg-trust-soft text-trust px-3 py-2 rounded-[var(--radius-sm)]">Visit scheduled for <strong>{new Date(when).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</strong> with {agent}.</p>
                  ) : null}
                  <details open={!when}>
                    <summary className="cursor-pointer text-[13px] font-medium">{when ? "Reschedule" : "Schedule field visit"}</summary>
                    <ActionForm action={scheduleVisit} className="mt-2 flex flex-wrap items-start gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <div><input type="datetime-local" name="when" min={minDate} aria-label="Visit date and time" className={cx(inputClass, "h-9 w-52 text-[13px]")} /><FieldError name="when" /></div>
                      <div><input name="agent" placeholder="Field executive" defaultValue={agent} aria-label="Field executive" className={cx(inputClass, "h-9 w-40 text-[13px]")} /><FieldError name="agent" /></div>
                      <SubmitButton variant="secondary" className="h-9">{when ? "Reschedule" : "Schedule"}</SubmitButton>
                    </ActionForm>
                  </details>
                  <ActionForm action={completeVerification} className="space-y-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input name="note" placeholder="Visit notes / reason if declining" aria-label="Visit notes" className={cx(inputClass, "h-9 text-[13px]")} />
                    <FieldError name="note" />
                    <div className="flex flex-wrap gap-1.5">
                      <SubmitButton name="outcome" value="verified" variant="trust" confirm="Mark this listing as physically verified?">Visit done: verified</SubmitButton>
                      <SubmitButton name="outcome" value="declined" variant="ghost" className="text-danger">Decline</SubmitButton>
                    </div>
                  </ActionForm>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] font-semibold mb-2">Recently completed</h2>
          <ul className="text-[13px] divide-y divide-line bg-card border border-line rounded-[var(--radius-md)]">
            {recent.map((r, i) => <li key={i} className="px-4 py-2 flex justify-between gap-3"><span className="truncate"><Link className="hover:underline" href={`/admin/listings/${r.listing_id}`}>#{r.listing_id} {r.title}</Link></span><span className="whitespace-nowrap text-muted">{r.action === "verified" ? "Verified" : "Declined"} by {r.actor ?? "—"} · {formatDate(r.created_at)}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
