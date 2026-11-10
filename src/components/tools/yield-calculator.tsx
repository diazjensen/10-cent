"use client";

import { useMemo, useState } from "react";
import { rentalYield } from "@/lib/tools/yield";
import { formatINR } from "@/lib/format";
import { Card } from "@/components/ui";
import { SliderField, NumField, ResultRow, inWords, rupees } from "./fields";

export function YieldCalculator() {
  const [price, setPrice] = useState(1_00_00_000);
  const [rent, setRent] = useState(32_000);
  const [maint, setMaint] = useState(3_500);
  const [vacancy, setVacancy] = useState(1);
  const [ptax, setPtax] = useState(12_000);
  const [slab, setSlab] = useState(30);
  const [appr, setAppr] = useState(5);
  const [rentGrowth, setRentGrowth] = useState(5);
  const [acq, setAcq] = useState(7);
  const r = useMemo(() => rentalYield({ price, monthlyRent: rent, monthlyMaintenance: maint, vacancyMonths: vacancy, propertyTax: ptax, taxSlab: slab, appreciation: appr, rentGrowth, acquisitionCost: acq }), [price, rent, maint, vacancy, ptax, slab, appr, rentGrowth, acq]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
      <Card className="p-5 md:p-6 space-y-5">
        <SliderField label="Purchase price" value={price} onChange={setPrice} min={5_00_000} max={20_00_00_000} step={50_000} prefix="₹" display={inWords} />
        <SliderField label="Monthly rent" value={rent} onChange={setRent} min={2_000} max={5_00_000} step={500} prefix="₹" />
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Maintenance / month" value={maint} onChange={setMaint} prefix="₹" step={100} hint="Paid by you" />
          <NumField label="Vacancy" value={vacancy} onChange={(n) => setVacancy(Math.min(12, n))} suffix="months/yr" step={0.5} />
          <NumField label="Property tax / year" value={ptax} onChange={setPtax} prefix="₹" step={500} />
          <NumField label="Income-tax slab" value={slab} onChange={(n) => setSlab(Math.min(42.744, n))} suffix="%" />
          <NumField label="Price growth" value={appr} onChange={setAppr} suffix="% / yr" step={0.5} />
          <NumField label="Rent growth" value={rentGrowth} onChange={setRentGrowth} suffix="% / yr" step={0.5} />
        </div>
        <NumField label="Buying costs" value={acq} onChange={setAcq} suffix="% of price" step={0.5} hint="Stamp duty, registration, brokerage, legal" />
      </Card>
      <div className="space-y-6 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5"><div className="text-xs text-muted">Gross yield</div><div className="num text-3xl font-semibold mt-1">{r.grossYield.toFixed(2)}%</div><div className="text-xs text-muted num">{rupees(rent * 12)} a year</div></Card>
          <Card className="p-5"><div className="text-xs text-muted">Net yield (after costs & tax)</div><div className="num text-3xl font-semibold mt-1">{r.netYield.toFixed(2)}%</div><div className="text-xs text-muted num">{rupees(r.netIncomeYear1)} in year 1</div></Card>
          <Card className="p-5 bg-ink text-white border-ink"><div className="text-xs text-white/60">5-year total return</div><div className="num text-3xl font-semibold mt-1">{r.roi5.toFixed(1)}%</div><div className="text-xs text-white/60 num">{r.cagr.toFixed(2)}% a year (CAGR)</div></Card>
        </div>
        <Card className="p-5 md:p-6">
          <h2 className="font-medium mb-2">Five-year view</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm num min-w-[420px]">
              <thead className="text-xs text-muted text-right"><tr><th className="text-left font-medium py-2">Year</th><th className="font-medium py-2">Rent billed</th><th className="font-medium py-2">Net income</th><th className="font-medium py-2">Property value</th></tr></thead>
              <tbody className="text-right">
                {r.years.map((y) => (
                  <tr key={y.year} className="border-t border-line"><td className="text-left py-2">{y.year}</td><td>{formatINR(Math.round(y.rent))}</td><td>{formatINR(Math.round(y.netIncome))}</td><td>{inWords(y.value)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <ResultRow label="Total invested" sub={`Price + ${acq}% buying costs`} value={rupees(r.invested)} />
            <ResultRow label="Net rental income, 5 years" value={rupees(r.totalNetIncome)} />
            <ResultRow label="Value after 5 years" value={rupees(r.finalValue)} />
            <ResultRow label="Total gain" value={rupees(r.gain)} strong />
          </div>
          <p className="text-xs text-muted mt-3">Tax assumes rent is taxed under house property: 30% standard deduction on rent net of property tax, at your slab. Ignores loan interest, capital gains tax on sale and selling costs.</p>
        </Card>
      </div>
    </div>
  );
}
