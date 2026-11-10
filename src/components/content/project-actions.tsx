"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CalendarCheck, FileDown, MessageSquareText } from "lucide-react";
import type { LeadState } from "@/app/projects/actions";
import { Button, Input, Notice, Select, Textarea, cx, btnClass } from "@/components/ui";

type Act = (prev: LeadState, form: FormData) => Promise<LeadState>;
type Me = { name: string; phone: string; email: string } | null;

const TABS = [
  { key: "enquiry", label: "Enquire", icon: MessageSquareText },
  { key: "brochure", label: "Brochure", icon: FileDown },
  { key: "visit", label: "Site visit", icon: CalendarCheck },
] as const;

function Err({ m }: { m?: string }) {
  return m ? <p className="text-xs text-danger mt-1">{m}</p> : null;
}

function Contact({ me, fe }: { me: Me; fe?: Record<string, string> }) {
  return (
    <>
      <div>
        <label htmlFor="pl-name" className="block text-[13px] font-medium text-ink-2 mb-1">Name</label>
        <Input id="pl-name" name="name" defaultValue={me?.name} autoComplete="name" required />
        <Err m={fe?.name} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="pl-phone" className="block text-[13px] font-medium text-ink-2 mb-1">Mobile</label>
          <Input id="pl-phone" name="phone" defaultValue={me?.phone} inputMode="tel" autoComplete="tel" required />
          <Err m={fe?.phone} />
        </div>
        <div>
          <label htmlFor="pl-email" className="block text-[13px] font-medium text-ink-2 mb-1">Email <span className="font-normal text-muted">(optional)</span></label>
          <Input id="pl-email" name="email" type="email" defaultValue={me?.email} autoComplete="email" />
          <Err m={fe?.email} />
        </div>
      </div>
    </>
  );
}

function Consent({ builder, fe }: { builder: string; fe?: Record<string, string> }) {
  return (
    <div>
      <label className="flex gap-2 text-xs text-ink-2 leading-snug">
        <input type="checkbox" name="consent" defaultChecked className="mt-0.5 accent-[var(--color-accent)]" />
        I agree to share my contact details with {builder} and to be contacted by phone, SMS or WhatsApp about this project.
      </label>
      <Err m={fe?.consent} />
    </div>
  );
}

export function ProjectActions({ me, loginHref, builder, projectName, enquiry, brochure, visit, initialTab = "enquiry" }: {
  me: Me; loginHref: string; builder: string; projectName: string; enquiry: Act; brochure: Act; visit: Act; initialTab?: "enquiry" | "brochure" | "visit";
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>(initialTab);
  const [eState, eAction, ePending] = useActionState(enquiry, {});
  const [bState, bAction, bPending] = useActionState(brochure, {});
  const [vState, vAction, vPending] = useActionState(visit, {});
  const [{ tomorrow, maxDate }] = useState(() => {
    const now = Date.now();
    return { tomorrow: new Date(now + 86400_000).toISOString().slice(0, 10), maxDate: new Date(now + 59 * 86400_000).toISOString().slice(0, 10) };
  });

  return (
    <div id="enquire" className="bg-card border border-line rounded-[var(--radius-md)] overflow-hidden scroll-mt-24">
      <div role="tablist" aria-label="Contact the builder" className="grid grid-cols-3 border-b border-line">
        {TABS.map((t) => (
          <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cx("h-12 flex items-center justify-center gap-1.5 text-[13px] font-medium border-b-2 -mb-px", tab === t.key ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink")}>
            <t.icon size={15} aria-hidden /> {t.label}
          </button>
        ))}
      </div>
      <div className="p-4 md:p-5">
        {!me ? (
          <div className="space-y-3 text-sm">
            <p className="text-ink-2">
              {tab === "enquiry" ? `Ask ${builder} about prices, offers and availability.` : tab === "brochure" ? `Get the full ${projectName} brochure with floor plans and specifications.` : "Book a guided site visit at a time that suits you."}
            </p>
            <Link href={loginHref} className={btnClass("accent", "md", "w-full")}>Log in to continue</Link>
            <p className="text-xs text-muted">We ask you to log in with your mobile number so builders only receive genuine enquiries. It takes 30 seconds.</p>
          </div>
        ) : tab === "enquiry" ? (
          eState.ok ? <Notice tone="trust">{eState.message}</Notice> : (
            <form action={eAction} className="space-y-3">
              <Contact me={me} fe={eState.fieldErrors} />
              <div>
                <label htmlFor="pl-msg" className="block text-[13px] font-medium text-ink-2 mb-1">Message</label>
                <Textarea id="pl-msg" name="message" rows={3} className="min-h-0" defaultValue={`I'm interested in ${projectName}. Please share the latest price list and offers.`} />
                <Err m={eState.fieldErrors?.message} />
              </div>
              <Consent builder={builder} fe={eState.fieldErrors} />
              {eState.error && <Notice tone="danger">{eState.error}</Notice>}
              <Button type="submit" variant="accent" className="w-full" disabled={ePending}>{ePending ? "Sending…" : "Send enquiry"}</Button>
            </form>
          )
        ) : tab === "brochure" ? (
          <form action={bAction} className="space-y-3">
            <Contact me={me} fe={bState.fieldErrors} />
            <Consent builder={builder} fe={bState.fieldErrors} />
            {bState.error && <Notice tone="danger">{bState.error}</Notice>}
            <Button type="submit" variant="accent" className="w-full" disabled={bPending}><FileDown size={16} aria-hidden />{bPending ? "Preparing…" : "Download brochure"}</Button>
          </form>
        ) : vState.ok ? <Notice tone="trust">{vState.message} You can track it under <Link href="/account/contacted" className="underline">Contacted</Link>.</Notice> : (
          <form action={vAction} className="space-y-3">
            <Contact me={me} fe={vState.fieldErrors} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="pl-date" className="block text-[13px] font-medium text-ink-2 mb-1">Date</label>
                <Input id="pl-date" name="date" type="date" min={tomorrow} max={maxDate} defaultValue={tomorrow} required />
                <Err m={vState.fieldErrors?.date} />
              </div>
              <div>
                <label htmlFor="pl-slot" className="block text-[13px] font-medium text-ink-2 mb-1">Time</label>
                <Select id="pl-slot" name="slot" defaultValue="12:00">
                  <option value="10:00">10:00 AM</option><option value="12:00">12:00 PM</option><option value="15:00">3:00 PM</option><option value="17:00">5:00 PM</option>
                </Select>
                <Err m={vState.fieldErrors?.slot} />
              </div>
            </div>
            <div>
              <label htmlFor="pl-vmsg" className="block text-[13px] font-medium text-ink-2 mb-1">Note <span className="font-normal text-muted">(optional)</span></label>
              <Input id="pl-vmsg" name="message" placeholder="e.g. Need pickup from metro station" />
            </div>
            <Consent builder={builder} fe={vState.fieldErrors} />
            {vState.error && <Notice tone="danger">{vState.error}</Notice>}
            <Button type="submit" variant="accent" className="w-full" disabled={vPending}>{vPending ? "Booking…" : "Request site visit"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
