"use server";

import { formValues } from "@/lib/seeker/form-values";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUser, clientIp, normalizePhone, normalizeEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { PHONE_REVEAL_DAILY_LIMIT, REPORT_REASONS } from "@/lib/constants";
import { formatPhone } from "@/lib/format";
import { createLead, getLeadListing, recentLead, type LeadListing } from "@/lib/seeker/leads";
import { notify } from "@/lib/notify";

const PHONE_REVEAL_IP_DAILY = 60;

export type LeadState = {
  values?: Record<string, string>;
  ok?: boolean;
  needLogin?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  phone?: string;
  duplicate?: boolean;
};

async function guard(listingId: number): Promise<{ error: LeadState } | { listing: LeadListing; user: NonNullable<Awaited<ReturnType<typeof getUser>>> }> {
  const user = await getUser();
  if (!user) return { error: { needLogin: true, error: "Log in to contact the poster." } };
  const listing = getLeadListing(listingId);
  if (!listing || listing.status !== "live") return { error: { error: "This listing is no longer accepting enquiries." } };
  if (listing.user_id === user.id) return { error: { error: "This is your own listing. You can't contact yourself." } };
  return { listing, user };
}

/** Phone reveal with per-user and per-IP daily limits (PRD D5, §4.4). Re-revealing the same listing within a day is free. */
async function revealFor(listing: LeadListing, user: { id: number }): Promise<{ phone?: string; error?: string }> {
  if (!listing.poster_phone) return { error: "The poster hasn't shared a phone number. Send a message instead." };
  if (!recentLead(user.id, listing.id, "phone_reveal")) {
    const ip = await clientIp();
    const perUser = rateLimit(`phone:u:${user.id}`, PHONE_REVEAL_DAILY_LIMIT, 86400);
    if (!perUser.ok) return { error: `You've viewed ${PHONE_REVEAL_DAILY_LIMIT} numbers today. Send a message instead, or try again tomorrow.` };
    const perIp = rateLimit(`phone:ip:${ip}`, PHONE_REVEAL_IP_DAILY, 86400);
    if (!perIp.ok) return { error: "Too many number requests from this network today. Please try again tomorrow." };
  }
  return { phone: formatPhone(listing.poster_phone) };
}

export async function revealPhone(listingId: number, consent: boolean): Promise<LeadState> {
  const g = await guard(listingId);
  if ("error" in g) return g.error;
  if (!consent) return { error: "Please agree to share your contact details with the poster." };
  const r = await revealFor(g.listing, g.user);
  if (r.error) return { error: r.error };
  const lead = createLead({ listing: g.listing, seeker: g.user, channel: "phone_reveal" });
  revalidatePath("/account/contacted");
  return { ok: true, phone: r.phone, duplicate: lead.duplicate };
}

const SLOTS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const base = z.object({
  listingId: z.coerce.number().int().positive(),
  channel: z.enum(["contact", "visit", "callback"]),
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z.string().trim().transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" });
    return p ?? "";
  }),
  email: z.string().trim().max(120).optional().transform((v, ctx) => {
    if (!v) return null;
    const e = normalizeEmail(v);
    if (!e) ctx.addIssue({ code: "custom", message: "Enter a valid email or leave it blank" });
    return e;
  }),
  message: z.string().trim().max(1000, "Keep it under 1000 characters").optional(),
  consent: z.literal("on", { error: "Please agree to share your details with the poster" }),
  date: z.string().optional(),
  slot: z.string().optional(),
  when: z.enum(["asap", "morning", "afternoon", "evening"]).optional(),
});

export async function submitLead(prev: LeadState, form: FormData): Promise<LeadState> {
  const r = await submitLeadInner(prev, form);
  // Echo submitted values so the form can keep them after React resets it.
  return r.ok ? r : { ...r, values: formValues(form) };
}

async function submitLeadInner(_prev: LeadState, form: FormData): Promise<LeadState> {
  const raw = Object.fromEntries(form.entries());
  const parsed = base.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors, error: "Please fix the highlighted fields." };
  }
  const d = parsed.data;
  const g = await guard(d.listingId);
  if ("error" in g) return g.error;
  const { listing, user } = g;

  const ip = await clientIp();
  const rl = rateLimit(`lead:u:${user.id}`, 40, 86400);
  const rlIp = rateLimit(`lead:ip:${ip}`, 120, 86400);
  if (!rl.ok || !rlIp.ok) return { error: "You've sent a lot of enquiries today. Please try again tomorrow." };

  if (d.channel === "visit") {
    if (!d.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return { fieldErrors: { date: "Pick a date" }, error: "Pick a date and time for the visit." };
    if (!d.slot || !SLOTS.includes(d.slot)) return { fieldErrors: { slot: "Pick a time slot" }, error: "Pick a time slot." };
    // Visit times are local (IST, +05:30).
    const at = new Date(`${d.date}T${d.slot}:00+05:30`);
    const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00+05:30");
    if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now() || at.getTime() > today.getTime() + 31 * 86400000)
      return { fieldErrors: { date: "Choose a time in the next 30 days" }, error: "Choose a time in the next 30 days." };
    const when = at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    const lead = createLead({ listing, seeker: user, channel: "visit", name: d.name, phone: d.phone, email: d.email, message: d.message, detail: `Visit on ${when}` });
    const existingVisit = db.prepare("SELECT id FROM visits WHERE lead_id = ?").get(lead.id) as { id: number } | undefined;
    if (existingVisit) {
      db.prepare("UPDATE visits SET scheduled_at = ?, status = 'requested' WHERE id = ?").run(at.toISOString(), existingVisit.id);
    } else {
      db.prepare("INSERT INTO visits (lead_id, listing_id, seeker_id, scheduled_at) VALUES (?,?,?,?)").run(lead.id, listing.id, user.id, at.toISOString());
    }
    notify(user.id, { kind: "visit", title: `Visit requested for ${when}`, body: listing.title, link: `/property/${listing.id}` });
    revalidatePath("/account/contacted");
    return {
      ok: true,
      duplicate: lead.duplicate,
      message: lead.duplicate
        ? `Your visit has been moved to ${when}. The ${listing.poster_name ? listing.poster_name.split(" ")[0] : "poster"} will confirm.`
        : `Visit requested for ${when}. You'll get a confirmation once the poster accepts.`,
    };
  }

  if (d.channel === "callback") {
    const label = { asap: "as soon as possible", morning: "in the morning (9am–12pm)", afternoon: "in the afternoon (12–4pm)", evening: "in the evening (4–8pm)" }[d.when ?? "asap"];
    const lead = createLead({ listing, seeker: user, channel: "callback", name: d.name, phone: d.phone, email: d.email, message: d.message, detail: `Call back ${label}` });
    revalidatePath("/account/contacted");
    return { ok: true, duplicate: lead.duplicate, message: lead.duplicate ? "You already asked for a callback today. The poster has your number." : `Callback requested. Expect a call ${label}.` };
  }

  // contact
  if (!d.message || d.message.length < 5) return { fieldErrors: { message: "Write a short message" }, error: "Write a short message to the poster." };
  const lead = createLead({ listing, seeker: user, channel: "contact", name: d.name, phone: d.phone, email: d.email, message: d.message });
  // Contacting also reveals the number (D5), within the same daily limits.
  const r = await revealFor(listing, user);
  if (r.phone) createLead({ listing, seeker: user, channel: "phone_reveal" });
  revalidatePath("/account/contacted");
  return {
    ok: true,
    duplicate: lead.duplicate,
    phone: r.phone,
    message: lead.duplicate ? "You already messaged about this property today. The poster has your details." : "Message sent. The poster has been notified by SMS, email and WhatsApp.",
  };
}

const reportSchema = z.object({
  listingId: z.coerce.number().int().positive(),
  reason: z.enum(REPORT_REASONS.map((r) => r.value) as [string, ...string[]], { error: "Choose a reason" }),
  details: z.string().trim().max(1500, "Keep it under 1500 characters").optional(),
});

export type ReportState = { values?: Record<string, string>; ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

export async function reportListing(prev: ReportState, form: FormData): Promise<ReportState> {
  const r = await reportListingInner(prev, form);
  // Echo submitted values so the form can keep them after React resets it.
  return r.ok ? r : { ...r, values: formValues(form) };
}

async function reportListingInner(_prev: ReportState, form: FormData): Promise<ReportState> {
  const parsed = reportSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors, error: "Please fix the highlighted fields." };
  }
  const d = parsed.data;
  if (d.reason === "other" && (!d.details || d.details.length < 10)) return { fieldErrors: { details: "Tell us what's wrong (at least 10 characters)" } };
  const user = await getUser();
  const ip = await clientIp();
  const rl = rateLimit(`report:${user ? `u:${user.id}` : `ip:${ip}`}`, user ? 10 : 5, 3600);
  if (!rl.ok) return { error: "You've sent several reports recently. Please try again in an hour." };
  const l = db.prepare("SELECT id, user_id FROM listings WHERE id = ?").get(d.listingId) as { id: number; user_id: number } | undefined;
  if (!l) return { error: "Listing not found." };
  if (user) {
    const dup = db.prepare("SELECT id FROM reports WHERE listing_id = ? AND reporter_id = ? AND status = 'open'").get(l.id, user.id);
    if (dup) return { ok: true };
  }
  db.prepare("INSERT INTO reports (listing_id, reported_user_id, reporter_id, reason, details) VALUES (?,?,?,?,?)").run(
    l.id, l.user_id, user?.id ?? null, d.reason, d.details || null
  );
  return { ok: true };
}
