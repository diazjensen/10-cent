import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { formatPrice, formatRent, formatArea, formatPhone, formatDate, timeAgo } from "@/lib/format";
import { PROPERTY_TYPE_LABEL, FURNISHING_LABEL, LISTING_STATUS_LABEL } from "@/lib/constants";
import { Badge, cx } from "@/components/ui";
import { Hours, StatusBadge } from "./ui";
import { ApproveForm, RejectForm, EditForm, TakedownForm, RestoreForm } from "./listing-forms";
import { computeFlags, posterHistory, photos, areaOf, type AdminListing } from "@/lib/admin/moderation";
import { SLA_HOURS } from "@/lib/admin/areas";

export function priceText(l: { price: number; transaction_type: string }) {
  return l.transaction_type === "sell" ? formatPrice(l.price) : formatRent(l.price);
}

/** One listing laid out for a moderator: photos, facts, automated flags, poster history and actions. */
export async function ListingReview({ l, selectable, full }: { l: AdminListing; selectable?: boolean; full?: boolean }) {
  const { flags, ppsf, localityAvg } = await computeFlags(l);
  const hist = await posterHistory(l.user_id);
  const media = await photos(l.id);
  const area = areaOf(l);
  const facts: Array<[string, string]> = [
    ["Price", `${priceText(l)}${l.price_negotiable ? " · negotiable" : ""}`],
    ["Type", `${l.bhk && !["plot", "office", "shop", "warehouse"].includes(l.property_type) ? `${l.bhk} BHK ` : ""}${PROPERTY_TYPE_LABEL[l.property_type] ?? l.property_type}`],
    ["For", l.transaction_type === "sell" ? "Sale" : l.transaction_type === "rent" ? "Rent" : "PG"],
    ["Area", area ? `${formatArea(area)}${l.carpet_area ? " carpet" : ""}` : "—"],
    ["₹ / sq ft", ppsf ? `₹${Math.round(ppsf).toLocaleString("en-IN")}${localityAvg ? ` (avg ₹${Math.round(localityAvg).toLocaleString("en-IN")})` : ""}` : "—"],
    ["Where", [l.locality_name, l.city_name].filter(Boolean).join(", ")],
  ];
  if (full) {
    facts.push(
      ["Furnishing", l.furnishing ? FURNISHING_LABEL[l.furnishing] ?? l.furnishing : "—"],
      ["Floor", l.floor != null ? `${l.floor}${l.total_floors ? ` of ${l.total_floors}` : ""}` : "—"],
      ["Project", l.project_name ?? "—"],
      ["RERA", l.rera_id ?? "—"],
      ["Address", l.address ?? "—"],
      ["Deposit", l.deposit ? formatRent(l.deposit).replace("/mo", "") : "—"],
    );
  }
  return (
    <article className="bg-card border border-line rounded-[var(--radius-md)] overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 border-b border-line bg-paper/50 text-[12.5px]">
        {selectable && (
          <input type="checkbox" name="ids" value={l.id} form="bulk-approve" aria-label={`Select listing ${l.id}`} className="w-4 h-4 accent-[var(--color-ink)]" />
        )}
        <span className="num font-semibold">#{l.id}</span>
        <StatusBadge status={l.status} label={LISTING_STATUS_LABEL[l.status]} />
        {l.status === "pending" ? (
          <span>In queue <Hours iso={l.created_at} sla={SLA_HOURS} /></span>
        ) : (
          <span className="text-muted">Submitted {timeAgo(l.created_at)}</span>
        )}
        {l.verified ? <Badge tone="trust">Verified</Badge> : null}
        {l.featured ? <Badge tone="ink">Featured</Badge> : null}
        {l.premium ? <Badge tone="accent">Premium</Badge> : null}
        <span className="ml-auto flex gap-3">
          {!full && <Link href={`/admin/listings/${l.id}`} className="text-ink-2 hover:text-ink underline underline-offset-2">Full review</Link>}
          <Link href={`/property/${l.id}`} target="_blank" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">Public page <ExternalLink size={12} aria-hidden /></Link>
        </span>
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="p-4 min-w-0">
          {media.length > 0 ? (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
              {media.slice(0, full ? 20 : 6).map((m) => (
                <a key={m.id} href={m.url} target="_blank" className="shrink-0 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.caption ?? `${m.kind} ${m.id}`} loading="lazy" className={cx("object-cover rounded-[var(--radius-xs)] border border-line bg-paper-2", full ? "w-40 h-28" : "w-28 h-20")} />
                  {m.kind !== "photo" && <span className="absolute bottom-1 left-1 text-[10px] bg-ink text-white px-1 rounded">{m.kind}</span>}
                </a>
              ))}
              {!full && media.length > 6 && <span className="shrink-0 w-20 h-20 grid place-items-center text-xs text-muted border border-dashed border-line-2 rounded-[var(--radius-xs)]">+{media.length - 6}</span>}
            </div>
          ) : (
            <div className="h-20 grid place-items-center text-xs text-warn bg-warn-soft rounded-[var(--radius-xs)]">No photos uploaded</div>
          )}

          <h3 className="mt-3 text-[15px] font-semibold leading-snug">{l.title}</h3>
          <dl className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-[12.5px]">
            {facts.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-muted text-[11px]">{k}</dt>
                <dd className="truncate num" title={v}>{v}</dd>
              </div>
            ))}
          </dl>
          {l.description && <p className={cx("mt-3 text-[13px] text-ink-2 leading-relaxed whitespace-pre-line", !full && "line-clamp-3")}>{l.description}</p>}

          {flags.length > 0 ? (
            <ul className="mt-3 space-y-1.5" aria-label="Automated checks">
              {flags.map((f) => (
                <li key={f.key} className={cx("flex gap-2 items-start text-[12.5px] px-2.5 py-2 rounded-[var(--radius-sm)] border", f.tone === "danger" ? "bg-danger-soft border-danger/20" : "bg-warn-soft border-warn/20")}>
                  <AlertTriangle size={14} aria-hidden className={cx("mt-0.5 shrink-0", f.tone === "danger" ? "text-danger" : "text-warn")} />
                  <span>
                    <strong className={f.tone === "danger" ? "text-danger" : "text-warn"}>{f.label}.</strong>{" "}
                    <span className="text-ink-2">{f.detail}</span>
                    {f.link?.map((lk) => (
                      <Link key={lk.href} href={lk.href} className="ml-2 font-medium underline underline-offset-2">{lk.label}</Link>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[12.5px] text-trust">All automated checks passed: no duplicate, original photos, price in range, no contact details in text.</p>
          )}

          {l.reject_reason && l.status !== "live" && <p className="mt-3 text-[12.5px] text-danger">Reason on record: {l.reject_reason}</p>}

          <div className="mt-4 flex flex-wrap items-start gap-2">
            {["pending", "rejected"].includes(l.status) && <ApproveForm id={l.id} label={l.status === "rejected" ? "Approve anyway" : "Approve"} />}
            {l.status === "pending" && <RejectForm id={l.id} />}
            <EditForm l={l} />
            {["live", "paused"].includes(l.status) && <TakedownForm id={l.id} />}
            {["removed", "paused", "expired"].includes(l.status) && <RestoreForm id={l.id} />}
          </div>
        </div>

        <aside className="border-t md:border-t-0 md:border-l border-line p-4 text-[12.5px] bg-paper/30">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Posted by {l.posted_by_type}</div>
          <Link href={`/admin/users/${l.user_id}`} className="block mt-1.5 font-semibold text-[14px] hover:underline">{l.poster_name || "Unnamed user"}</Link>
          {l.poster_company && <div className="text-muted">{l.poster_company}</div>}
          <div className="mt-1 num">{formatPhone(l.poster_phone)}</div>
          {l.poster_email && <div className="text-muted truncate">{l.poster_email}</div>}
          <div className="mt-2 flex flex-wrap gap-1">
            <StatusBadge status={l.poster_kyc === "verified" ? "verified" : l.poster_kyc} label={`KYC ${l.poster_kyc}`} />
            {l.poster_blocked ? <Badge tone="danger">Blocked</Badge> : null}
            {hist.plan && <Badge tone="accent">{hist.plan}</Badge>}
          </div>
          <dl className="mt-3 space-y-1">
            <div className="flex justify-between"><dt className="text-muted">Joined</dt><dd>{formatDate(l.poster_created)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Listings</dt><dd className="num">{hist.total}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Live / rejected / removed</dt>
              <dd className="num">{hist.byStatus.find((s) => s.status === "live")?.n ?? 0} / {hist.byStatus.find((s) => s.status === "rejected")?.n ?? 0} / {hist.byStatus.find((s) => s.status === "removed")?.n ?? 0}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Reports against</dt><dd className={cx("num", hist.actioned >= 3 ? "text-danger font-semibold" : "")}>{hist.reports}{hist.actioned ? ` (${hist.actioned} actioned)` : ""}</dd></div>
          </dl>
          {hist.last.length > 0 && (
            <div className="mt-3">
              <div className="text-muted mb-1">Recent moderation</div>
              <ul className="space-y-1">
                {hist.last.map((h, i) => (
                  <li key={i} className="leading-snug"><span className="font-medium">{h.action}</span> #{h.listing_id} · {timeAgo(h.created_at)}{h.reason && <span className="block text-muted line-clamp-2">{h.reason}</span>}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
