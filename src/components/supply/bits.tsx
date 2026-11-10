import { Badge, cx } from "@/components/ui";
import { LISTING_STATUS_LABEL } from "@/lib/constants";

export function QuotaBar({ used, limit, className }: { used: number; limit: number; className?: string }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <div className={className}>
      <div className="flex justify-between text-xs">
        <span className="text-ink-2">Listings used</span>
        <span className="num font-medium">{used} / {limit}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-paper-2 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-label="Listing quota used">
        <div className={cx("h-full", pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warn" : "bg-trust")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, "neutral" | "trust" | "accent" | "warn" | "danger" | "ink"> = {
  live: "trust", pending: "warn", rejected: "danger", expired: "neutral", paused: "neutral", sold: "ink", rented: "ink", removed: "danger", draft: "neutral",
};

export function ListingStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{LISTING_STATUS_LABEL[status] ?? status}</Badge>;
}

const CHANNEL_LABEL: Record<string, string> = {
  contact: "Contact form", phone_reveal: "Viewed number", callback: "Callback", visit: "Site visit", enquiry: "Enquiry", brochure: "Brochure",
};
export function LeadChannel({ channel }: { channel: string }) {
  return <span className="text-[11px] text-ink-2 bg-paper-2 rounded px-1.5 py-0.5">{CHANNEL_LABEL[channel] ?? channel}</span>;
}

const LEAD_TONE: Record<string, "neutral" | "trust" | "accent" | "warn" | "danger"> = { new: "accent", contacted: "trust", spam: "danger", closed: "neutral" };
export function LeadStatusBadge({ status }: { status: string }) {
  return <Badge tone={LEAD_TONE[status] ?? "neutral"}>{status}</Badge>;
}

export function PageTitle({ eyebrow, title, sub, action }: { eyebrow?: string; title: string; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>}
        <h1 className="font-display text-4xl md:text-[44px] leading-tight mt-1">{title}</h1>
        {sub && <p className="text-sm text-muted mt-1">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
