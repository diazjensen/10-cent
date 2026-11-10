"use client";

import { useMemo, useState } from "react";
import { amortise } from "@/lib/tools/emi";
import { formatINR } from "@/lib/format";
import { Card, cx } from "@/components/ui";
import { SliderField, NumField, Segmented, ResultRow, inWords, rupees } from "./fields";

export function EmiCalculator({ initialAmount = 50_00_000 }: { initialAmount?: number }) {
  const [amount, setAmount] = useState(initialAmount);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);
  const [prepayOn, setPrepayOn] = useState(false);
  const [oneTime, setOneTime] = useState(5_00_000);
  const [oneTimeMonth, setOneTimeMonth] = useState(24);
  const [yearly, setYearly] = useState(0);
  const [mode, setMode] = useState<"tenure" | "emi">("tenure");
  const [view, setView] = useState<"yearly" | "monthly">("yearly");

  const months = Math.max(1, Math.round(years * 12));
  const base = useMemo(() => amortise(amount, rate, months), [amount, rate, months]);
  const withPre = useMemo(
    () => (prepayOn ? amortise(amount, rate, months, { oneTimeAmount: oneTime, oneTimeMonth, yearlyAmount: yearly, mode }) : null),
    [prepayOn, amount, rate, months, oneTime, oneTimeMonth, yearly, mode]
  );
  const s = withPre ?? base;
  const principalShare = amount + s.totalInterest > 0 ? (amount / (amount + s.totalInterest)) * 100 : 0;
  const maxYear = Math.max(...s.years.map((y) => y.principal + y.interest + y.prepayment), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
      <Card className="p-5 md:p-6 space-y-5 lg:sticky lg:top-24">
        <SliderField label="Loan amount" value={amount} onChange={setAmount} min={1_00_000} max={10_00_00_000} step={50_000} prefix="₹" display={inWords} />
        <SliderField label="Interest rate" value={rate} onChange={setRate} min={5} max={16} step={0.05} suffix="% p.a." />
        <SliderField label="Tenure" value={years} onChange={setYears} min={1} max={30} step={1} suffix="years" display={(n) => `${Math.round(n * 12)} months`} />
        <div className="pt-4 border-t border-line">
          <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={prepayOn} onChange={(e) => setPrepayOn(e.target.checked)} className="w-4 h-4 accent-[var(--color-accent)]" />
            Add part-prepayment
          </label>
          {prepayOn && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <NumField label="One-time amount" value={oneTime} onChange={setOneTime} prefix="₹" step={10000} />
                <NumField label="Paid in month" value={oneTimeMonth} onChange={(n) => setOneTimeMonth(Math.max(1, Math.round(n)))} min={1} hint={`Year ${Math.ceil(oneTimeMonth / 12)}`} />
              </div>
              <NumField label="Every year (recurring)" value={yearly} onChange={setYearly} prefix="₹" step={10000} hint="Paid at the end of each loan year" />
              <Segmented label="After prepaying" value={mode} onChange={setMode} options={[{ value: "tenure", label: "Reduce tenure" }, { value: "emi", label: "Reduce EMI" }]} />
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-6 min-w-0">
        <Card className="p-5 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <div className="text-xs text-muted">Monthly EMI</div>
              <div className="num text-[34px] font-semibold tracking-tight leading-tight">{rupees(base.firstEmi)}</div>
              {withPre && mode === "emi" && <div className="num text-xs text-trust mt-0.5">Falls to {rupees(withPre.lastEmi)} after prepaying</div>}
            </div>
            <div>
              <div className="text-xs text-muted">Total interest</div>
              <div className="num text-2xl font-semibold mt-1.5">{inWords(s.totalInterest)}</div>
              <div className="num text-xs text-muted">{rupees(s.totalInterest)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Total payable</div>
              <div className="num text-2xl font-semibold mt-1.5">{inWords(amount + s.totalInterest)}</div>
              <div className="num text-xs text-muted">over {Math.floor(s.months / 12)} yr {s.months % 12 ? `${s.months % 12} mo` : ""}</div>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex h-3 rounded-full overflow-hidden bg-paper-2" role="img" aria-label={`Principal ${principalShare.toFixed(0)} percent, interest ${(100 - principalShare).toFixed(0)} percent`}>
              <div className="bg-ink" style={{ width: `${principalShare}%` }} />
              <div className="bg-accent" style={{ width: `${100 - principalShare}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs">
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-ink" />Principal <b className="num">{principalShare.toFixed(1)}%</b></span>
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-accent" />Interest <b className="num">{(100 - principalShare).toFixed(1)}%</b></span>
            </div>
          </div>
        </Card>

        {withPre && (
          <Card className="p-5 md:p-6 border-trust/30 bg-trust-soft/40">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-trust">Prepayment impact</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-3">
              <div><div className="text-xs text-muted">Interest saved</div><div className="num text-2xl font-semibold text-trust">{inWords(base.totalInterest - withPre.totalInterest)}</div></div>
              <div><div className="text-xs text-muted">{mode === "tenure" ? "Loan closes earlier by" : "EMI reduced by"}</div>
                <div className="num text-2xl font-semibold">{mode === "tenure" ? `${base.months - withPre.months} months` : rupees(base.firstEmi - withPre.lastEmi)}</div></div>
              <div><div className="text-xs text-muted">Total prepaid</div><div className="num text-2xl font-semibold">{inWords(withPre.totalPrepaid)}</div></div>
            </div>
            <p className="text-xs text-muted mt-3">Most banks charge no prepayment penalty on floating-rate home loans to individuals (RBI). Check your sanction letter for fixed-rate loans.</p>
          </Card>
        )}

        <Card className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className="font-medium">Year by year</h2>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-ink" />Principal</span>
              <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-accent" />Interest</span>
              {withPre && <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-trust" />Prepayment</span>}
            </div>
          </div>
          <div className="flex items-end gap-[3px] h-40" role="img" aria-label="Principal and interest paid each year">
            {s.years.map((y) => {
              const tot = y.principal + y.interest + y.prepayment;
              return (
                <div key={y.year} className="flex-1 min-w-0 flex flex-col justify-end h-full group relative" title={`Year ${y.year}: principal ${rupees(y.principal)}, interest ${rupees(y.interest)}${y.prepayment ? `, prepaid ${rupees(y.prepayment)}` : ""}`}>
                  <div style={{ height: `${(tot / maxYear) * 100}%` }} className="flex flex-col rounded-t-[2px] overflow-hidden">
                    {y.prepayment > 0 && <div className="bg-trust" style={{ flex: y.prepayment }} />}
                    <div className="bg-accent" style={{ flex: y.interest }} />
                    <div className="bg-ink" style={{ flex: y.principal }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[11px] text-muted mt-1 num"><span>Year 1</span><span>Year {s.years.length}</span></div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-4 md:px-6 border-b border-line">
            <h2 className="font-medium">Amortisation schedule</h2>
            <Segmented label="Schedule view" hideLabel value={view} onChange={setView} options={[{ value: "yearly", label: "Yearly" }, { value: "monthly", label: "Monthly" }]} />
          </div>
          <div className="overflow-auto max-h-[520px]">
            <table className="w-full text-sm num">
              <thead className="sticky top-0 bg-paper-2 text-xs text-muted text-right">
                <tr>
                  <th className="text-left font-medium px-4 md:px-6 py-2">{view === "yearly" ? "Year" : "Month"}</th>
                  <th className="font-medium px-3 py-2">Principal</th>
                  <th className="font-medium px-3 py-2">Interest</th>
                  {withPre && <th className="font-medium px-3 py-2">Prepaid</th>}
                  <th className="font-medium px-4 md:px-6 py-2">Balance</th>
                </tr>
              </thead>
              <tbody className="text-right">
                {view === "yearly"
                  ? s.years.map((y) => (
                      <tr key={y.year} className="border-t border-line">
                        <td className="text-left px-4 md:px-6 py-2">{y.year}</td>
                        <td className="px-3 py-2">{formatINR(Math.round(y.principal))}</td>
                        <td className="px-3 py-2">{formatINR(Math.round(y.interest))}</td>
                        {withPre && <td className={cx("px-3 py-2", y.prepayment ? "text-trust" : "text-muted")}>{y.prepayment ? formatINR(Math.round(y.prepayment)) : "—"}</td>}
                        <td className="px-4 md:px-6 py-2">{formatINR(Math.round(y.balance))}</td>
                      </tr>
                    ))
                  : s.rows.map((r) => (
                      <tr key={r.month} className={cx("border-t border-line", r.month % 12 === 0 && "border-b-line-2")}>
                        <td className="text-left px-4 md:px-6 py-1.5">{r.month} <span className="text-[11px] text-muted">Y{Math.ceil(r.month / 12)}</span></td>
                        <td className="px-3 py-1.5">{formatINR(Math.round(r.principal))}</td>
                        <td className="px-3 py-1.5">{formatINR(Math.round(r.interest))}</td>
                        {withPre && <td className={cx("px-3 py-1.5", r.prepayment ? "text-trust" : "text-muted")}>{r.prepayment ? formatINR(Math.round(r.prepayment)) : "—"}</td>}
                        <td className="px-4 md:px-6 py-1.5">{formatINR(Math.round(r.balance))}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="text-xs text-muted space-y-1">
          <ResultRow label="Formula" value={<span className="font-mono text-[11px]">EMI = P·r·(1+r)^n / ((1+r)^n − 1)</span>} />
          <p>r is the monthly rate (annual rate ÷ 12 ÷ 100) and n the number of monthly instalments. Banks may round the EMI up to the next rupee.</p>
        </div>
      </div>
    </div>
  );
}
