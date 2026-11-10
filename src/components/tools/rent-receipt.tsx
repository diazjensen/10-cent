"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { rupeesInWords } from "@/lib/tools/words";
import { formatINR } from "@/lib/format";
import { Button, Card, Input, Label, Select, Textarea, Notice } from "@/components/ui";

type F = { tenant: string; landlord: string; pan: string; address: string; rent: number; from: string; to: string; mode: string; day: number };

function monthsBetween(from: string, to: string) {
  const out: Date[] = [];
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) return out;
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  let y = fy, m = fm;
  while ((y < ty || (y === ty && m <= tm)) && out.length < 24) {
    out.push(new Date(Date.UTC(y, m - 1, 1)));
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

export function RentReceipt() {
  const now = new Date();
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [f, setF] = useState<F>({ tenant: "", landlord: "", pan: "", address: "", rent: 25000, from: `${fyStart}-04`, to: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, mode: "Bank transfer (UPI/NEFT)", day: 5 });
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((x) => ({ ...x, [k]: v }));
  const months = useMemo(() => monthsBetween(f.from, f.to), [f.from, f.to]);
  const annual = f.rent * 12;
  const panNeeded = annual > 1_00_000;
  const ready = f.tenant.trim() && f.landlord.trim() && f.address.trim() && f.rent > 0 && months.length > 0;
  const panOk = !f.pan || /^[A-Z]{5}\d{4}[A-Z]$/.test(f.pan);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-6 items-start">
      <style>{`@media print { body * { visibility: hidden !important; } #receipts, #receipts * { visibility: visible !important; } #receipts { position: absolute; left: 0; top: 0; width: 100%; } .receipt { break-inside: avoid; } }`}</style>
      <Card className="p-5 md:p-6 space-y-4 print:hidden">
        <div><Label htmlFor="rr-tenant">Tenant name</Label><Input id="rr-tenant" value={f.tenant} onChange={(e) => set("tenant", e.target.value)} placeholder="As on your salary slip" /></div>
        <div><Label htmlFor="rr-landlord">Landlord name</Label><Input id="rr-landlord" value={f.landlord} onChange={(e) => set("landlord", e.target.value)} /></div>
        <div>
          <Label htmlFor="rr-pan" hint={panNeeded ? "(required: rent above ₹1 L a year)" : "(optional)"}>Landlord PAN</Label>
          <Input id="rr-pan" value={f.pan} maxLength={10} onChange={(e) => set("pan", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="ABCDE1234F" aria-invalid={!panOk || undefined} />
          {!panOk && <p className="text-xs text-danger mt-1">PAN should look like ABCDE1234F.</p>}
        </div>
        <div><Label htmlFor="rr-addr">Rented property address</Label><Textarea id="rr-addr" value={f.address} onChange={(e) => set("address", e.target.value)} rows={3} className="min-h-0" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="rr-rent">Monthly rent (₹)</Label><Input id="rr-rent" type="number" min={1} value={f.rent || ""} onChange={(e) => set("rent", Number(e.target.value))} className="num" /></div>
          <div><Label htmlFor="rr-day">Paid on day</Label><Input id="rr-day" type="number" min={1} max={28} value={f.day} onChange={(e) => set("day", Math.min(28, Math.max(1, Number(e.target.value) || 1)))} className="num" /></div>
          <div><Label htmlFor="rr-from">From month</Label><Input id="rr-from" type="month" value={f.from} onChange={(e) => set("from", e.target.value)} /></div>
          <div><Label htmlFor="rr-to">To month</Label><Input id="rr-to" type="month" value={f.to} onChange={(e) => set("to", e.target.value)} /></div>
        </div>
        <div><Label htmlFor="rr-mode">Payment mode</Label>
          <Select id="rr-mode" value={f.mode} onChange={(e) => set("mode", e.target.value)}>
            {["Bank transfer (UPI/NEFT)", "Cash", "Cheque"].map((m) => <option key={m}>{m}</option>)}
          </Select>
        </div>
        <Button type="button" className="w-full" disabled={!ready || !panOk || (panNeeded && !f.pan)} onClick={() => window.print()}><Printer size={16} aria-hidden /> Print {months.length} receipt{months.length === 1 ? "" : "s"}</Button>
        <p className="text-xs text-muted">Nothing you type here leaves your browser. Ask your landlord to sign each receipt; a revenue stamp is needed for cash payments above ₹5,000.</p>
      </Card>
      <div id="receipts" className="space-y-4 min-w-0">
        {!ready && <Notice className="print:hidden">Fill in tenant, landlord, address, rent and the months to see your receipts.</Notice>}
        {ready && months.map((d, i) => {
          const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
          const paid = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), f.day)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
          return (
            <div key={i} className="receipt bg-card border border-line rounded-[var(--radius-md)] p-5 md:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-dashed border-line-2 pb-3">
                <div>
                  <div className="font-display text-2xl">Rent receipt</div>
                  <div className="text-xs text-muted">{label}</div>
                </div>
                <div className="text-right text-xs text-muted num">Receipt no. {String(i + 1).padStart(3, "0")}<br />Date {paid}</div>
              </div>
              <p className="mt-4 text-sm leading-7 text-ink-2">
                Received a sum of <b className="text-ink num">₹{formatINR(f.rent)}</b> ({rupeesInWords(f.rent)}) from <b className="text-ink">{f.tenant}</b> towards
                the rent of <b className="text-ink">{f.address}</b> for the period {label}, paid by {f.mode.toLowerCase()}.
              </p>
              <div className="mt-6 flex items-end justify-between gap-4 text-sm">
                <div>
                  <div className="text-ink">{f.landlord}</div>
                  {f.pan && <div className="text-xs text-muted num">PAN {f.pan}</div>}
                </div>
                <div className="text-center">
                  <div className="w-40 h-10 border-b border-ink-2" />
                  <div className="text-xs text-muted mt-1">Landlord&apos;s signature</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
