"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { reportFraud, type FraudState } from "@/app/report/actions";
import { REPORT_REASONS } from "@/lib/constants";
import { submitNoReset } from "@/lib/seeker/no-reset";
import { Button, Field, Input, Notice, Select, Textarea, cx } from "@/components/ui";

/** General fraud report form for /report. */
export function FraudForm({ initialListing, signedIn }: { initialListing?: string; signedIn: boolean }) {
  const [state, action, pending] = useActionState(reportFraud, {} as FraudState);
  const [target, setTarget] = useState<"listing" | "phone">("listing");
  const [reason, setReason] = useState("");
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  if (state.ok)
    return (
      <div className="space-y-4" role="status">
        <Notice tone="trust">Report received (reference #{state.ref}). Our trust and safety team reviews every report within 24 hours. Repeat offenders are blocked from 10cent.</Notice>
        <p className="text-sm text-ink-2">If you&apos;ve already paid someone, also file a complaint at <a className="underline underline-offset-2" href="https://cybercrime.gov.in" target="_blank" rel="noopener noreferrer">cybercrime.gov.in</a> or call 1930.</p>
        <Link href="/search" className="text-sm underline underline-offset-2">Back to search</Link>
      </div>
    );
  return (
    <form onSubmit={submitNoReset(action)} className="space-y-5" noValidate>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2 mb-1.5">What are you reporting?</legend>
        <div className="grid grid-cols-2 gap-1 p-1 bg-paper-2 rounded-[var(--radius-sm)]">
          {([["listing", "A listing"], ["phone", "A phone number or person"]] as const).map(([v, l]) => (
            <label key={v} className={cx("h-9 grid place-items-center rounded-[var(--radius-xs)] text-[13px] cursor-pointer text-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent", target === v ? "bg-card shadow-sm font-medium" : "text-ink-2")}>
              <input type="radio" name="target" value={v} checked={target === v} onChange={() => setTarget(v)} className="sr-only" /> {l}
            </label>
          ))}
        </div>
      </fieldset>
      {target === "listing" ? (
        <Field label="Listing link or ID" error={fe.listing}>
          <Input name="listing" defaultValue={v.listing ?? initialListing} placeholder="https://10cent.in/property/1234 or 1234" />
        </Field>
      ) : (
        <Field label="Mobile number" hint="(the number that called or messaged you)" error={fe.phone}>
          <Input name="phone" defaultValue={v.phone} inputMode="numeric" placeholder="98XXXXXXXX" />
        </Field>
      )}
      <Field label="Reason" error={fe.reason}>
        <Select name="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="" disabled>Choose a reason</option>
          {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </Select>
      </Field>
      <Field label="What happened?" error={fe.details}>
        <Textarea name="details" defaultValue={v.details} rows={5} maxLength={2000} placeholder="E.g. the agent asked for ₹10,000 as a 'booking token' on UPI before showing the flat, then stopped answering." />
      </Field>
      {!signedIn && (
        <Field label="Your mobile or email" hint="(optional, so we can follow up)" error={fe.contact}>
          <Input name="contact" defaultValue={v.contact} placeholder="Mobile number or email" />
        </Field>
      )}
      {state.error && !Object.keys(fe).length && <Notice tone="danger">{state.error}</Notice>}
      <Button type="submit" variant="danger" size="lg" className="w-full sm:w-auto" disabled={pending}>{pending ? "Sending…" : "Submit report"}</Button>
    </form>
  );
}
