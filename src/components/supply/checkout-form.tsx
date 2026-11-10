"use client";

import { useActionState, useState, useTransition } from "react";
import { Lock, Tag, X } from "lucide-react";
import { checkCouponAction, createOrderAction, type CheckoutState } from "@/app/checkout/actions";
import { Button, Input, Notice, Select } from "@/components/ui";
import { Field } from "./field";
import { GST_RATE, HOME_STATE, STATES } from "@/lib/constants";
import { formatPaise } from "@/lib/format";

export function CheckoutForm({ plan, defaults }: { plan: { code: string; name: string; price_paise: number }; defaults: { name: string; gstin: string; state: string } }) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(createOrderAction, null);
  const [billState, setBillState] = useState(defaults.state);
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; percent: number } | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const e = state?.errors ?? {};

  const amount = plan.price_paise;
  const discount = coupon ? Math.round((amount * coupon.percent) / 100) : 0;
  const taxable = amount - discount;
  const gst = Math.round(taxable * GST_RATE);
  const intra = billState === HOME_STATE;
  const cgst = intra ? Math.floor(gst / 2) : 0;

  const apply = () =>
    startCheck(async () => {
      const r = await checkCouponAction(code);
      if (r?.ok && r.code && r.percent) { setCoupon({ code: r.code, percent: r.percent }); setCouponErr(null); }
      else { setCoupon(null); setCouponErr(r?.error ?? "Invalid coupon"); }
    });

  return (
    <form action={action} className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start" noValidate>
      <input type="hidden" name="plan" value={plan.code} />
      <input type="hidden" name="coupon" value={coupon?.code ?? ""} />
      <div className="bg-card border border-line rounded-[var(--radius-md)] p-5 md:p-6 space-y-5">
        <h2 className="font-display text-2xl">Billing details</h2>
        {state?.message && <Notice tone="danger">{state.message}</Notice>}
        {e.form && <Notice tone="danger">{e.form}</Notice>}
        <Field label="Name on invoice" error={e.billing_name} hint="person or company">
          <Input name="billing_name" defaultValue={state?.values?.billing_name ?? defaults.name} required autoComplete="organization" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="State" error={e.state} hint="decides CGST/SGST or IGST">
            <Select name="state" defaultValue={state?.values?.state ?? defaults.state} onChange={(ev) => setBillState(ev.target.value)} required>
              <option value="">Select state</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="GSTIN" error={e.gstin} hint="optional">
            <Input name="gstin" defaultValue={state?.values?.gstin ?? defaults.gstin} maxLength={15} placeholder="29ABCDE1234F1Z5" className="uppercase" />
          </Field>
        </div>
        <div>
          <label htmlFor="coupon_code" className="block text-[13px] font-medium text-ink-2 mb-1.5">Coupon code</label>
          {coupon ? (
            <div className="flex items-center justify-between h-10 px-3 rounded-[var(--radius-sm)] border border-trust/30 bg-trust-soft text-sm text-trust">
              <span className="inline-flex items-center gap-2"><Tag size={14} /> <b>{coupon.code}</b> applied · {coupon.percent}% off</span>
              <button type="button" onClick={() => { setCoupon(null); setCode(""); }} aria-label="Remove coupon" className="p-1 hover:opacity-70"><X size={14} /></button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input id="coupon_code" value={code} onChange={(ev) => setCode(ev.target.value.toUpperCase())} onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); apply(); } }} placeholder="e.g. WELCOME20" className="uppercase" />
              <Button type="button" variant="secondary" onClick={apply} disabled={checking || !code.trim()}>{checking ? "Checking…" : "Apply"}</Button>
            </div>
          )}
          {(couponErr || e.coupon) && <p className="mt-1 text-xs text-danger">{couponErr || e.coupon}</p>}
        </div>
      </div>

      <aside className="bg-card border border-line rounded-[var(--radius-md)] p-5 md:p-6 lg:sticky lg:top-24">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Order summary</p>
        <p className="font-medium mt-2">{plan.name}</p>
        <dl className="mt-4 space-y-2 text-sm">
          <Row k="Plan price" v={formatPaise(amount)} />
          {discount > 0 && <Row k={`Coupon ${coupon?.code} (${coupon?.percent}%)`} v={`− ${formatPaise(discount)}`} tone="trust" />}
          <Row k="Taxable value" v={formatPaise(taxable)} />
          {billState ? (
            intra ? (
              <>
                <Row k="CGST 9%" v={formatPaise(cgst)} muted />
                <Row k="SGST 9%" v={formatPaise(gst - cgst)} muted />
              </>
            ) : (
              <Row k="IGST 18%" v={formatPaise(gst)} muted />
            )
          ) : (
            <Row k="GST 18%" v={formatPaise(gst)} muted />
          )}
          <div className="border-t border-line pt-3 mt-3 flex justify-between items-baseline">
            <dt className="font-medium">Total payable</dt>
            <dd className="num text-2xl font-semibold">{formatPaise(taxable + gst)}</dd>
          </div>
        </dl>
        <Button type="submit" variant="accent" size="lg" className="w-full mt-5" disabled={pending}>
          <Lock size={15} /> {pending ? "Creating order…" : `Pay ${formatPaise(taxable + gst)}`}
        </Button>
        <p className="text-xs text-muted mt-3">You&apos;ll get a GST tax invoice by email right after payment. Plans don&apos;t auto-renew.</p>
      </aside>
    </form>
  );
}

function Row({ k, v, muted, tone }: { k: string; v: string; muted?: boolean; tone?: "trust" }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={muted ? "text-muted" : "text-ink-2"}>{k}</dt>
      <dd className={`num ${tone === "trust" ? "text-trust" : ""}`}>{v}</dd>
    </div>
  );
}
