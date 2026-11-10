"use client";

import { useId, type ReactNode } from "react";
import { formatINR } from "@/lib/format";
import { cx, inputClass } from "@/components/ui";

/** Number input + range slider kept in sync. Value is a number; typing is free-form, clamped on blur. */
export function SliderField({
  label, value, onChange, min, max, step = 1, prefix, suffix, hint, display,
}: {
  label: string; value: number; onChange: (n: number) => void; min: number; max: number; step?: number;
  prefix?: string; suffix?: string; hint?: ReactNode; display?: (n: number) => string;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-2">{label}</label>
        {display && <span className="num text-xs text-muted">{display(value)}</span>}
      </div>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className={cx(inputClass, "num", prefix && "pl-7", suffix && "pr-14")}
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          onBlur={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n))); }}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">{suffix}</span>}
      </div>
      <input
        type="range"
        aria-label={`${label} slider`}
        className="w-full mt-2 accent-[var(--color-accent)]"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value || 0))}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

export function NumField({ label, value, onChange, prefix, suffix, hint, min = 0, step = 1 }: { label: string; value: number; onChange: (n: number) => void; prefix?: string; suffix?: string; hint?: ReactNode; min?: number; step?: number }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink-2 mb-1.5">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">{prefix}</span>}
        <input id={id} type="number" inputMode="decimal" min={min} step={step} className={cx(inputClass, "num", prefix && "pl-7", suffix && "pr-16")}
          value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ label, value, onChange, options, hideLabel }: { label: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; hideLabel?: boolean }) {
  return (
    <fieldset>
      <legend className={hideLabel ? "sr-only" : "text-[13px] font-medium text-ink-2 mb-1.5"}>{label}</legend>
      <div className="inline-flex flex-wrap rounded-[var(--radius-sm)] border border-line-2 bg-card p-0.5">
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
            className={cx("h-8 px-3 text-[13px] rounded-[4px]", value === o.value ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export const rupees = (n: number) => `₹${formatINR(Math.round(n))}`;

/** Lakh/crore wording for large rupee amounts. */
export function inWords(n: number) {
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return rupees(n);
}

export function ResultRow({ label, value, strong, sub }: { label: ReactNode; value: ReactNode; strong?: boolean; sub?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-line last:border-0">
      <span className="text-sm text-ink-2">{label}{sub && <span className="block text-xs text-muted">{sub}</span>}</span>
      <span className={cx("num text-right", strong ? "text-lg font-semibold" : "text-sm font-medium")}>{value}</span>
    </div>
  );
}
