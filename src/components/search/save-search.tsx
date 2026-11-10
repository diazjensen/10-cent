"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellPlus, X } from "lucide-react";
import { saveSearch, type SaveSearchState } from "@/app/search/actions";
import { submitNoReset } from "@/lib/seeker/no-reset";
import { Button, Field, Input, Notice, btnClass, cx } from "@/components/ui";

const CHANNELS = [
  { v: "email", l: "Email" },
  { v: "sms", l: "SMS" },
  { v: "whatsapp", l: "WhatsApp" },
  { v: "push", l: "Push" },
];

/** Save search with alert channels and frequency (PRD S8). Logged-out users go to OTP login and come back with the dialog open. */
export function SaveSearch({ query, defaultName, signedIn, autoOpen, hasEmail }: { query: string; defaultName: string; signedIn: boolean; autoOpen: boolean; hasEmail: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen && signedIn);
  const [state, action, pending] = useActionState(saveSearch, {} as SaveSearchState);
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    // Drop the ?save=1 marker after returning from login so a refresh doesn't reopen the dialog.
    if (autoOpen) window.history.replaceState(null, "", `/search${query ? `?${query}` : ""}`);
  }, [autoOpen, query]);
  useEffect(() => {
    if (state.needLogin) router.push(`/login?next=${encodeURIComponent(`/search?${query}${query ? "&" : ""}save=1`)}`);
  }, [state.needLogin, router, query]);

  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const vals = v;
  const onClick = () => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/search?${query}${query ? "&" : ""}save=1`)}`);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button type="button" onClick={onClick} className={btnClass("secondary", "sm", "h-9")} disabled={!query} title={query ? undefined : "Add a filter to save this search"}>
        <BellPlus size={15} aria-hidden /> <span>Save search</span>
      </button>
      <dialog ref={dlg} onClose={() => setOpen(false)} aria-labelledby="save-title"
        className="m-auto w-[min(440px,calc(100vw-24px))] rounded-[var(--radius-lg)] border border-line bg-card p-0 shadow-[var(--shadow-pop)] backdrop:bg-ink/40">
        <div className="flex items-center justify-between px-5 h-14 border-b border-line">
          <h2 id="save-title" className="font-medium">Save this search</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-full hover:bg-paper-2"><X size={18} /></button>
        </div>
        {state.ok ? (
          <div className="p-5 space-y-4">
            <Notice tone="trust">{state.updated ? "Updated. " : "Saved. "}We&apos;ll alert you when new properties match.</Notice>
            <div className="flex gap-2">
              <Link href="/account/searches" className={btnClass("secondary", "md", "flex-1")}>Manage saved searches</Link>
              <Button type="button" className="flex-1" onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submitNoReset(action)} className="p-5 space-y-4">
            <input type="hidden" name="query" value={query} />
            <Field label="Name" error={fe.name}>
              <Input name="name" defaultValue={v.name ?? defaultName.slice(0, 80)} maxLength={80} required />
            </Field>
            <fieldset>
              <legend className="text-[13px] font-medium text-ink-2 mb-1.5">Alert me by</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {CHANNELS.map((c) => (
                  <label key={c.v} className="flex items-center gap-2 h-10 px-3 rounded-[var(--radius-sm)] border border-line-2 text-sm cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-paper-2">
                    <input type="checkbox" name="channels" value={c.v} defaultChecked={v.channels != null ? v.channels.split(",").includes(c.v) : c.v === (hasEmail ? "email" : "sms") || c.v === "push"} className="accent-[var(--color-ink)]" /> {c.l}
                  </label>
                ))}
              </div>
              {fe.channels && <p className="mt-1 text-xs text-danger">{fe.channels}</p>}
            </fieldset>
            <fieldset>
              <legend className="text-[13px] font-medium text-ink-2 mb-1.5">How often</legend>
              <div className="grid grid-cols-3 gap-1 p-1 bg-paper-2 rounded-[var(--radius-sm)]">
                {[["instant", "Instantly"], ["daily", "Daily"], ["weekly", "Weekly"]].map(([v, l]) => (
                  <label key={v} className={cx("h-8 grid place-items-center rounded-[var(--radius-xs)] text-[13px] cursor-pointer has-[:checked]:bg-card has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent")}>
                    <input type="radio" name="frequency" value={v} defaultChecked={(vals.frequency ?? "daily") === v} className="sr-only" /> {l}
                  </label>
                ))}
              </div>
              {fe.frequency && <p className="mt-1 text-xs text-danger">{fe.frequency}</p>}
            </fieldset>
            {state.error && <Notice tone="danger">{state.error}</Notice>}
            <Button type="submit" className="w-full" disabled={pending}>{pending ? "Saving…" : "Save search"}</Button>
          </form>
        )}
      </dialog>
    </>
  );
}
