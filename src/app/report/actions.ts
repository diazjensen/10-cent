"use server";

import { formValues } from "@/lib/seeker/form-values";
import { z } from "zod";
import { getUser, clientIp, normalizePhone, normalizeEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { REPORT_REASONS } from "@/lib/constants";

export type FraudState = { values?: Record<string, string>; ok?: boolean; ref?: number; error?: string; fieldErrors?: Record<string, string> };

const schema = z.object({
  target: z.enum(["listing", "phone"]),
  listing: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(20).optional(),
  reason: z.enum(REPORT_REASONS.map((r) => r.value) as [string, ...string[]], { error: "Choose a reason" }),
  details: z.string().trim().min(20, "Describe what happened (at least 20 characters)").max(2000, "Keep it under 2000 characters"),
  contact: z.string().trim().max(120).optional(),
});

/** Extracts a listing id from "1234", "#1234" or a 10cent property URL. */
function listingIdFrom(s: string): number | null {
  const m = s.match(/\/property\/(\d+)/) || s.match(/^#?(\d{1,9})$/);
  return m ? Number(m[1]) : null;
}

/** General "Report fraud" (PRD §4.4): a listing, or a phone number / user, reported for admin review. */
export async function reportFraud(prev: FraudState, form: FormData): Promise<FraudState> {
  const r = await reportFraudInner(prev, form);
  // Echo submitted values so the form can keep them after React resets it.
  return r.ok ? r : { ...r, values: formValues(form) };
}

async function reportFraudInner(_prev: FraudState, form: FormData): Promise<FraudState> {
  const parsed = schema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors, error: "Please fix the highlighted fields." };
  }
  const d = parsed.data;
  const user = await getUser();
  const ip = await clientIp();

  let contactNote: string | null = null;
  if (!user && d.contact) {
    const c = normalizePhone(d.contact) ?? normalizeEmail(d.contact);
    if (!c) return { fieldErrors: { contact: "Enter a valid mobile number or email, or leave it blank" } };
    contactNote = `Reporter contact: ${c}`;
  }

  let listingId: number | null = null;
  let reportedUserId: number | null = null;
  let targetNote: string | null = null;
  if (d.target === "listing") {
    const id = listingIdFrom(d.listing ?? "");
    if (!id) return { fieldErrors: { listing: "Paste the property link or its ID (the number in /property/1234)" } };
    const l = db.prepare("SELECT id, user_id FROM listings WHERE id = ?").get(id) as { id: number; user_id: number } | undefined;
    if (!l) return { fieldErrors: { listing: `We couldn't find listing ${id}. Check the link and try again.` } };
    listingId = l.id;
    reportedUserId = l.user_id;
  } else {
    const phone = normalizePhone(d.phone ?? "");
    if (!phone) return { fieldErrors: { phone: "Enter the 10-digit mobile number that contacted you" } };
    const u = db.prepare("SELECT id FROM users WHERE phone = ?").get(phone) as { id: number } | undefined;
    reportedUserId = u?.id ?? null;
    targetNote = `Reported phone: ${phone}${u ? "" : " (not a registered 10cent user)"}`;
  }
  if (user && reportedUserId === user.id) return { error: "You can't report your own account or listing." };

  const rl = rateLimit(`fraud:${user ? `u:${user.id}` : `ip:${ip}`}`, user ? 10 : 5, 3600);
  if (!rl.ok) return { error: "You've sent several reports in the last hour. Please try again later." };

  const details = [targetNote, d.details, contactNote].filter(Boolean).join("\n\n");
  const info = db.prepare("INSERT INTO reports (listing_id, reported_user_id, reporter_id, reason, details) VALUES (?,?,?,?,?)")
    .run(listingId, reportedUserId, user?.id ?? null, d.reason, details);
  return { ok: true, ref: Number(info.lastInsertRowid) };
}
