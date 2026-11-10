"use client";

import { useActionState, useState } from "react";
import type { ServiceState } from "@/app/services/actions";
import { Button, Input, Notice, Select, Textarea, cx } from "@/components/ui";

type Act = (s: ServiceState, f: FormData) => Promise<ServiceState>;
type Me = { name: string; phone: string; email: string; city: string } | null;

function F({ id, label, error, children, hint }: { id: string; label: string; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink-2 mb-1.5">{label}{hint && <span className="font-normal text-muted"> {hint}</span>}</label>
      {children}
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}

function ContactFields({ me, fe, prefix }: { me: Me; fe: Record<string, string>; prefix: string }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <F id={`${prefix}-name`} label="Name" error={fe.name}><Input id={`${prefix}-name`} name="name" defaultValue={me?.name} autoComplete="name" /></F>
        <F id={`${prefix}-phone`} label="Mobile" error={fe.phone}><Input id={`${prefix}-phone`} name="phone" defaultValue={me?.phone} inputMode="tel" autoComplete="tel" /></F>
        <F id={`${prefix}-email`} label="Email" hint="(optional)" error={fe.email}><Input id={`${prefix}-email`} name="email" type="email" defaultValue={me?.email} autoComplete="email" /></F>
        <F id={`${prefix}-city`} label="City" error={fe.city}><Input id={`${prefix}-city`} name="city" defaultValue={me?.city} autoComplete="address-level2" /></F>
      </div>
    </>
  );
}

function Consent({ fe, text }: { fe: Record<string, string>; text: string }) {
  return (
    <div>
      <label className="flex gap-2 text-xs text-ink-2 leading-snug"><input type="checkbox" name="consent" defaultChecked className="mt-0.5 accent-[var(--color-accent)]" />{text}</label>
      {fe.consent && <p className="text-xs text-danger mt-1">{fe.consent}</p>}
    </div>
  );
}

export function HomeLoanForm({ me, action, banks }: { me: Me; action: Act; banks: string[] }) {
  const [state, formAction, pending] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};
  if (state.ok) return <Notice tone="trust">{state.message}</Notice>;
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <ContactFields me={me} fe={fe} prefix="hl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <F id="hl-amount" label="Loan needed" error={fe.amount}><Input id="hl-amount" name="amount" placeholder="e.g. 75L" /></F>
        <F id="hl-income" label="Net monthly income" error={fe.income}><Input id="hl-income" name="income" placeholder="e.g. 1.2L or 120000" /></F>
        <F id="hl-emp" label="Employment" error={fe.employment}>
          <Select id="hl-emp" name="employment" defaultValue="salaried"><option value="salaried">Salaried</option><option value="self_employed">Self-employed / business</option><option value="nri">NRI</option></Select>
        </F>
        <F id="hl-prop" label="Where are you?" error={fe.property}>
          <Select id="hl-prop" name="property" defaultValue="identified"><option value="identified">Property identified</option><option value="searching">Still searching</option><option value="construction">Building on my plot</option><option value="balance_transfer">Transfer existing loan</option></Select>
        </F>
      </div>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2 mb-1.5">Preferred lenders <span className="font-normal text-muted">(optional)</span></legend>
        <div className="flex flex-wrap gap-1.5">
          {banks.map((b) => (
            <label key={b} className="cursor-pointer">
              <input type="checkbox" name="banks" value={b} className="peer sr-only" />
              <span className="inline-flex h-8 px-3 items-center rounded-full border text-[13px] border-line bg-paper text-ink-2 peer-checked:bg-ink peer-checked:text-white peer-checked:border-ink peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{b}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Consent fe={fe} text="I agree to be contacted by 10cent and its partner lenders about a home loan. This won't affect my credit score." />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Button type="submit" variant="accent" className="w-full sm:w-auto" disabled={pending}>{pending ? "Submitting…" : "Get a call back"}</Button>
    </form>
  );
}

export function InterestForm({ me, action, services, initial }: { me: Me; action: Act; services: Array<{ slug: string; title: string }>; initial?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [svc, setSvc] = useState(initial ?? services[0]?.slug);
  const fe = state.fieldErrors ?? {};
  if (state.ok) return <Notice tone="trust">{state.message}</Notice>;
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2 mb-1.5">I need</legend>
        <div className="flex flex-wrap gap-1.5">
          {services.map((s) => (
            <label key={s.slug} className="cursor-pointer">
              <input type="radio" name="service" value={s.slug} checked={svc === s.slug} onChange={() => setSvc(s.slug)} className="peer sr-only" />
              <span className={cx("inline-flex h-8 px-3 items-center rounded-full border text-[13px] peer-focus-visible:outline-2 peer-focus-visible:outline-accent", svc === s.slug ? "bg-ink text-white border-ink" : "border-line bg-paper text-ink-2")}>{s.title}</span>
            </label>
          ))}
        </div>
        {fe.service && <p className="text-xs text-danger mt-1">{fe.service}</p>}
      </fieldset>
      <ContactFields me={me} fe={fe} prefix="si" />
      <F id="si-notes" label="Details" hint="(optional)" error={fe.notes}><Textarea id="si-notes" name="notes" rows={3} maxLength={600} placeholder="e.g. 2 BHK from Whitefield to HSR Layout, mid-December" /></F>
      <Consent fe={fe} text="I agree to be contacted by 10cent and its service partners about this request." />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Register interest"}</Button>
    </form>
  );
}
