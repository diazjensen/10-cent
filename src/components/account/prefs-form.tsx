"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/account/actions";
import { Button } from "@/components/ui";

const ITEMS = [
  { key: "email", label: "Email", hint: "Alerts, enquiry replies and receipts" },
  { key: "sms", label: "SMS", hint: "Visit confirmations and important account messages" },
  { key: "whatsapp", label: "WhatsApp", hint: "New matches for saved searches" },
  { key: "push", label: "Push", hint: "Browser and app notifications" },
] as const;

export function PrefsForm({ prefs, action, hasEmail, hasPhone }: { prefs: Record<string, number>; action: (p: FormState, f: FormData) => Promise<FormState>; hasEmail: boolean; hasPhone: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="bg-card border border-line rounded-[var(--radius-md)] divide-y divide-line">
      {ITEMS.map((i) => {
        const missing = (i.key === "email" && !hasEmail) || ((i.key === "sms" || i.key === "whatsapp") && !hasPhone);
        return (
          <label key={i.key} className="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer">
            <span>
              <span className="block text-sm font-medium">{i.label}</span>
              <span className="block text-xs text-muted">{i.hint}{missing ? ` · add ${i.key === "email" ? "an email" : "a phone number"} in your profile to receive these` : ""}</span>
            </span>
            <input type="checkbox" name={i.key} defaultChecked={!!prefs[i.key]} className="peer sr-only" />
            <span aria-hidden className="relative w-10 h-6 rounded-full bg-line-2 peer-checked:bg-trust transition-colors after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-accent shrink-0" />
          </label>
        );
      })}
      <div className="px-4 py-3 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save preferences"}</Button>
        {state.ok && <span role="status" className="text-sm text-trust">{state.message}</span>}
      </div>
    </form>
  );
}
