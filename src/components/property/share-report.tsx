"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Flag, Link2, X } from "lucide-react";
import { reportListing, type ReportState } from "@/app/property/actions";
import { REPORT_REASONS } from "@/lib/constants";
import { submitNoReset } from "@/lib/seeker/no-reset";
import { Button, Field, Notice, Textarea, btnClass, cx } from "@/components/ui";

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.24 8.24 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
    </svg>
  );
}

/** Share by WhatsApp or link (PRD D8). */
export function ShareButtons({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex gap-1.5">
      <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" className={btnClass("secondary", "sm")} aria-label="Share on WhatsApp">
        <WhatsAppIcon /> <span className="hidden sm:inline">WhatsApp</span>
      </a>
      <button type="button" onClick={copy} className={btnClass("secondary", "sm")} aria-live="polite">
        {copied ? <Check size={15} aria-hidden /> : <Link2 size={15} aria-hidden />} {copied ? "Copied" : <span className="hidden sm:inline">Copy link</span>}
        {!copied && <span className="sm:hidden">Link</span>}
      </button>
    </div>
  );
}

/** Report listing dialog (PRD D8, §4.4). Works signed in or not. */
export function ReportListing({ listingId }: { listingId: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reportListing, {} as ReportState);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-danger underline-offset-2 hover:underline">
        <Flag size={13} aria-hidden /> Report this listing
      </button>
      <dialog ref={dlg} onClose={() => setOpen(false)} aria-labelledby="report-title"
        className="m-auto w-[min(460px,calc(100vw-24px))] rounded-[var(--radius-lg)] border border-line bg-card p-0 shadow-[var(--shadow-pop)] backdrop:bg-ink/40">
        <div className="flex items-center justify-between px-5 h-14 border-b border-line">
          <h2 id="report-title" className="font-medium">Report this listing</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-full hover:bg-paper-2"><X size={18} /></button>
        </div>
        {state.ok ? (
          <div className="p-5">
            <Notice tone="trust">Thanks. Our trust team reviews every report within 24 hours and takes down listings that break our posting policy.</Notice>
            <Button type="button" variant="secondary" className="mt-4 w-full" onClick={() => setOpen(false)}>Close</Button>
          </div>
        ) : (
          <form onSubmit={submitNoReset(action)} className="p-5 space-y-4">
            <input type="hidden" name="listingId" value={listingId} />
            <fieldset>
              <legend className="text-[13px] font-medium text-ink-2 mb-2">What&apos;s wrong?</legend>
              <div className="space-y-1">
                {REPORT_REASONS.map((r) => (
                  <label key={r.value} className="flex items-center gap-2.5 text-sm px-2.5 py-2 rounded-[var(--radius-sm)] hover:bg-paper-2 cursor-pointer has-[:checked]:bg-paper-2">
                    <input type="radio" name="reason" value={r.value} defaultChecked={v.reason === r.value} className="accent-[var(--color-accent)]" required /> {r.label}
                  </label>
                ))}
              </div>
              {fe.reason && <p className="mt-1 text-xs text-danger">{fe.reason}</p>}
            </fieldset>
            <Field label="Details" hint="(helps us act faster)" error={fe.details}>
              <Textarea name="details" defaultValue={v.details} rows={3} maxLength={1500} placeholder="E.g. the owner asked for a token amount before a visit" />
            </Field>
            {state.error && <Notice tone="danger">{state.error}</Notice>}
            <Button type="submit" variant="danger" className={cx("w-full")} disabled={pending}>{pending ? "Sending…" : "Submit report"}</Button>
          </form>
        )}
      </dialog>
    </>
  );
}
