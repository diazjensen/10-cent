"use server";

import { z } from "zod";
import { db, nowIso, addDays } from "@/lib/db";
import { notify } from "@/lib/notify";
import { LISTING_VALIDITY_DAYS, PROPERTY_TYPES } from "@/lib/constants";
import type { User } from "@/lib/auth";
import { staff, auditAs, done, fail, NOT_ALLOWED, str, int, ids, zodErrors, type ActionState } from "./guard";

const logMod = (listingId: number, actorId: number, action: string, reason: string | null = null) =>
  db.prepare("INSERT INTO moderation_logs (listing_id, actor_id, action, reason) VALUES (?,?,?,?)").run(listingId, actorId, action, reason);

type Row = { id: number; user_id: number; status: string; title: string };
const row = (id: number) => db.prepare("SELECT id, user_id, status, title FROM listings WHERE id = ?").get(id) as Row | undefined;

async function approveOne(u: User, id: number): Promise<string | null> {
  const l = row(id);
  if (!l) return `Listing #${id} not found.`;
  if (!["pending", "rejected"].includes(l.status)) return `Listing #${id} is ${l.status}, not awaiting review.`;
  const now = nowIso();
  db.prepare("UPDATE listings SET status = 'live', reject_reason = NULL, published_at = ?, expires_at = ?, updated_at = ? WHERE id = ?")
    .run(now, addDays(LISTING_VALIDITY_DAYS), now, id);
  logMod(id, u.id, "approved");
  await auditAs(u, "listing.approve", "listing", id);
  notify(l.user_id, {
    kind: "moderation",
    title: "Your listing is live",
    body: `“${l.title}” passed review and is now visible to buyers and tenants for ${LISTING_VALIDITY_DAYS} days.`,
    link: `/property/${id}`,
  }, ["sms", "email"]);
  return null;
}

export async function approveListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await staff("moderation");
  if (!u) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const err = await approveOne(u, id);
  return err ? fail(err) : done(`Listing #${id} approved and the poster notified.`);
}

export async function bulkApprove(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await staff("moderation");
  if (!u) return NOT_ALLOWED;
  const list = ids(fd);
  if (!list.length) return fail("Select at least one listing.");
  const errors: string[] = [];
  for (const id of list) {
    const e = await approveOne(u, id);
    if (e) errors.push(e);
  }
  const okN = list.length - errors.length;
  if (!okN) return fail(errors.join(" "));
  return done(`${okN} listing${okN > 1 ? "s" : ""} approved.${errors.length ? ` Skipped: ${errors.join(" ")}` : ""}`);
}

export async function rejectListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await staff("moderation");
  if (!u) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const reason = [str(fd, "preset"), str(fd, "note")].filter(Boolean).join(". ");
  if (reason.length < 5) return fail("Pick a reason or write one so the poster knows what to fix.", { reason: "Required" });
  const l = row(id);
  if (!l) return fail("Listing not found.");
  if (l.status !== "pending") return fail(`This listing is ${l.status}; only pending listings can be rejected. Use take down for live ones.`);
  db.prepare("UPDATE listings SET status = 'rejected', reject_reason = ?, updated_at = ? WHERE id = ?").run(reason, nowIso(), id);
  logMod(id, u.id, "rejected", reason);
  await auditAs(u, "listing.reject", "listing", id, { reason });
  notify(l.user_id, {
    kind: "moderation",
    title: "Your listing needs changes",
    body: `“${l.title}” was not approved: ${reason}. Edit it and resubmit from your dashboard.`,
    link: "/dashboard/listings",
  }, ["sms", "email"]);
  return done(`Listing #${id} rejected; the poster has been told why.`);
}

const editSchema = z.object({
  title: z.string().trim().min(10, "At least 10 characters").max(120, "Keep it under 120 characters"),
  price: z.number({ message: "Enter a number" }).int().min(1000, "Price looks too low").max(5_000_000_000, "Price looks too high"),
  description: z.string().trim().max(5000, "Too long").optional(),
  property_type: z.enum(PROPERTY_TYPES.map((p) => p.value) as [string, ...string[]], { message: "Pick a type" }),
  bhk: z.number().int().min(0).max(20).nullable(),
  carpet_area: z.number().int().min(50, "Too small").max(1_000_000).nullable(),
  super_area: z.number().int().min(50, "Too small").max(1_000_000).nullable(),
});

export async function editListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await staff("moderation");
  if (!u) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const before = db.prepare("SELECT title, price, description, property_type, bhk, carpet_area, super_area FROM listings WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!before) return fail("Listing not found.");
  const parsed = editSchema.safeParse({
    title: str(fd, "title"), price: int(fd, "price"), description: str(fd, "description").replace(/\r\n/g, "\n") || undefined,
    property_type: str(fd, "property_type"), bhk: int(fd, "bhk"), carpet_area: int(fd, "carpet_area"), super_area: int(fd, "super_area"),
  });
  if (!parsed.success) return fail("Fix the highlighted fields.", zodErrors(parsed.error.issues));
  const v = parsed.data;
  const after: Record<string, unknown> = { ...v, description: v.description ?? null };
  const norm = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() || null : v ?? null);
  const changed = Object.keys(after).filter((k) => norm(before[k]) !== norm(after[k]));
  if (!changed.length) return fail("Nothing changed.");
  db.prepare("UPDATE listings SET title = ?, price = ?, description = ?, property_type = ?, bhk = ?, carpet_area = ?, super_area = ?, updated_at = ? WHERE id = ?")
    .run(v.title, v.price, v.description ?? null, v.property_type, v.bhk, v.carpet_area, v.super_area, nowIso(), id);
  logMod(id, u.id, "edited", `Changed ${changed.join(", ")}`);
  await auditAs(u, "listing.edit", "listing", id, Object.fromEntries(changed.map((k) => [k, { from: before[k], to: after[k] }])));
  return done(`Saved: ${changed.join(", ")}.`);
}

export async function takedownListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await staff("moderation");
  if (!u) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const reason = [str(fd, "preset"), str(fd, "note")].filter(Boolean).join(". ");
  if (reason.length < 5) return fail("A reason is required for a takedown.", { reason: "Required" });
  const l = row(id);
  if (!l) return fail("Listing not found.");
  if (l.status === "removed") return fail("Already taken down.");
  db.prepare("UPDATE listings SET status = 'removed', reject_reason = ?, featured = 0, updated_at = ? WHERE id = ?").run(reason, nowIso(), id);
  logMod(id, u.id, "takedown", reason);
  await auditAs(u, "listing.takedown", "listing", id, { reason, previous: l.status });
  notify(l.user_id, { kind: "moderation", title: "Your listing was taken down", body: `“${l.title}”: ${reason}. Reply to support@10cent.in if you think this is a mistake.`, link: "/dashboard/listings" }, ["sms", "email"]);
  return done(`Listing #${id} taken down.`);
}

export async function restoreListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await staff("moderation");
  if (!u) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const l = db.prepare("SELECT id, user_id, status, title, expires_at FROM listings WHERE id = ?").get(id) as (Row & { expires_at: string | null }) | undefined;
  if (!l) return fail("Listing not found.");
  if (!["removed", "paused", "rejected", "expired"].includes(l.status)) return fail(`Listing is ${l.status}; nothing to restore.`);
  const now = nowIso();
  const exp = l.expires_at && l.expires_at > now ? l.expires_at : addDays(LISTING_VALIDITY_DAYS);
  db.prepare("UPDATE listings SET status = 'live', reject_reason = NULL, published_at = COALESCE(published_at, ?), expires_at = ?, updated_at = ? WHERE id = ?").run(now, exp, now, id);
  logMod(id, u.id, "renewed", `Restored by staff from ${l.status}`);
  await auditAs(u, "listing.restore", "listing", id, { previous: l.status });
  notify(l.user_id, { kind: "moderation", title: "Your listing is live again", body: `“${l.title}” has been restored.`, link: `/property/${id}` }, ["email"]);
  return done(`Listing #${id} restored to live.`);
}

export async function toggleListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await staff("moderation");
  if (!u) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const field = str(fd, "field");
  if (!["featured", "premium"].includes(field)) return fail("Unknown field.");
  const cur = db.prepare(`SELECT ${field} v, status FROM listings WHERE id = ?`).get(id) as { v: number; status: string } | undefined;
  if (!cur) return fail("Listing not found.");
  const next = cur.v ? 0 : 1;
  if (next && cur.status !== "live") return fail("Only live listings can be featured or marked premium.");
  db.prepare(`UPDATE listings SET ${field} = ?, updated_at = ? WHERE id = ?`).run(next, nowIso(), id);
  await auditAs(u, `listing.${field}.${next ? "on" : "off"}`, "listing", id);
  return done(`${field === "featured" ? "Featured" : "Premium"} ${next ? "on" : "off"} for #${id}.`);
}

/* ---------------------------------------------------------------- P6 physical verification */

export async function scheduleVisit(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await staff("moderation");
  if (!u) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const when = str(fd, "when");
  const agent = str(fd, "agent");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(when)) return fail("Pick a date and time.", { when: "Required" });
  if (new Date(when) < new Date(Date.now() - 3600000)) return fail("The visit can't be in the past.", { when: "In the past" });
  if (agent.length < 2) return fail("Who is visiting?", { agent: "Enter the field executive's name" });
  const l = db.prepare("SELECT id, user_id, title FROM listings WHERE id = ? AND verification_requested_at IS NOT NULL AND verified = 0").get(id) as Row | undefined;
  if (!l) return fail("No open verification request for this listing.");
  const label = new Date(when).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  logMod(id, u.id, "verify_scheduled", `${when}|${agent}`);
  await auditAs(u, "verification.schedule", "listing", id, { when, agent });
  notify(l.user_id, { kind: "visit", title: "Verification visit scheduled", body: `${agent} from 10cent will visit “${l.title}” on ${label}. Please keep the property accessible.`, link: "/dashboard/listings" }, ["sms", "email"]);
  return done(`Visit scheduled for ${label}; poster notified.`);
}

export async function completeVerification(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await staff("moderation");
  if (!u) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const outcome = str(fd, "outcome");
  const note = str(fd, "note");
  const l = db.prepare("SELECT id, user_id, title FROM listings WHERE id = ? AND verification_requested_at IS NOT NULL AND verified = 0").get(id) as Row | undefined;
  if (!l) return fail("No open verification request for this listing.");
  if (outcome === "verified") {
    db.prepare("UPDATE listings SET verified = 1, updated_at = ? WHERE id = ?").run(nowIso(), id);
    logMod(id, u.id, "verified", note || "Field visit done; details match");
    await auditAs(u, "verification.verified", "listing", id, { note });
    notify(l.user_id, { kind: "moderation", title: "Your listing is now Verified", body: `“${l.title}” passed the field visit and shows the Verified badge.`, link: `/property/${id}` }, ["sms", "email"]);
    return done(`#${id} marked verified.`);
  }
  if (outcome === "declined") {
    if (note.length < 5) return fail("Give a reason for declining.", { note: "Required" });
    db.prepare("UPDATE listings SET verification_requested_at = NULL, updated_at = ? WHERE id = ?").run(nowIso(), id);
    logMod(id, u.id, "verify_declined", note);
    await auditAs(u, "verification.declined", "listing", id, { note });
    notify(l.user_id, { kind: "moderation", title: "Verification not completed", body: `“${l.title}”: ${note}. You can request a new visit from your dashboard.`, link: "/dashboard/listings" }, ["sms", "email"]);
    return done(`Verification for #${id} declined.`);
  }
  return fail("Choose an outcome.");
}
