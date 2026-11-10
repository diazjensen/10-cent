"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Play, Trash2, Pencil } from "lucide-react";
import type { FormState } from "@/app/account/actions";
import { Button, Input, Select, btnClass, cx } from "@/components/ui";

const CH = [["email", "Email"], ["sms", "SMS"], ["whatsapp", "WhatsApp"], ["push", "Push"]] as const;
const FREQ: Record<string, string> = { instant: "Instantly", daily: "Daily digest", weekly: "Weekly digest" };

export function SavedSearchRow({ s, chips, matches, update, remove }: {
  s: { id: number; name: string; query: string; channels: string; frequency: string; created_at: string };
  chips: string[];
  matches: number;
  update: (prev: FormState, form: FormData) => Promise<FormState>;
  remove: (form: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const r = await update(prev, form);
    if (r.ok) setEditing(false);
    return r;
  }, {});
  const channels = s.channels.split(",").filter(Boolean);
  return (
    <li className="bg-card border border-line rounded-[var(--radius-md)] p-4 md:p-5">
      {!editing ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-medium text-[17px]">{s.name}</h2>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {chips.length ? chips.map((c) => <span key={c} className="text-xs bg-paper-2 text-ink-2 rounded-full px-2 py-0.5">{c}</span>) : <span className="text-xs text-muted">All listings</span>}
            </div>
            <p className="text-xs text-muted mt-2">
              {FREQ[s.frequency] ?? s.frequency} via {channels.map((c) => CH.find(([k]) => k === c)?.[1] ?? c).join(", ")} · <span className="num">{matches}</span> live match{matches === 1 ? "" : "es"}
            </p>
            {state.ok && <p className="text-xs text-trust mt-1">{state.message}</p>}
          </div>
          <div className="flex items-center gap-1.5">
            <Link href={`/search?${s.query}`} className={btnClass("primary", "sm")}><Play size={13} aria-hidden /> Run</Link>
            <button type="button" onClick={() => setEditing(true)} className={btnClass("secondary", "sm")} aria-label={`Edit ${s.name}`}><Pencil size={13} aria-hidden /> Edit</button>
            <form action={remove}>
              <input type="hidden" name="id" value={s.id} />
              <button className={btnClass("ghost", "sm", "hover:text-danger")} aria-label={`Delete ${s.name}`} onClick={(e) => { if (!confirm(`Delete "${s.name}"? You'll stop getting alerts for it.`)) e.preventDefault(); }}><Trash2 size={14} aria-hidden /></button>
            </form>
          </div>
        </div>
      ) : (
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={s.id} />
          <div>
            <label htmlFor={`ss-name-${s.id}`} className="block text-[13px] font-medium text-ink-2 mb-1">Name</label>
            <Input id={`ss-name-${s.id}`} name="name" defaultValue={s.name} maxLength={80} />
            {state.fieldErrors?.name && <p className="text-xs text-danger mt-1">{state.fieldErrors.name}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <fieldset>
              <legend className="text-[13px] font-medium text-ink-2 mb-1.5">Alert me by</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {CH.map(([k, label]) => (
                  <label key={k} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="channels" value={k} defaultChecked={channels.includes(k)} className="accent-[var(--color-accent)]" />{label}</label>
                ))}
              </div>
              {state.fieldErrors?.channels && <p className="text-xs text-danger mt-1">{state.fieldErrors.channels}</p>}
            </fieldset>
            <div>
              <label htmlFor={`ss-freq-${s.id}`} className="block text-[13px] font-medium text-ink-2 mb-1">How often</label>
              <Select id={`ss-freq-${s.id}`} name="frequency" defaultValue={s.frequency}>
                {Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </div>
          </div>
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
            <button type="button" className={cx(btnClass("ghost", "sm"))} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </li>
  );
}
