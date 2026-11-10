"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser, destroySession, normalizeEmail } from "@/lib/auth";
import { db, nowIso, audit } from "@/lib/db";
import { parseBudget } from "@/lib/format";

export type FormState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> };

async function me() {
  const u = await getUser();
  if (!u) redirect("/login?next=/account/profile");
  return u;
}

/* ---------- Shortlist / seen (A2) ---------- */

export async function removeShortlist(form: FormData) {
  const u = await me();
  await db.prepare("DELETE FROM shortlists WHERE user_id = ? AND listing_id = ?").run(u.id, Number(form.get("listing_id")));
  revalidatePath("/account/shortlist");
}

export async function clearShortlist() {
  const u = await me();
  await db.prepare("DELETE FROM shortlists WHERE user_id = ?").run(u.id);
  revalidatePath("/account/shortlist");
}

export async function clearSeen() {
  const u = await me();
  await db.prepare("DELETE FROM seen_listings WHERE user_id = ?").run(u.id);
  revalidatePath("/account/seen");
}

export async function cancelVisit(form: FormData) {
  const u = await me();
  const id = Number(form.get("visit_id"));
  const v = await db.prepare("SELECT v.id, v.lead_id, l.poster_id, COALESCE(p.name, li.title) what FROM visits v LEFT JOIN leads l ON l.id = v.lead_id LEFT JOIN projects p ON p.id = v.project_id LEFT JOIN listings li ON li.id = v.listing_id WHERE v.id = ? AND v.seeker_id = ? AND v.status IN ('requested','confirmed')").get(id, u.id) as { id: number; poster_id: number | null; what: string | null } | undefined;
  if (!v) return;
  await db.prepare("UPDATE visits SET status = 'cancelled' WHERE id = ?").run(v.id);
  if (v.poster_id) {
    const { notify } = await import("@/lib/notify");
    await notify(v.poster_id, { kind: "visit", title: "Site visit cancelled", body: `${u.name ?? "A seeker"} cancelled their visit${v.what ? ` to ${v.what}` : ""}.`, link: "/dashboard/responses" });
  }
  revalidatePath("/account/contacted");
}

/* ---------- Saved searches (A2) ---------- */

const CHANNELS = ["email", "sms", "whatsapp", "push"] as const;
const searchSchema = z.object({
  name: z.string().trim().min(2, "Give the search a name").max(80, "Keep the name under 80 characters"),
  frequency: z.enum(["instant", "daily", "weekly"], { message: "Pick how often to alert you" }),
});

export async function updateSavedSearch(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await me();
  const id = Number(form.get("id"));
  const row = await db.prepare("SELECT id FROM saved_searches WHERE id = ? AND user_id = ?").get(id, u.id);
  if (!row) return { error: "That saved search no longer exists." };
  const parsed = searchSchema.safeParse({ name: form.get("name"), frequency: form.get("frequency") });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { fieldErrors: fe };
  }
  const channels = CHANNELS.filter((c) => form.getAll("channels").includes(c));
  if (!channels.length) return { fieldErrors: { channels: "Choose at least one channel, or delete the search" } };
  await db.prepare("UPDATE saved_searches SET name = ?, frequency = ?, channels = ? WHERE id = ?").run(parsed.data.name, parsed.data.frequency, channels.join(","), id);
  revalidatePath("/account/searches");
  return { ok: true, message: "Saved" };
}

export async function deleteSavedSearch(form: FormData) {
  const u = await me();
  await db.prepare("DELETE FROM saved_searches WHERE id = ? AND user_id = ?").run(Number(form.get("id")), u.id);
  revalidatePath("/account/searches");
}

/* ---------- Notifications (A3) ---------- */

export async function markRead(form: FormData) {
  const u = await me();
  const id = Number(form.get("id"));
  await db.prepare("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?").run(id, u.id);
  const link = String(form.get("link") ?? "");
  revalidatePath("/", "layout");
  if (link.startsWith("/") && !link.startsWith("//")) redirect(link);
}

export async function markAllRead() {
  const u = await me();
  await db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0").run(u.id);
  revalidatePath("/", "layout");
}

export async function deleteReadNotifications() {
  const u = await me();
  await db.prepare("DELETE FROM notifications WHERE user_id = ? AND read = 1").run(u.id);
  revalidatePath("/account/notifications");
}

export async function saveNotificationPrefs(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await me();
  const on = (k: string) => (form.get(k) === "on" ? 1 : 0);
  await db.prepare(`INSERT INTO notification_prefs (user_id, email, sms, whatsapp, push) VALUES (?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, sms = excluded.sms, whatsapp = excluded.whatsapp, push = excluded.push`)
        .run(u.id, on("email"), on("sms"), on("whatsapp"), on("push"));
  revalidatePath("/account/notifications");
  return { ok: true, message: "Preferences saved" };
}

/* ---------- Profile (A5) ---------- */

export async function updateProfile(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await me();
  const fe: Record<string, string> = {};
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) fe.name = "Enter your name (2–80 characters)";
  const rawEmail = String(form.get("email") ?? "").trim();
  let email: string | null = null;
  if (rawEmail) {
    email = normalizeEmail(rawEmail);
    if (!email) fe.email = "Enter a valid email address";
    else if (await db.prepare("SELECT 1 FROM users WHERE email = ? AND id <> ?").get(email, u.id)) fe.email = "Another account already uses this email";
  } else if (u.email && !u.phone) {
    fe.email = "Email is your login; it can't be removed";
  }
  const cities = (await db.prepare("SELECT slug FROM cities").all() as { slug: string }[]).map((c) => c.slug);
  const preferred = form.getAll("cities").map(String).filter((c) => cities.includes(c));
  const bmin = String(form.get("budget_min") ?? "").trim();
  const bmax = String(form.get("budget_max") ?? "").trim();
  const min = bmin ? parseBudget(bmin) : null;
  const max = bmax ? parseBudget(bmax) : null;
  if (bmin && min == null) fe.budget_min = "Use a number like 50L, 1.2Cr or 45000";
  if (bmax && max == null) fe.budget_max = "Use a number like 50L, 1.2Cr or 45000";
  if (min != null && max != null && min > max) fe.budget_max = "Maximum must be more than minimum";
  let role = u.role;
  const wanted = String(form.get("role") ?? u.role);
  if ((u.role === "seeker" || u.role === "owner") && (wanted === "seeker" || wanted === "owner")) role = wanted;
  if (Object.keys(fe).length) return { fieldErrors: fe };
  await db.prepare("UPDATE users SET name = ?, email = ?, is_nri = ?, preferred_cities = ?, budget_min = ?, budget_max = ?, role = ? WHERE id = ?")
        .run(name, email, form.get("is_nri") === "on" ? 1 : 0, preferred.join(",") || null, min, max, role, u.id);
  revalidatePath("/", "layout");
  const next = String(form.get("next") ?? "");
  if (form.get("welcome") === "1" && next.startsWith("/") && !next.startsWith("//")) redirect(next);
  return { ok: true, message: role !== u.role ? `Saved. You're now set up as ${role === "owner" ? "a property owner" : "a seeker"}.` : "Profile saved" };
}

/* ---------- Account deletion (A5, DPDP) ---------- */

export async function deleteAccount(_prev: FormState, form: FormData): Promise<FormState> {
  const u = await me();
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE MY ACCOUNT") return { fieldErrors: { confirm: "Type DELETE MY ACCOUNT exactly to confirm" } };
  if (u.role === "admin") return { error: "Staff accounts are removed by a super admin from the admin panel." };
  const now = nowIso();
  const tx = db.transaction(async () => {
    const ids = { id: u.id };
    await db.prepare("DELETE FROM shortlists WHERE user_id = @id").run(ids);
    await db.prepare("DELETE FROM saved_searches WHERE user_id = @id").run(ids);
    await db.prepare("DELETE FROM seen_listings WHERE user_id = @id").run(ids);
    await db.prepare("DELETE FROM notifications WHERE user_id = @id").run(ids);
    await db.prepare("DELETE FROM notification_prefs WHERE user_id = @id").run(ids);
    await db.prepare("DELETE FROM requirements WHERE user_id = @id").run(ids);
    await db.prepare("DELETE FROM webhooks WHERE user_id = @id").run(ids);
    if (u.phone) await db.prepare("DELETE FROM otps WHERE target = ?").run(u.phone);
    if (u.email) await db.prepare("DELETE FROM otps WHERE target = ?").run(u.email);
    // Contact details the user left on enquiries are scrubbed; the lead record stays for the poster's history.
    await db.prepare("UPDATE leads SET name = NULL, phone = NULL, email = NULL, message = NULL WHERE seeker_id = @id").run(ids);
    await db.prepare("UPDATE visits SET status = 'cancelled' WHERE seeker_id = @id AND status IN ('requested','confirmed')").run(ids);
    await db.prepare("UPDATE listings SET status = 'removed', updated_at = ? WHERE user_id = ? AND status IN ('live','pending','draft','paused')").run(now, u.id);
    await db.prepare("UPDATE profiles SET company_name = NULL, rera_number = NULL, about = NULL, website = NULL, logo_url = NULL WHERE user_id = @id").run(ids);
    await db.prepare("UPDATE users SET phone = NULL, email = NULL, name = NULL, preferred_cities = NULL, budget_min = NULL, budget_max = NULL, is_nri = 0, deleted_at = ? WHERE id = ?").run(now, u.id);
    await db.prepare("DELETE FROM sessions WHERE user_id = @id").run(ids);
  });
  await tx();
  // Orders, invoices and subscriptions are kept: tax law requires invoices to be retained for 8 years.
  await audit(u.id, "account.deleted", "user", u.id, { by: "self" });
  await destroySession();
  redirect("/account/deleted");
}
