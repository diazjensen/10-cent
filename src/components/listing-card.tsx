import Link from "next/link";
import { BadgeCheck, Camera, ShieldCheck } from "lucide-react";
import type { ListingCard as Card } from "@/lib/listings";
import { formatArea, formatPrice, formatINR, pricePerSqft, timeAgo } from "@/lib/format";
import { FURNISHING_LABEL, PROPERTY_TYPE_LABEL } from "@/lib/constants";
import { ShortlistButton } from "./shortlist-button";
import { Badge, cx } from "./ui";

export function priceLabel(l: Pick<Card, "price" | "transaction_type">) {
  return l.transaction_type === "sell" ? formatPrice(l.price) : `₹${formatINR(l.price)}`;
}

export function PostedByLabel({ type, name }: { type: string; name?: string | null }) {
  return (
    <span className="text-xs text-muted">
      <span className={cx("font-semibold uppercase tracking-wider text-[10px] mr-1", type === "owner" ? "text-trust" : type === "builder" ? "text-accent-ink" : "text-ink-2")}>{type}</span>
      {name}
    </span>
  );
}

/** Grid card used on home, search, similar listings and shortlists. Shows verified, RERA and posted-by consistently (PRD §4.4). */
export function ListingCard({ l, saved = false, compact = false }: { l: Card; saved?: boolean; compact?: boolean }) {
  const psf = l.transaction_type === "sell" ? pricePerSqft(l.price, l.area) : null;
  const specs = [
    l.bhk && !["plot", "office", "shop", "warehouse", "pg"].includes(l.property_type) ? `${l.bhk} BHK` : PROPERTY_TYPE_LABEL[l.property_type],
    l.area ? formatArea(l.area) : null,
    l.transaction_type === "sell" ? (l.construction_status === "ready" ? "Ready to move" : l.construction_status === "under_construction" ? "Under construction" : null) : l.furnishing ? FURNISHING_LABEL[l.furnishing] : null,
  ].filter(Boolean);
  return (
    <article className="group relative bg-card border border-line rounded-[var(--radius-md)] overflow-hidden hover:border-line-2 hover:shadow-[var(--shadow-pop)] transition-shadow">
      <Link href={`/property/${l.id}`} className="block" aria-label={l.title}>
        <div className="relative aspect-[4/3] bg-paper-2 overflow-hidden">
          {l.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.cover_url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
          ) : (
            <div className="w-full h-full grid place-items-center text-xs text-muted">No photos yet</div>
          )}
          <div className="absolute left-2.5 top-2.5 flex gap-1.5">
            {l.premium ? <Badge tone="ink">Premium</Badge> : l.featured ? <Badge tone="accent" className="bg-white">Featured</Badge> : null}
          </div>
          {l.photo_count > 1 && (
            <span className="absolute left-2.5 bottom-2.5 inline-flex items-center gap-1 text-[11px] text-white bg-ink/70 px-1.5 py-0.5 rounded num">
              <Camera size={12} aria-hidden /> {l.photo_count}
            </span>
          )}
        </div>
      </Link>
      <div className="absolute right-2.5 top-2.5">
        <ShortlistButton listingId={l.id} initial={saved} />
      </div>
      <Link href={`/property/${l.id}`} className="block p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="num text-[19px] font-semibold tracking-tight">
            {priceLabel(l)}
            {l.transaction_type !== "sell" && <span className="text-xs font-normal text-muted">/month</span>}
          </div>
          {psf && <div className="num text-[11px] text-muted">₹{formatINR(psf)}/sq ft</div>}
        </div>
        <h3 className={cx("mt-1 text-sm text-ink leading-snug", compact ? "line-clamp-1" : "line-clamp-2 min-h-[2.5em]")}>{l.title}</h3>
        <p className="text-xs text-muted mt-0.5 truncate">{[l.locality_name, l.city_name].filter(Boolean).join(", ")}</p>
        <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2.5 text-xs text-ink-2">
          {specs.map((s, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="w-1 h-1 rounded-full bg-line-2" aria-hidden />}
              {s}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-line">
          <PostedByLabel type={l.posted_by_type} name={l.poster_company || l.poster_name} />
          <div className="flex items-center gap-1.5 shrink-0">
            {l.verified ? <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-trust" title="Physically verified by 10cent"><BadgeCheck size={14} aria-hidden /> Verified</span> : null}
            {l.rera_id ? <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-ink-2" title={`RERA ${l.rera_id}`}><ShieldCheck size={13} aria-hidden /> RERA</span> : null}
            {!l.verified && !l.rera_id && l.published_at && <span className="text-[11px] text-muted">{timeAgo(l.published_at)}</span>}
          </div>
        </div>
      </Link>
    </article>
  );
}
