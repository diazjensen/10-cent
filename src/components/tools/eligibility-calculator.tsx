"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { eligibility, emi } from "@/lib/tools/emi";
import { Card, btnClass } from "@/components/ui";
import { SliderField, NumField, ResultRow, inWords, rupees } from "./fields";

export function EligibilityCalculator() {
  const [income, setIncome] = useState(1_50_000);
  const [existing, setExisting] = useState(0);
  const [rate, setRate] = useState(8.5);
  const [years, setYears] = useState(20);
  const [foir, setFoir] = useState(50);
  const [dp, setDp] = useState(15_00_000);
  const r = useMemo(() => eligibility({ monthlyIncome: income, existingEmis: existing, annualRate: rate, years, foir, downPayment: dp }), [income, existing, rate, years, foir, dp]);
  const emiAtPrice = emi(r.loanAtPrice, rate, years * 12);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
      <Card className="p-5 md:p-6 space-y-5">
        <SliderField label="Net monthly income" value={income} onChange={setIncome} min={10_000} max={20_00_000} step={5_000} prefix="₹" display={inWords} hint="Take-home salary, or average monthly business income after tax. Add a co-applicant's income here." />
        <SliderField label="Existing EMIs" value={existing} onChange={setExisting} min={0} max={5_00_000} step={1_000} prefix="₹" hint="Car, personal and education loans; credit card dues" />
        <SliderField label="Interest rate" value={rate} onChange={setRate} min={6} max={15} step={0.05} suffix="% p.a." />
        <SliderField label="Tenure" value={years} onChange={setYears} min={5} max={30} step={1} suffix="years" />
        <SliderField label="FOIR" value={foir} onChange={setFoir} min={30} max={70} step={1} suffix="%" hint="Fixed obligation to income ratio. Banks usually allow 40–50% below ₹1 L income and up to 60–65% above it." />
        <NumField label="Savings for down payment" value={dp} onChange={setDp} prefix="₹" step={50_000} hint={inWords(dp)} />
      </Card>
      <div className="space-y-6 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-5 md:p-6">
            <div className="text-xs text-muted">You may be eligible for a loan of</div>
            <div className="num text-[34px] font-semibold tracking-tight leading-tight mt-1">{inWords(r.maxLoan)}</div>
            <div className="num text-xs text-muted">{rupees(r.maxLoan)} at an EMI of {rupees(r.maxEmi)}</div>
          </Card>
          <Card className="p-5 md:p-6 bg-ink text-white border-ink">
            <div className="text-xs text-white/60">Home price that fits</div>
            <div className="num text-[34px] font-semibold tracking-tight leading-tight mt-1">{inWords(r.affordablePrice)}</div>
            <div className="text-xs text-white/60">Loan + your savings, within RBI loan-to-value limits</div>
          </Card>
        </div>
        {r.maxEmi <= 0 ? (
          <Card className="p-5 text-sm text-danger bg-danger-soft border-danger/20">Your existing EMIs already use up the FOIR limit. Close or reduce an existing loan, add a co-applicant, or choose a longer tenure.</Card>
        ) : (
          <Card className="p-5 md:p-6">
            <h2 className="font-medium mb-2">How this is worked out</h2>
            <ResultRow label="Maximum total EMIs" sub={`${foir}% of ${rupees(income)}`} value={rupees((income * foir) / 100)} />
            <ResultRow label="Less existing EMIs" value={`− ${rupees(existing)}`} />
            <ResultRow label="EMI available for the home loan" value={rupees(r.maxEmi)} strong />
            <ResultRow label="Loan that EMI can repay" sub={`${rate}% for ${years} years`} value={rupees(r.maxLoan)} />
            <ResultRow label="Loan used at this price" sub={`LTV cap ${Math.round(r.ltv * 100)}% of property value`} value={rupees(r.loanAtPrice)} />
            <ResultRow label="Down payment from savings" value={rupees(r.downPaymentNeeded)} />
            <ResultRow label="EMI at this price" value={rupees(emiAtPrice)} />
            <ResultRow label="Affordable property price" value={rupees(r.affordablePrice)} strong />
            <p className="text-xs text-muted mt-3">
              RBI caps home loans at 90% of value up to ₹30 L, 80% up to ₹75 L and 75% above. Budget a further 6–8% for stamp duty and registration,
              which banks do not fund.
            </p>
          </Card>
        )}
        <div className="flex flex-wrap gap-3">
          <Link href={`/search?tx=sell&max=${Math.round(r.affordablePrice)}`} className={btnClass("primary")}>See homes under {inWords(r.affordablePrice)}</Link>
          <Link href="/services/home-loan" className={btnClass("secondary")}>Compare bank rates</Link>
          <Link href="/tools/stamp-duty" className={btnClass("ghost")}>Stamp duty calculator</Link>
        </div>
      </div>
    </div>
  );
}
