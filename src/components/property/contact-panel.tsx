"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, MessageSquare, Phone, PhoneCall, Check, Lock } from "lucide-react";
import { revealPhone, submitLead, type LeadState } from "@/app/property/actions";
import { Button, Input, Textarea, Field, Notice, cx, btnClass } from "@/components/ui";
import { maskPhone } from "@/lib/format";
import { submitNoReset } from "@/lib/seeker/no-reset";

type Mode = "contact" | "phone" | "visit" | "callback";
type Me = { name: string | null; phone: string | null; email: string | null } | null;

const SLOTS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const slotLabel = (s: string) => {
  const h = Number(s.slice(0, 2));
  return `${h > 12 ? h - 12 : h}${h >= 12 ? " pm" : " am"}`;
};

function istDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Contact owner/agent, get phone, schedule visit and request callback (PRD D5, §4.4). */
export function ContactPanel({ listingId, posterLabel, posterFirstName, me, own, initialMode, live }: {
  listingId: number; posterLabel: string; posterFirstName: string; me: Me; own: boolean; initialMode?: Mode | null; live: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(me && initialMode ? initialMode : null);
  const choose = (m: Mode) => {
    if (!me) {
      router.push(`/login?next=${encodeURIComponent(`/property/${listingId}?act=${m}#contact`)}`);
      return;
    }
    setMode((cur) => (cur === m ? null : m));
  };

  if (own)
    return (
      <div className="p-4 text-sm">
        <p className="font-medium">This is your listing.</p>
        <p className="text-muted mt-1">Enquiries from seekers appear in your responses inbox.</p>
        <Link href="/dashboard/responses" className={btnClass("secondary", "sm", "mt-3")}>Open responses</Link>
      </div>
    );
  if (!live) return <div className="p-4 text-sm text-muted">Contact options are available once the listing is live.</div>;

  const actions: Array<{ m: Mode; label: string; icon: typeof Phone }> = [
    { m: "phone", label: "Get phone number", icon: Phone },
    { m: "visit", label: "Schedule visit", icon: CalendarClock },
    { m: "callback", label: "Request callback", icon: PhoneCall },
  ];

  return (
    <div className="p-4">
      <button type="button" onClick={() => choose("contact")} aria-expanded={mode === "contact"} className={btnClass("accent", "lg", "w-full")}>
        <MessageSquare size={17} aria-hidden /> Contact {posterLabel}
      </button>
      <div className="grid grid-cols-3 gap-1.5 mt-2">
        {actions.map((a) => (
          <button key={a.m} type="button" onClick={() => choose(a.m)} aria-expanded={mode === a.m}
            className={cx("flex flex-col items-center justify-center gap-1 h-[62px] px-1 rounded-[var(--radius-sm)] border text-[12px] leading-tight text-center font-medium",
              mode === a.m ? "border-ink bg-paper-2 text-ink" : "border-line-2 bg-card text-ink-2 hover:border-ink hover:text-ink")}>
            <a.icon size={16} aria-hidden /> {a.label}
          </button>
        ))}
      </div>
      {!me && (
        <p className="mt-3 text-xs text-muted flex gap-1.5"><Lock size={13} className="shrink-0 mt-0.5" aria-hidden /> Log in with OTP to contact. Numbers are shared only with verified users to keep spam out.</p>
      )}
      {me && mode === "phone" && <PhoneReveal listingId={listingId} me={me} posterFirstName={posterFirstName} />}
      {me && mode && mode !== "phone" && <LeadForm key={mode} mode={mode} listingId={listingId} me={me} posterFirstName={posterFirstName} />}
    </div>
  );
}

function Consent({ me, name = "consent", defaultChecked = false, onChange, checked }: { me: NonNullable<Me>; name?: string; defaultChecked?: boolean; onChange?: (v: boolean) => void; checked?: boolean }) {
  return (
    <label className="flex gap-2 items-start text-xs text-ink-2 leading-relaxed">
      <input type="checkbox" name={name} defaultChecked={onChange ? undefined : defaultChecked} checked={onChange ? checked : undefined} onChange={onChange ? (e) => onChange(e.target.checked) : undefined} className="mt-0.5 accent-[var(--color-accent)] w-4 h-4 shrink-0" />
      <span>I agree to share my name{me.phone ? ` and number (${maskPhone(me.phone)})` : " and contact details"} with the poster, and to be contacted about this property. 10cent never asks for advance payments.</span>
    </label>
  );
}

function PhoneReveal({ listingId, me, posterFirstName }: { listingId: number; me: NonNullable<Me>; posterFirstName: string }) {
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<LeadState>({});
  const [pending, start] = useTransition();
  if (state.phone)
    return (
      <div className="mt-4 rounded-[var(--radius-sm)] bg-trust-soft border border-trust/20 p-3.5" role="status">
        <div className="text-xs text-trust">{posterFirstName}&apos;s number</div>
        <a href={`tel:${state.phone.replace(/\s/g, "")}`} className="num block text-xl font-semibold text-ink mt-0.5 tracking-tight">{state.phone}</a>
        <p className="text-xs text-ink-2 mt-1.5">Mention you found this on 10cent. Never pay a token amount before visiting.</p>
      </div>
    );
  return (
    <div className="mt-4 space-y-3">
      <Consent me={me} checked={consent} onChange={setConsent} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Button type="button" className="w-full" disabled={!consent || pending} onClick={() => start(async () => setState(await revealPhone(listingId, consent)))}>
        <Phone size={15} aria-hidden /> {pending ? "Getting number…" : "Show phone number"}
      </Button>
    </div>
  );
}

function LeadForm({ mode, listingId, me, posterFirstName }: { mode: Exclude<Mode, "phone">; listingId: number; me: NonNullable<Me>; posterFirstName: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(submitLead, {} as LeadState);
  const [slot, setSlot] = useState("");
  const minDate = istDate(0), maxDate = istDate(30);
  const [date, setDate] = useState(istDate(1));
  useEffect(() => {
    if (state.needLogin) router.push(`/login?next=${encodeURIComponent(`/property/${listingId}?act=${mode}`)}`);
  }, [state.needLogin, router, listingId, mode]);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const nowHourIst = Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }));

  if (state.ok)
    return (
      <div className="mt-4 rounded-[var(--radius-sm)] bg-trust-soft border border-trust/20 p-3.5 text-sm" role="status">
        <p className="flex gap-2 text-trust font-medium"><Check size={17} className="shrink-0" aria-hidden /> {state.message}</p>
        {state.phone && (
          <p className="mt-2 text-ink-2">{posterFirstName}&apos;s number: <a className="num font-semibold text-ink" href={`tel:${state.phone.replace(/\s/g, "")}`}>{state.phone}</a></p>
        )}
        <Link href="/account/contacted" className="inline-block mt-2 text-xs underline underline-offset-2 text-ink-2">See all properties you contacted</Link>
      </div>
    );

  return (
    <form onSubmit={submitNoReset(action)} className="mt-4 space-y-3" noValidate>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="channel" value={mode} />
      {mode === "visit" && (
        <>
          <Field label="Visit date" error={fe.date}>
            <Input type="date" name="date" required min={minDate} max={maxDate} value={date} onChange={(e) => { setDate(e.target.value); setSlot(""); }} />
          </Field>
          <fieldset>
            <legend className="block text-[13px] font-medium text-ink-2 mb-1.5">Time</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {SLOTS.map((s) => {
                const past = date === minDate && Number(s.slice(0, 2)) <= nowHourIst;
                return (
                  <label key={s} className={cx("h-9 grid place-items-center rounded-[var(--radius-sm)] border text-[13px] num cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                    past ? "opacity-40 cursor-not-allowed border-line" : slot === s ? "border-ink bg-ink text-white" : "border-line-2 hover:border-ink")}>
                    <input type="radio" name="slot" value={s} disabled={past} checked={slot === s} onChange={() => setSlot(s)} className="sr-only" />
                    {slotLabel(s)}
                  </label>
                );
              })}
            </div>
            {fe.slot && <p className="mt-1 text-xs text-danger">{fe.slot}</p>}
          </fieldset>
        </>
      )}
      {mode === "callback" && (
        <Field label="Best time to call">
          <select name="when" defaultValue={v.when ?? "asap"} className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-line-2 bg-card text-sm">
            <option value="asap">As soon as possible</option>
            <option value="morning">Morning (9am – 12pm)</option>
            <option value="afternoon">Afternoon (12 – 4pm)</option>
            <option value="evening">Evening (4 – 8pm)</option>
          </select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name" error={fe.name}><Input name="name" defaultValue={v.name ?? me.name ?? ""} autoComplete="name" required /></Field>
        <Field label="Mobile" error={fe.phone}><Input name="phone" defaultValue={v.phone ?? me.phone ?? ""} inputMode="numeric" autoComplete="tel" required /></Field>
      </div>
      <Field label="Email" hint="(optional)" error={fe.email}><Input name="email" type="email" defaultValue={v.email ?? me.email ?? ""} autoComplete="email" /></Field>
      <Field label={mode === "contact" ? "Message" : "Note"} hint={mode === "contact" ? undefined : "(optional)"} error={fe.message}>
        <Textarea name="message" rows={3} className="min-h-20" defaultValue={v.message ?? (mode === "contact" ? `Hi ${posterFirstName}, I'm interested in this property. Is it still available?` : "")} />
      </Field>
      <Consent me={me} defaultChecked={v.consent === "on"} />
      {fe.consent && <p className="text-xs text-danger -mt-1">{fe.consent}</p>}
      {state.error && !Object.keys(fe).length && <Notice tone="danger">{state.error}</Notice>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : mode === "contact" ? "Send message" : mode === "visit" ? "Request visit" : "Request callback"}
      </Button>
    </form>
  );
}
