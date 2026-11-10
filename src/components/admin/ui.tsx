import Link from "next/link";
import { nowMs } from "@/lib/admin/clock";
import type { ComponentProps, ReactNode } from "react";
import { cx, Badge } from "@/components/ui";

/* Server-safe building blocks for admin pages. */

export function AdminHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-6">
      <div className="min-w-0">
        {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-1.5">{eyebrow}</div>}
        <h1 className="font-display text-[34px] md:text-[40px] leading-[1.02]">{title}</h1>
        {sub && <p className="text-sm text-muted mt-1.5 max-w-2xl">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className, pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("bg-card border border-line rounded-[var(--radius-md)]", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 h-12 border-b border-line">
          <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

/** Horizontally scrollable data table with sticky header styling. */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("bg-card border border-line rounded-[var(--radius-md)] overflow-x-auto", className)}>
      <table className="w-full text-[13px] border-collapse">{children}</table>
    </div>
  );
}
export function Th({ className, ...p }: ComponentProps<"th">) {
  return <th {...p} className={cx("text-left font-semibold text-[11px] uppercase tracking-[0.08em] text-muted px-3 py-2.5 border-b border-line bg-paper/60 whitespace-nowrap", className)} />;
}
export function Td({ className, ...p }: ComponentProps<"td">) {
  return <td {...p} className={cx("px-3 py-2.5 border-b border-line align-top", className)} />;
}
export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-10 text-center text-sm text-muted">{children}</td>
    </tr>
  );
}

export function Kpi({ label, value, sub, href, tone }: { label: string; value: ReactNode; sub?: ReactNode; href?: string; tone?: "warn" | "danger" | "trust" }) {
  const body = (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className={cx("num text-[20px] sm:text-[24px] lg:text-[28px] leading-none font-semibold tracking-tight mt-2.5 break-words", tone === "danger" && "text-danger", tone === "warn" && "text-warn", tone === "trust" && "text-trust")}>{value}</div>
      {sub && <div className="text-xs text-muted mt-2">{sub}</div>}
    </>
  );
  const cls = "block p-4 bg-card border border-line rounded-[var(--radius-md)]";
  return href ? <Link href={href} className={cx(cls, "hover:border-ink transition-colors")}>{body}</Link> : <div className={cls}>{body}</div>;
}

const STATUS_TONE: Record<string, "neutral" | "trust" | "accent" | "warn" | "danger" | "ink"> = {
  live: "trust", approved: "trust", paid: "trust", published: "trust", active: "trust", verified: "trust", actioned: "trust", sent: "trust",
  pending: "warn", open: "warn", queued: "warn", created: "warn", draft: "neutral", requested: "warn",
  rejected: "danger", removed: "danger", blocked: "danger", failed: "danger", refunded: "accent", cancelled: "neutral",
  expired: "neutral", paused: "neutral", sold: "ink", rented: "ink", dismissed: "neutral", none: "neutral",
};
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{label ?? status.replace(/_/g, " ")}</Badge>;
}

/** Simple GET filter bar: wraps fields in a form that submits to the current page. */
export function FilterBar({ children, action, reset }: { children: ReactNode; action: string; reset?: boolean }) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-2.5 mb-4 p-3 bg-card border border-line rounded-[var(--radius-md)]">
      {children}
      <button type="submit" className="h-9 px-3.5 rounded-[var(--radius-sm)] bg-ink text-white text-[13px] font-medium">Apply</button>
      {reset && <Link href={action} className="h-9 px-3 inline-flex items-center rounded-[var(--radius-sm)] text-[13px] text-ink-2 hover:bg-paper-2">Reset</Link>}
    </form>
  );
}

export function FInput({ label, className, ...p }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className={cx("flex flex-col gap-1 text-[11.5px] font-medium text-muted", className)}>
      {label}
      <input {...p} className="h-9 px-2.5 rounded-[var(--radius-sm)] border border-line-2 bg-card text-[13px] text-ink placeholder:text-muted/70 focus:outline-none focus:border-ink min-w-0" />
    </label>
  );
}
export function FSelect({ label, className, children, ...p }: ComponentProps<"select"> & { label: string }) {
  return (
    <label className={cx("flex flex-col gap-1 text-[11.5px] font-medium text-muted", className)}>
      {label}
      <select {...p} className="h-9 px-2 rounded-[var(--radius-sm)] border border-line-2 bg-card text-[13px] text-ink focus:outline-none focus:border-ink">
        {children}
      </select>
    </label>
  );
}

export function Hours({ iso, sla = 24 }: { iso: string; sla?: number }) {
  const h = (nowMs() - new Date(iso).getTime()) / 3600000;
  const tone = h >= sla ? "text-danger" : h >= sla * 0.75 ? "text-warn" : "text-trust";
  const left = sla - h;
  const label = h < 1 ? `${Math.max(1, Math.round(h * 60))}m` : h < 48 ? `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m` : `${Math.floor(h / 24)}d`;
  return (
    <span className={cx("num font-semibold", tone)} title={left > 0 ? `${left.toFixed(1)} h left in the ${sla} h SLA` : `${(-left).toFixed(1)} h over SLA`}>
      {label}
      <span className="font-normal text-muted"> {left > 0 ? `· ${Math.ceil(left)}h left` : "· over SLA"}</span>
    </span>
  );
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-3 text-[13px] text-muted">
      <span>Page <span className="num">{page}</span> of <span className="num">{pages}</span></span>
      <div className="flex gap-1.5">
        {page > 1 && <Link href={href(page - 1)} className="h-8 px-3 inline-flex items-center border border-line-2 rounded-[var(--radius-sm)] bg-card text-ink hover:border-ink">Previous</Link>}
        {page < pages && <Link href={href(page + 1)} className="h-8 px-3 inline-flex items-center border border-line-2 rounded-[var(--radius-sm)] bg-card text-ink hover:border-ink">Next</Link>}
      </div>
    </div>
  );
}

/** Build a URL with updated query params, dropping empty values. */
export function qs(base: string, params: Record<string, string | number | undefined | null>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

export function Bars({ rows, format = (n: number) => String(n) }: { rows: Array<{ label: string; value: number; sub?: string }>; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-muted">No data for this range.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-[13px]">
          <span className="truncate text-ink-2">{r.label}</span>
          <span className="h-2 rounded-full bg-paper-2 overflow-hidden"><span className="block h-full bg-ink rounded-full" style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="num text-right font-medium">{format(r.value)}{r.sub && <span className="text-muted font-normal"> {r.sub}</span>}</span>
        </li>
      ))}
    </ul>
  );
}
