"use client";

import { useId, useState } from "react";
import { formatINR, formatPrice } from "@/lib/format";

/** Inline EMI calculator for sale listings (PRD D7). */
export function EmiCalculator({ price }: { price: number }) {
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);
  const id = useId();
  const loan = Math.round(price * (1 - downPct / 100));
  const r = rate / 12 / 100, n = years * 12;
  const emi = r === 0 ? loan / n : (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const total = emi * n, interest = total - loan;
  const principalShare = total > 0 ? loan / total : 1;

  const row = (label: string, value: number, set: (n: number) => void, min: number, max: number, step: number, fmt: (n: number) => string, key: string) => (
    <div>
      <div className="flex justify-between items-baseline text-sm">
        <label htmlFor={`${id}-${key}`} className="text-ink-2">{label}</label>
        <span className="num font-medium">{fmt(value)}</span>
      </div>
      <input id={`${id}-${key}`} type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="w-full mt-1.5 accent-[var(--color-ink)]" />
    </div>
  );

  return (
    <div className="grid md:grid-cols-[1fr_260px] gap-6">
      <div className="space-y-4">
        {row("Down payment", downPct, setDownPct, 10, 90, 5, (v) => `${v}% · ${formatPrice(Math.round((price * v) / 100), { short: true })}`, "down")}
        {row("Interest rate", rate, setRate, 6, 14, 0.05, (v) => `${v.toFixed(2)}% p.a.`, "rate")}
        {row("Tenure", years, setYears, 5, 30, 1, (v) => `${v} years`, "years")}
      </div>
      <div className="bg-paper-2 rounded-[var(--radius-md)] p-4" aria-live="polite">
        <div className="text-xs text-muted">Monthly EMI</div>
        <div className="num text-3xl font-semibold tracking-tight mt-0.5">₹{formatINR(Math.round(emi))}</div>
        <div className="mt-3 h-2 rounded-full bg-accent-soft overflow-hidden" aria-hidden>
          <div className="h-full bg-ink" style={{ width: `${principalShare * 100}%` }} />
        </div>
        <dl className="mt-3 space-y-1 text-[13px]">
          <div className="flex justify-between"><dt className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-ink" />Loan amount</dt><dd className="num">{formatPrice(loan, { short: true })}</dd></div>
          <div className="flex justify-between"><dt className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-soft border border-accent/30" />Total interest</dt><dd className="num">{formatPrice(Math.round(interest), { short: true })}</dd></div>
          <div className="flex justify-between pt-1 border-t border-line"><dt>Total payable</dt><dd className="num font-medium">{formatPrice(Math.round(total), { short: true })}</dd></div>
        </dl>
      </div>
    </div>
  );
}
