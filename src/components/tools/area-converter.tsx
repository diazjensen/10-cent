"use client";

import { useState } from "react";
import { AREA_UNITS, BIGHA_SQFT, DEFAULT_BIGHA_STATE, convertArea, fmtArea, type AreaUnit } from "@/lib/tools/area";
import { Card, Select, cx, inputClass } from "@/components/ui";

export function AreaConverter() {
  const [state, setState] = useState(DEFAULT_BIGHA_STATE);
  const [src, setSrc] = useState<{ unit: AreaUnit; text: string }>({ unit: "sqft", text: "1200" });
  const value = Number(src.text.replace(/,/g, ""));
  const valid = src.text.trim() !== "" && Number.isFinite(value) && value >= 0;

  const display = (u: AreaUnit) => {
    if (u === src.unit) return src.text;
    if (!valid) return "";
    return fmtArea(convertArea(value, src.unit, u, state));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
      <Card className="p-5 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
          {AREA_UNITS.map((u) => (
            <div key={u.key}>
              <label htmlFor={`area-${u.key}`} className="flex items-baseline justify-between text-[13px] font-medium text-ink-2 mb-1.5">
                {u.label}
                {u.key === "bigha" && <span className="text-xs font-normal text-muted">{state}</span>}
              </label>
              <div className="relative">
                <input
                  id={`area-${u.key}`}
                  inputMode="decimal"
                  className={cx(inputClass, "num pr-14 text-base h-11", u.key === src.unit && "border-ink")}
                  value={display(u.key)}
                  onChange={(e) => setSrc({ unit: u.key, text: e.target.value.replace(/[^\d.,]/g, "") })}
                  aria-invalid={u.key === src.unit && !valid && src.text !== "" ? true : undefined}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{u.short}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-5 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <div>
            <label htmlFor="bigha-state" className="block text-[13px] font-medium text-ink-2 mb-1.5">State for bigha</label>
            <Select id="bigha-state" value={state} onChange={(e) => setState(e.target.value)}>
              {Object.keys(BIGHA_SQFT).map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <p className="text-sm text-ink-2 num">1 bigha in {state} = {BIGHA_SQFT[state].sqft.toLocaleString("en-IN")} sq ft{BIGHA_SQFT[state].note ? ` (${BIGHA_SQFT[state].note})` : ""}</p>
        </div>
      </Card>
      <Card className="p-5 md:p-6 text-sm">
        <h2 className="font-medium mb-3">Reference values</h2>
        <dl className="num divide-y divide-line">
          {[["1 sq m", "10.764 sq ft"], ["1 sq yd (gaj)", "9 sq ft"], ["1 cent", "435.6 sq ft"], ["1 acre", "43,560 sq ft · 100 cents"], ["1 hectare", "2.471 acres"]].map(([a, b]) => (
            <div key={a} className="flex justify-between py-2"><dt className="text-ink-2">{a}</dt><dd>{b}</dd></div>
          ))}
        </dl>
        <h3 className="font-medium mt-5 mb-2">Bigha by state</h3>
        <dl className="num divide-y divide-line">
          {Object.entries(BIGHA_SQFT).map(([s, v]) => (
            <div key={s} className={cx("flex justify-between py-1.5", s === state && "font-semibold")}><dt className="text-ink-2">{s}</dt><dd>{v.sqft.toLocaleString("en-IN")} sq ft</dd></div>
          ))}
        </dl>
        <p className="text-xs text-muted mt-4">
          Bigha is a traditional unit with no national standard. These are the commonly used revenue values; some districts differ,
          so check the land record (khatauni / jamabandi) before you rely on a bigha figure.
        </p>
      </Card>
    </div>
  );
}
