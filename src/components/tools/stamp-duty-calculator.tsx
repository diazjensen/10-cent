"use client";

import { useState } from "react";
import { STAMP_DUTY_RULES, stampDuty, type Buyer } from "@/lib/tools/stamp-duty";
import { Card, Select, Notice, cx } from "@/components/ui";
import { SliderField, Segmented, ResultRow, inWords, rupees } from "./fields";

export function StampDutyCalculator() {
  const [code, setCode] = useState("KA");
  const [value, setValue] = useState(80_00_000);
  const [buyer, setBuyer] = useState<Buyer>("male");
  const rule = STAMP_DUTY_RULES.find((r) => r.code === code)!;
  const [area, setArea] = useState<string | undefined>(undefined);
  const areaKey = rule.areas ? (rule.areas.some((a) => a.key === area) ? area : rule.areas[0].key) : undefined;
  const r = stampDuty(code, value, buyer, areaKey);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
        <Card className="p-5 md:p-6 space-y-5">
          <div>
            <label htmlFor="sd-state" className="block text-[13px] font-medium text-ink-2 mb-1.5">State</label>
            <Select id="sd-state" value={code} onChange={(e) => setCode(e.target.value)}>
              {STAMP_DUTY_RULES.map((s) => <option key={s.code} value={s.code}>{s.state}</option>)}
            </Select>
          </div>
          {rule.areas && (
            <div>
              <label htmlFor="sd-area" className="block text-[13px] font-medium text-ink-2 mb-1.5">Area</label>
              <Select id="sd-area" value={areaKey} onChange={(e) => setArea(e.target.value)}>
                {rule.areas.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </Select>
            </div>
          )}
          <SliderField label="Property value" value={value} onChange={setValue} min={5_00_000} max={20_00_00_000} step={50_000} prefix="₹" display={inWords} hint="Agreement value or guidance (circle) value, whichever is higher" />
          <Segmented label="Buyer" value={buyer} onChange={setBuyer} options={[{ value: "male", label: "Man" }, { value: "female", label: "Woman" }, { value: "joint", label: "Joint (man + woman)" }]} />
        </Card>
        <div className="space-y-4 min-w-0">
          <Card className="p-5 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs text-muted">Total government charges in {rule.state}</div>
                <div className="num text-[34px] font-semibold tracking-tight leading-tight">{rupees(r.total)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted">Effective rate</div>
                <div className="num text-2xl font-semibold">{r.effectiveRate.toFixed(2)}%</div>
              </div>
            </div>
            <div className="mt-5">
              <ResultRow label="Stamp duty" value={rupees(r.stampDuty)} />
              <ResultRow label="Cess / surcharge / transfer duty" value={r.cess ? rupees(r.cess) : "—"} />
              <ResultRow label="Registration fee" value={r.registration ? rupees(r.registration) : "Nil"} />
              <ResultRow label="Total" value={rupees(r.total)} strong />
            </div>
            {r.notes.length > 0 && <ul className="mt-3 text-xs text-muted list-disc pl-4 space-y-0.5">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          </Card>
          <Notice tone="warn">
            Rates change through state notifications. Verify the current schedule on the{" "}
            <a href={rule.igr} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-medium">{rule.state} IGR / registration website</a>{" "}
            before you pay. Stamp duty is charged on the higher of the agreement value and the government guidance value.
          </Notice>
        </div>
      </div>
      <section>
        <h2 className="font-display text-3xl mb-4">Rules used, by state</h2>
        <div className="overflow-x-auto bg-card border border-line rounded-[var(--radius-md)]">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-paper-2 text-xs text-muted text-left">
              <tr><th className="font-medium px-4 py-2.5 w-44">State</th><th className="font-medium px-4 py-2.5">Stamp duty and registration</th><th className="font-medium px-4 py-2.5 w-36">Verify at</th></tr>
            </thead>
            <tbody>
              {STAMP_DUTY_RULES.map((s) => (
                <tr key={s.code} className={cx("border-t border-line align-top", s.code === code && "bg-accent-soft/40")}>
                  <td className="px-4 py-3 font-medium">{s.state}</td>
                  <td className="px-4 py-3 text-ink-2"><ul className="space-y-0.5">{s.summary.map((x) => <li key={x}>{x}</li>)}</ul></td>
                  <td className="px-4 py-3"><a href={s.igr} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline underline-offset-2 break-all">{s.igr.replace(/^https?:\/\//, "")}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
