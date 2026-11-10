"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/account/actions";
import { Button, Input, Notice, cx } from "@/components/ui";

type P = { name: string; email: string; phone: string; is_nri: boolean; cities: string[]; budget_min: string; budget_max: string; role: string };

export function ProfileForm({ p, allCities, action, welcome, next }: { p: P; allCities: Array<{ slug: string; name: string }>; action: (s: FormState, f: FormData) => Promise<FormState>; welcome: boolean; next: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};
  const canSwitch = p.role === "seeker" || p.role === "owner";
  return (
    <form action={formAction} className="bg-card border border-line rounded-[var(--radius-md)] p-5 md:p-6 space-y-5">
      {welcome && <><input type="hidden" name="welcome" value="1" /><input type="hidden" name="next" value={next} /></>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pf-name" className="block text-[13px] font-medium text-ink-2 mb-1.5">Full name</label>
          <Input id="pf-name" name="name" defaultValue={p.name} autoComplete="name" required aria-invalid={!!fe.name || undefined} />
          {fe.name && <p className="text-xs text-danger mt-1">{fe.name}</p>}
        </div>
        <div>
          <label htmlFor="pf-email" className="block text-[13px] font-medium text-ink-2 mb-1.5">Email</label>
          <Input id="pf-email" name="email" type="email" defaultValue={p.email} autoComplete="email" aria-invalid={!!fe.email || undefined} />
          {fe.email && <p className="text-xs text-danger mt-1">{fe.email}</p>}
        </div>
        <div>
          <span className="block text-[13px] font-medium text-ink-2 mb-1.5">Mobile</span>
          <div className="h-10 px-3 flex items-center rounded-[var(--radius-sm)] bg-paper-2 text-sm text-ink-2 num">{p.phone || "Not added"}</div>
          <p className="text-xs text-muted mt-1">Your login number. Contact support to change it.</p>
        </div>
        <label className="flex items-start gap-2.5 text-sm sm:pt-7">
          <input type="checkbox" name="is_nri" defaultChecked={p.is_nri} className="mt-0.5 accent-[var(--color-accent)]" />
          <span><span className="font-medium">I&apos;m a Non-Resident Indian (NRI)</span><span className="block text-xs text-muted">We&apos;ll show NRI-friendly listings and repatriation notes</span></span>
        </label>
      </div>

      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2 mb-2">Cities you&apos;re looking in</legend>
        <div className="flex flex-wrap gap-2">
          {allCities.map((c) => (
            <label key={c.slug} className="cursor-pointer">
              <input type="checkbox" name="cities" value={c.slug} defaultChecked={p.cities.includes(c.slug)} className="peer sr-only" />
              <span className="inline-flex h-8 px-3 items-center rounded-full border text-[13px] border-line bg-paper text-ink-2 peer-checked:bg-ink peer-checked:text-white peer-checked:border-ink peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pf-bmin" className="block text-[13px] font-medium text-ink-2 mb-1.5">Budget from</label>
          <Input id="pf-bmin" name="budget_min" defaultValue={p.budget_min} placeholder="e.g. 50L" aria-invalid={!!fe.budget_min || undefined} />
          {fe.budget_min && <p className="text-xs text-danger mt-1">{fe.budget_min}</p>}
        </div>
        <div>
          <label htmlFor="pf-bmax" className="block text-[13px] font-medium text-ink-2 mb-1.5">Budget up to</label>
          <Input id="pf-bmax" name="budget_max" defaultValue={p.budget_max} placeholder="e.g. 1.2Cr or 45000 for rent" aria-invalid={!!fe.budget_max || undefined} />
          {fe.budget_max && <p className="text-xs text-danger mt-1">{fe.budget_max}</p>}
        </div>
      </div>

      {canSwitch && (
        <fieldset>
          <legend className="text-[13px] font-medium text-ink-2 mb-2">I mainly use 10cent to</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[["seeker", "Find a home", "Buy or rent; shortlist and contact owners"], ["owner", "List my property", "Post up to 3 listings free and manage responses"]].map(([v, t, d]) => (
              <label key={v} className="cursor-pointer">
                <input type="radio" name="role" value={v} defaultChecked={p.role === v} className="peer sr-only" />
                <span className={cx("block border rounded-[var(--radius-sm)] p-3 border-line peer-checked:border-ink peer-checked:bg-paper peer-focus-visible:outline-2 peer-focus-visible:outline-accent")}>
                  <span className="block text-sm font-medium">{t}</span><span className="block text-xs text-muted">{d}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="trust">{state.message}</Notice>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : welcome ? "Save and continue" : "Save profile"}</Button>
    </form>
  );
}

export function DeleteAccountForm({ action }: { action: (s: FormState, f: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="del-confirm" className="block text-sm text-ink-2">Type <b className="font-mono text-[13px] text-danger">DELETE MY ACCOUNT</b> to confirm</label>
      <Input id="del-confirm" name="confirm" autoComplete="off" className="max-w-sm" aria-invalid={!!state.fieldErrors?.confirm || undefined} />
      {state.fieldErrors?.confirm && <p className="text-xs text-danger">{state.fieldErrors.confirm}</p>}
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Button type="submit" variant="danger" disabled={pending}>{pending ? "Deleting…" : "Delete my account permanently"}</Button>
    </form>
  );
}
