"use client";

import { useActionState } from "react";
import { saveProfileAction, savePrefsAction, type FormState } from "@/app/dashboard/actions";
import { Button, Input, Notice, Select, Textarea } from "@/components/ui";
import { Field } from "./field";

type P = {
  name: string; email: string; company_name: string; rera_number: string; experience_years: string; established_year: string;
  about: string; website: string; gstin: string; city_id: string;
};

export function ProfileForm({ initial, role, cities, readOnly }: { initial: P; role: string; cities: Array<{ id: number; name: string }>; readOnly?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfileAction, null);
  const e = state?.errors ?? {};
  const v = { ...initial, ...(state?.values ?? {}) } as P;
  const biz = role === "agent" || role === "builder";
  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.message && <Notice tone={state.ok ? "trust" : "danger"}>{state.message}</Notice>}
      <fieldset disabled={readOnly} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Your name" error={e.name}><Input name="name" defaultValue={v.name} required autoComplete="name" /></Field>
          <Field label="Email" error={e.email} hint="for invoices and lead alerts"><Input name="email" type="email" defaultValue={v.email} autoComplete="email" /></Field>
        </div>
        {biz && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={role === "agent" ? "Agency name" : "Company name"} error={e.company_name}><Input name="company_name" defaultValue={v.company_name} autoComplete="organization" /></Field>
              <Field label="RERA registration number" error={e.rera_number} hint={role === "agent" ? "required for agents" : "company / promoter"}><Input name="rera_number" defaultValue={v.rera_number} /></Field>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Years of experience" error={e.experience_years}><Input name="experience_years" inputMode="numeric" defaultValue={v.experience_years} /></Field>
              <Field label="Established (year)" error={e.established_year}><Input name="established_year" inputMode="numeric" defaultValue={v.established_year} /></Field>
              <Field label="Main city" error={e.city_id} className="col-span-2 sm:col-span-1">
                <Select name="city_id" defaultValue={v.city_id}>
                  <option value="">Select</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="About" error={e.about} hint="shown on your public profile"><Textarea name="about" rows={5} defaultValue={v.about} maxLength={1500} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Website" error={e.website}><Input name="website" type="url" placeholder="https://" defaultValue={v.website} /></Field>
              <Field label="GSTIN" error={e.gstin} hint="printed on your invoices"><Input name="gstin" defaultValue={v.gstin} maxLength={15} className="uppercase" /></Field>
            </div>
          </>
        )}
        {!biz && (
          <Field label="GSTIN" error={e.gstin} hint="optional, for invoices"><Input name="gstin" defaultValue={v.gstin} maxLength={15} className="uppercase max-w-xs" /></Field>
        )}
      </fieldset>
      {!readOnly && <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>}
    </form>
  );
}

export function PrefsForm({ initial, contact }: { initial: { email: number; sms: number; whatsapp: number; push: number }; contact: { phone: string | null; email: string | null } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePrefsAction, null);
  const rows: Array<[keyof typeof initial, string, string]> = [
    ["sms", "SMS", contact.phone ? `to +91 ${contact.phone}` : "add a phone number to receive SMS"],
    ["email", "Email", contact.email ?? "add an email in your profile"],
    ["whatsapp", "WhatsApp", contact.phone ? `to +91 ${contact.phone}` : "needs a phone number"],
    ["push", "Push and in-app", "bell icon on the site and app notifications"],
  ];
  return (
    <form action={action} className="space-y-4">
      {state?.message && <Notice tone={state.ok ? "trust" : "danger"}>{state.message}</Notice>}
      <ul className="divide-y divide-line border border-line rounded-[var(--radius-md)] bg-card">
        {rows.map(([k, label, sub]) => (
          <li key={k}>
            <label className="flex items-center justify-between gap-4 px-4 py-3.5 cursor-pointer">
              <span><span className="font-medium text-sm">{label}</span><span className="block text-xs text-muted">{sub}</span></span>
              <input type="checkbox" name={k} defaultChecked={!!initial[k]} className="w-5 h-5 accent-[var(--color-ink)]" />
            </label>
          </li>
        ))}
      </ul>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save preferences"}</Button>
    </form>
  );
}
