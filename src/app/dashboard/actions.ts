"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser, normalizePhone } from "@/lib/auth";
import { addDays, audit, db, nowIso } from "@/lib/db";
import { notify } from "@/lib/notify";
import { LISTING_VALIDITY_DAYS } from "@/lib/constants";
import { activePlan, DASH_AS_COOKIE, ownsListing } from "@/lib/supply/account";
import { getWebhook, isValidWebhookUrl, newSecret, sendTestWebhook } from "@/lib/supply/webhook";
import { validateGstin } from "@/lib/supply/billing";

type L = { id: number; user_id: number; status: string; expires_at: string | null; published_at: string | null; verified: number; verification_requested_at: string | null; title: string };

const wasApproved = (id: number, publishedAt: string | null) =>
  !!publishedAt || !!db.prepare("SELECT 1 FROM moderation_logs WHERE listing_id = ? AND action = 'approved' LIMIT 1").get(id);

export type ListingOp = "renew" | "pause" | "unpause" | "sold" | "rented" | "delete" | "verify";

/** Owner actions on a listing (PRD P5, P6). */
export async function listingAction(id: number, op: ListingOp): Promise<{ ok: boolean; message: string }> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Log in again to continue." };
  if (!ownsListing(user, id)) return { ok: false, message: "You can't change this listing." };
  const l = db.prepare("SELECT id, user_id, status, expires_at, published_at, verified, verification_requested_at, title FROM listings WHERE id = ?").get(id) as L;
  const now = nowIso();
  const log = (action: string, reason?: string) => db.prepare("INSERT INTO moderation_logs (listing_id, actor_id, action, reason) VALUES (?,?,?,?)").run(id, user.id, action, reason ?? null);
  let message = "";

  switch (op) {
    case "renew": {
      const soon = l.expires_at && new Date(l.expires_at).getTime() - Date.now() < 7 * 86400000;
      if (!(l.status === "expired" || (l.status === "live" && soon))) return { ok: false, message: "Only expired listings or listings expiring within 7 days can be renewed." };
      const base = l.expires_at && new Date(l.expires_at) > new Date() ? new Date(l.expires_at) : new Date();
      const expires = addDays(LISTING_VALIDITY_DAYS, base);
      const plan = activePlan(l.user_id);
      db.prepare("UPDATE listings SET boost = ?, premium = ? WHERE id = ?").run(plan?.boost ?? 0, (plan?.boost ?? 0) >= 2 ? 1 : 0, id);
      if (l.status === "live" || wasApproved(id, l.published_at)) {
        db.prepare("UPDATE listings SET status = 'live', expires_at = ?, updated_at = ? WHERE id = ?").run(expires, now, id);
        message = `Renewed until ${new Date(expires).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`;
      } else {
        db.prepare("UPDATE listings SET status = 'pending', expires_at = ?, updated_at = ? WHERE id = ?").run(expires, now, id);
        message = "Renewed and sent for review, since it was never approved before.";
      }
      log("renewed", `Renewed for ${LISTING_VALIDITY_DAYS} days`);
      break;
    }
    case "pause":
      if (l.status !== "live") return { ok: false, message: "Only live listings can be paused." };
      db.prepare("UPDATE listings SET status = 'paused', updated_at = ? WHERE id = ?").run(now, id);
      log("paused", "Paused by poster");
      message = "Paused. It's hidden from search until you unpause it.";
      break;
    case "unpause": {
      if (l.status !== "paused") return { ok: false, message: "This listing isn't paused." };
      const expired = l.expires_at && new Date(l.expires_at) < new Date();
      const next = expired ? "expired" : wasApproved(id, l.published_at) ? "live" : "pending";
      db.prepare("UPDATE listings SET status = ?, updated_at = ? WHERE id = ?").run(next, now, id);
      log("unpaused", `Unpaused to ${next}`);
      message = next === "live" ? "Live again." : next === "expired" ? "It expired while paused. Renew it to go live." : "Sent for review.";
      break;
    }
    case "sold":
    case "rented":
      if (!["live", "paused", "expired", "pending"].includes(l.status)) return { ok: false, message: "This listing is already closed." };
      db.prepare("UPDATE listings SET status = ?, updated_at = ? WHERE id = ?").run(op, now, id);
      log(op, `Marked ${op} by poster`);
      message = `Marked as ${op}. Congratulations!`;
      break;
    case "delete":
      db.prepare("DELETE FROM listings WHERE id = ?").run(id);
      audit(user.id, "listing.delete", "listing", id, { title: l.title, status: l.status });
      message = "Listing deleted.";
      break;
    case "verify":
      if (l.verified) return { ok: false, message: "This listing is already verified." };
      if (l.verification_requested_at) return { ok: false, message: "Verification is already requested." };
      if (!["live", "pending", "paused"].includes(l.status)) return { ok: false, message: "Only active listings can be verified." };
      db.prepare("UPDATE listings SET verification_requested_at = ? WHERE id = ?").run(now, id);
      log("verification_requested", "Physical verification requested by poster");
      notify(l.user_id, { kind: "system", title: "Verification visit requested", body: `Our field team will call you within 2 working days to schedule a visit for listing #${id}.`, link: "/dashboard/listings" }, ["sms"]);
      message = "Requested. Our field team will call you within 2 working days.";
      break;
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true, message };
}

/** Lead status in the responses inbox (PRD O2). */
export async function leadStatusAction(leadId: number, status: "new" | "contacted" | "spam" | "closed") {
  const user = await getUser();
  if (!user) return { ok: false };
  if (!["new", "contacted", "spam", "closed"].includes(status)) return { ok: false };
  const lead = db.prepare("SELECT poster_id FROM leads WHERE id = ?").get(leadId) as { poster_id: number } | undefined;
  if (!lead || (lead.poster_id !== user.id && user.role !== "admin")) return { ok: false };
  db.prepare("UPDATE leads SET status = ? WHERE id = ?").run(status, leadId);
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/** Confirm or cancel a site-visit request; the seeker is notified. */
export async function visitAction(visitId: number, op: "confirm" | "cancel" | "done") {
  const user = await getUser();
  if (!user) return { ok: false, message: "Log in again." };
  const v = db.prepare(
    `SELECT v.*, COALESCE(l.user_id, p.builder_id) AS owner_id, COALESCE(l.title, p.name) AS what
     FROM visits v LEFT JOIN listings l ON l.id = v.listing_id LEFT JOIN projects p ON p.id = v.project_id WHERE v.id = ?`
  ).get(visitId) as { id: number; seeker_id: number | null; owner_id: number | null; scheduled_at: string; status: string; what: string; listing_id: number | null; project_id: number | null } | undefined;
  if (!v || (v.owner_id !== user.id && user.role !== "admin")) return { ok: false, message: "Visit not found." };
  const next = op === "confirm" ? "confirmed" : op === "cancel" ? "cancelled" : "done";
  db.prepare("UPDATE visits SET status = ? WHERE id = ?").run(next, visitId);
  const when = new Date(v.scheduled_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  if (v.seeker_id && op !== "done") {
    notify(
      v.seeker_id,
      {
        kind: "visit",
        title: op === "confirm" ? `Site visit confirmed for ${when}` : "Site visit cancelled",
        body: op === "confirm" ? `${user.name || "The poster"} confirmed your visit to ${v.what}.` : `${user.name || "The poster"} can't make the visit to ${v.what} on ${when}. You can request another time.`,
        link: v.listing_id ? `/property/${v.listing_id}` : "/account/contacted",
      },
      ["sms", "whatsapp"]
    );
  }
  revalidatePath("/dashboard/responses");
  return { ok: true, message: op === "confirm" ? "Visit confirmed. The seeker has been notified." : op === "cancel" ? "Visit cancelled. The seeker has been notified." : "Marked as done." };
}

export type FormState = { ok?: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, string> } | null;

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  company_name: z.string().trim().max(120),
  rera_number: z.string().trim().max(60).refine((v) => !v || /^[A-Za-z0-9/\-_. ]{6,60}$/.test(v), "RERA number has unexpected characters"),
  experience_years: z.union([z.literal(""), z.coerce.number().int().min(0, "Can't be negative").max(80, "Looks too high")]),
  established_year: z.union([z.literal(""), z.coerce.number().int().min(1900).max(new Date().getFullYear(), "Can't be in the future")]),
  about: z.string().trim().max(1500, "Keep it under 1,500 characters"),
  website: z.union([z.literal(""), z.url("Enter a full URL starting with https://").max(200)]),
  gstin: z.string().trim().toUpperCase().max(15),
  gst_state: z.string().optional(),
  city_id: z.union([z.literal(""), z.coerce.number().int()]),
});

/** Agent / builder business profile (PRD O6). */
export async function saveProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Log in again." };
  const raw = Object.fromEntries(["name", "email", "company_name", "rera_number", "experience_years", "established_year", "about", "website", "gstin", "city_id"].map((k) => [k, String(fd.get(k) ?? "")]));
  const r = profileSchema.safeParse(raw);
  if (!r.success) {
    const errors: Record<string, string> = {};
    for (const i of r.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors, values: raw };
  }
  const d = r.data;
  const errors: Record<string, string> = {};
  if (d.gstin) {
    const msg = validateGstin(d.gstin, "");
    if (msg) errors.gstin = msg;
  }
  if ((user.role === "agent" || user.role === "builder") && !d.company_name) errors.company_name = user.role === "agent" ? "Enter your agency name" : "Enter the company name";
  if (user.role === "agent" && !d.rera_number) errors.rera_number = "Agents must show their RERA registration";
  if (d.email) {
    const clash = db.prepare("SELECT id FROM users WHERE email = ? AND id <> ?").get(d.email.toLowerCase(), user.id);
    if (clash) errors.email = "This email is used by another account";
  }
  if (Object.keys(errors).length) return { ok: false, errors, values: raw };
  db.prepare("UPDATE users SET name = ?, email = ? WHERE id = ?").run(d.name, d.email ? d.email.toLowerCase() : user.email, user.id);
  db.prepare(
    `INSERT INTO profiles (user_id, company_name, rera_number, experience_years, established_year, about, website, gstin, city_id)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET company_name = excluded.company_name, rera_number = excluded.rera_number, experience_years = excluded.experience_years,
       established_year = excluded.established_year, about = excluded.about, website = excluded.website, gstin = excluded.gstin, city_id = excluded.city_id`
  ).run(user.id, d.company_name || null, d.rera_number || null, d.experience_years === "" ? null : d.experience_years, d.established_year === "" ? null : d.established_year, d.about || null, d.website || null, d.gstin || null, d.city_id === "" ? null : d.city_id);
  audit(user.id, "profile.update", "user", user.id);
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profile saved." };
}

/** Notification channel preferences for enquiry alerts (PRD O3). */
export async function savePrefsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Log in again." };
  const on = (k: string) => (fd.get(k) === "on" ? 1 : 0);
  db.prepare(
    `INSERT INTO notification_prefs (user_id, email, sms, whatsapp, push) VALUES (?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, sms = excluded.sms, whatsapp = excluded.whatsapp, push = excluded.push`
  ).run(user.id, on("email"), on("sms"), on("whatsapp"), on("push"));
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Alert preferences saved." };
}

/** Save / replace the CRM webhook (PRD B7). */
export async function saveWebhookAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user || !["agent", "builder", "admin"].includes(user.role)) return { ok: false, message: "Only agents and builders can add a webhook." };
  const url = String(fd.get("url") ?? "").trim();
  if (!isValidWebhookUrl(url)) return { ok: false, errors: { url: "Enter a full http(s) URL, e.g. https://crm.example.com/hooks/10cent" } };
  const existing = getWebhook(user.id);
  const active = fd.get("active") === "on" ? 1 : 0;
  if (existing) {
    db.prepare("UPDATE webhooks SET url = ?, active = ? WHERE id = ?").run(url, active, existing.id);
  } else {
    db.prepare("INSERT INTO webhooks (user_id, url, secret, active) VALUES (?,?,?,?)").run(user.id, url, newSecret(), active);
  }
  audit(user.id, existing ? "webhook.update" : "webhook.create", "webhook", existing?.id ?? null, { url });
  revalidatePath("/dashboard/leads");
  return { ok: true, message: existing ? "Webhook updated." : "Webhook added. Copy the signing secret below into your CRM." };
}

export async function rotateWebhookSecretAction() {
  const user = await getUser();
  if (!user) return;
  const h = getWebhook(user.id);
  if (h) db.prepare("UPDATE webhooks SET secret = ? WHERE id = ?").run(newSecret(), h.id);
  revalidatePath("/dashboard/leads");
}

export async function deleteWebhookAction() {
  const user = await getUser();
  if (!user) return;
  db.prepare("DELETE FROM webhooks WHERE user_id = ?").run(user.id);
  audit(user.id, "webhook.delete", "webhook", null);
  revalidatePath("/dashboard/leads");
}

export async function testWebhookAction(): Promise<{ ok: boolean; status: string }> {
  const user = await getUser();
  if (!user) return { ok: false, status: "Log in again." };
  const r = await sendTestWebhook(user.id);
  revalidatePath("/dashboard/leads");
  return r;
}

/** Admin: view a poster's dashboard. */
export async function viewAsAction(fd: FormData) {
  const user = await getUser();
  if (!user || user.role !== "admin" || !["super", "support", "sales", "moderator"].includes(user.admin_role ?? "")) return;
  const q = String(fd.get("who") ?? "").trim();
  const phone = normalizePhone(q);
  const target = db.prepare("SELECT id FROM users WHERE (id = ? OR phone = ? OR email = ?) AND role IN ('owner','agent','builder')").get(Number(q) || -1, phone ?? "", q.toLowerCase()) as { id: number } | undefined;
  if (!target) redirect("/dashboard?viewas=notfound");
  (await cookies()).set(DASH_AS_COOKIE, String(target.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 3600 });
  audit(user.id, "dashboard.view_as", "user", target.id);
  redirect("/dashboard");
}

export async function stopViewAsAction() {
  (await cookies()).delete(DASH_AS_COOKIE);
  redirect("/dashboard");
}
