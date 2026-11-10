import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* Shared, server-safe UI primitives. Keep these small and boring. */

export const cx = clsx;

type BtnVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "trust";
type BtnSize = "sm" | "md" | "lg";

export function btnClass(variant: BtnVariant = "primary", size: BtnSize = "md", extra?: string) {
  return clsx(
    "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-[var(--radius-sm)] transition-colors disabled:opacity-50 disabled:pointer-events-none select-none",
    size === "sm" && "h-8 px-3 text-[13px]",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-12 px-6 text-[15px]",
    variant === "primary" && "bg-ink text-white hover:bg-black",
    variant === "accent" && "bg-accent text-white hover:bg-accent-ink",
    variant === "secondary" && "bg-card text-ink border border-line-2 hover:border-ink",
    variant === "ghost" && "text-ink-2 hover:bg-paper-2 hover:text-ink",
    variant === "danger" && "bg-danger text-white hover:opacity-90",
    variant === "trust" && "bg-trust text-white hover:opacity-90",
    extra
  );
}

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: BtnVariant; size?: BtnSize }) {
  return <button {...p} className={btnClass(variant, size, className)} />;
}

export function LinkButton({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: BtnSize }) {
  return <Link {...p} className={btnClass(variant, size, className)} />;
}

export const inputClass =
  "w-full h-10 px-3 rounded-[var(--radius-sm)] border border-line-2 bg-card text-sm text-ink placeholder:text-muted focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 disabled:bg-paper-2";

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input {...p} className={clsx(inputClass, className)} />;
}

export function Select({ className, children, ...p }: ComponentProps<"select">) {
  return (
    <select {...p} className={clsx(inputClass, "pr-8 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2316181b%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-no-repeat bg-[right_10px_center]", className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea {...p} className={clsx(inputClass, "h-auto min-h-24 py-2 leading-relaxed", className)} />;
}

export function Label({ children, hint, className, ...p }: ComponentProps<"label"> & { hint?: ReactNode }) {
  return (
    <label {...p} className={clsx("block text-[13px] font-medium text-ink-2 mb-1.5", className)}>
      {children}
      {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function Field({ label, hint, error, children, className, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={className}>
      <Label hint={hint} htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

type BadgeTone = "neutral" | "trust" | "accent" | "warn" | "danger" | "ink";
export function Badge({ tone = "neutral", children, className, icon }: { tone?: BadgeTone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-semibold tracking-wide uppercase whitespace-nowrap",
        tone === "neutral" && "bg-paper-2 text-ink-2",
        tone === "trust" && "bg-trust-soft text-trust",
        tone === "accent" && "bg-accent-soft text-accent-ink",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "ink" && "bg-ink text-white",
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={clsx("bg-card border border-line rounded-[var(--radius-md)]", className)} />;
}

export function SectionHeading({ eyebrow, title, action, className }: { eyebrow?: string; title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-end justify-between gap-4 mb-5", className)}>
      <div>
        {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-1.5">{eyebrow}</div>}
        <h2 className="font-display text-3xl md:text-[34px] leading-[1.05]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="border border-dashed border-line-2 rounded-[var(--radius-md)] px-6 py-12 text-center bg-card/50">
      {icon && <div className="mx-auto mb-3 w-10 h-10 grid place-items-center rounded-full bg-paper-2 text-ink-2">{icon}</div>}
      <p className="font-medium">{title}</p>
      {body && <p className="text-sm text-muted mt-1 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="p-4 bg-card border border-line rounded-[var(--radius-md)]">
      <div className="text-xs text-muted">{label}</div>
      <div className="num text-2xl font-semibold mt-1 tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export function Notice({ tone = "neutral", children, className }: { tone?: "neutral" | "trust" | "warn" | "danger"; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={clsx(
        "rounded-[var(--radius-sm)] px-3.5 py-2.5 text-sm border",
        tone === "neutral" && "bg-paper-2 border-line text-ink-2",
        tone === "trust" && "bg-trust-soft border-trust/20 text-trust",
        tone === "warn" && "bg-warn-soft border-warn/20 text-warn",
        tone === "danger" && "bg-danger-soft border-danger/20 text-danger",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Container({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={clsx("mx-auto w-full max-w-[1240px] px-4 md:px-6", className)} />;
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {it.href ? <Link href={it.href} className="hover:text-ink">{it.label}</Link> : <span className="text-ink-2">{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) nums.push(p);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1 mt-8">
      {page > 1 && <Link className={btnClass("secondary", "sm")} href={hrefFor(page - 1)}>Previous</Link>}
      {nums.map((p) => (
        <Link key={p} href={hrefFor(p)} aria-current={p === page ? "page" : undefined} className={btnClass(p === page ? "primary" : "ghost", "sm", "min-w-8")}>
          {p}
        </Link>
      ))}
      {page < pages && <Link className={btnClass("secondary", "sm")} href={hrefFor(page + 1)}>Next</Link>}
    </nav>
  );
}

/** Tiny bar/line chart in SVG; good enough for price trends and dashboard sparklines. */
export function LineChart({ points, height = 160, format = (n: number) => String(n), labelEvery = 6, color = "var(--color-ink)" }: { points: Array<{ x: string; y: number }>; height?: number; format?: (n: number) => string; labelEvery?: number; color?: string }) {
  if (points.length < 2) return <div className="text-sm text-muted">Not enough data yet.</div>;
  const W = 600, H = height, pad = { l: 8, r: 8, t: 12, b: 22 };
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const area = `${d} L${x(points.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const last = points[points.length - 1];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Trend from ${format(points[0].y)} to ${format(last.y)}`}>
        <path d={area} fill={color} opacity={0.06} />
        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(last.y)} r={4} fill={color} />
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} fontSize={11} fill="var(--color-muted)" textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>
              {p.x}
            </text>
          ) : null
        )}
      </svg>
    </figure>
  );
}
