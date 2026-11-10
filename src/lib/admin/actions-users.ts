"use server";

import { db, nowIso, addDays } from "@/lib/db";
import { notify } from "@/lib/notify";
import { normalizePhone, normalizeEmail } from "@/lib/auth";
import { ADMIN_ROLES, LISTING_VALIDITY_DAYS } from "@/lib/constants";
import { staff, auditAs, done, fail, NOT_ALLOWED, str, int, type ActionState } from "./guard";

type U = { id: number; name: string | null; role: string; admin_role: string | null; blocked: number; kyc_status: string };
const getU = (id: number) => db.prepare("SELECT id, name, role, admin_role, blocked, kyc_status FROM users WHERE id = ? AND deleted_at IS NULL").get(id) as U | undefined;

export async function setKyc(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("users");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const status = str(fd, "kyc");
  const note = str(fd, "note");
  if (!["none", "pending", "verified", "rejected"].includes(status)) return fail("Pick a KYC status.");
  if (status === "rejected" && note.length < 4) return fail("Tell the user why KYC was rejected.", { note: "Required for rejection" });
  const u = getU(id);
  if (!u) return fail("User not found.");
  if (u.kyc_status === status) return fail(`KYC is already ${status}.`);
  db.prepare("UPDATE users SET kyc_status = ? WHERE id = ?").run(status, id);
  await auditAs(me, "user.kyc", "user", id, { from: u.kyc_status, to: status, note: note || undefined });
  if (status === "verified") notify(id, { kind: "system", title: "Your KYC is verified", body: "Your profile now shows the verified badge.", link: "/account/profile" }, ["sms", "email"]);
  if (status === "rejected") notify(id, { kind: "system", title: "KYC could not be verified", body: note, link: "/account/profile" }, ["sms", "email"]);
  return done(`KYC set to ${status}.`);
}

export async function blockUser(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("users");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const reason = str(fd, "reason");
  if (reason.length < 5) return fail("A reason is required to block a user.", { reason: "Required" });
  const res = blockUserCore(me.id, id, reason);
  if (typeof res === "string") return fail(res);
  await auditAs(me, "user.block", "user", id, { reason, paused_listings: res.paused });
  return done(`User blocked. ${res.paused} live listing${res.paused === 1 ? "" : "s"} paused and all sessions signed out.`);
}

/** Shared by the users page and the fraud queue. Returns an error string or the count of paused listings. */
function blockUserCore(actorId: number, id: number, reason: string): string | { paused: number } {
  const u = getU(id);
  if (!u) return "User not found.";
  if (u.id === actorId) return "You can't block yourself.";
  if (u.role === "admin") return "Revoke staff access before blocking a staff account.";
  if (u.blocked) return "User is already blocked.";
  let paused = 0;
  db.transaction(() => {
    db.prepare("UPDATE users SET blocked = 1, block_reason = ? WHERE id = ?").run(reason, id);
    const live = db.prepare("SELECT id FROM listings WHERE user_id = ? AND status = 'live'").all(id) as { id: number }[];
    const log = db.prepare("INSERT INTO moderation_logs (listing_id, actor_id, action, reason) VALUES (?,?,?,?)");
    for (const l of live) log.run(l.id, actorId, "paused_block", `Poster blocked: ${reason}`);
    paused = db.prepare("UPDATE listings SET status = 'paused', updated_at = ? WHERE user_id = ? AND status = 'live'").run(nowIso(), id).changes;
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  })();
  notify(id, { kind: "system", title: "Your 10cent account has been blocked", body: `Reason: ${reason}. Write to support@10cent.in to appeal.` }, ["sms", "email"]);
  return { paused };
}

export async function unblockUser(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("users");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const u = getU(id);
  if (!u) return fail("User not found.");
  if (!u.blocked) return fail("User is not blocked.");
  const restore = fd.get("restore") === "on";
  let restored = 0;
  db.transaction(() => {
    db.prepare("UPDATE users SET blocked = 0, block_reason = NULL WHERE id = ?").run(id);
    if (restore) {
      // Only listings that were paused *because of the block* go live again.
      const rows = db.prepare(`SELECT l.id, l.expires_at FROM listings l WHERE l.user_id = ? AND l.status = 'paused'
        AND (SELECT action FROM moderation_logs m WHERE m.listing_id = l.id ORDER BY m.id DESC LIMIT 1) = 'paused_block'`).all(id) as { id: number; expires_at: string | null }[];
      const now = nowIso();
      for (const r of rows) {
        db.prepare("UPDATE listings SET status = 'live', expires_at = ?, updated_at = ? WHERE id = ?").run(r.expires_at && r.expires_at > now ? r.expires_at : addDays(LISTING_VALIDITY_DAYS), now, r.id);
        db.prepare("INSERT INTO moderation_logs (listing_id, actor_id, action, reason) VALUES (?,?,?,?)").run(r.id, me.id, "renewed", "Poster unblocked");
        restored++;
      }
    }
  })();
  await auditAs(me, "user.unblock", "user", id, { restored });
  notify(id, { kind: "system", title: "Your account is active again", body: restored ? `${restored} listing${restored > 1 ? "s are" : " is"} live again.` : "You can sign in and post again." }, ["sms", "email"]);
  return done(`User unblocked${restore ? `; ${restored} listing${restored === 1 ? "" : "s"} restored` : ""}.`);
}

export async function setListingLimit(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("users");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const n = int(fd, "limit");
  if (n == null || Number.isNaN(n) || n < 0 || n > 500) return fail("Enter a number between 0 and 500.", { limit: "0–500" });
  const u = db.prepare("SELECT free_listing_limit FROM users WHERE id = ?").get(id) as { free_listing_limit: number } | undefined;
  if (!u) return fail("User not found.");
  db.prepare("UPDATE users SET free_listing_limit = ? WHERE id = ?").run(n, id);
  await auditAs(me, "user.listing_limit", "user", id, { from: u.free_listing_limit, to: n });
  return done(`Free listing limit set to ${n}.`);
}

/* ---------------------------------------------------------------- staff (super only) */

export async function createStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("staff");
  if (!me) return NOT_ALLOWED;
  const phone = normalizePhone(str(fd, "phone"));
  const email = str(fd, "email") ? normalizeEmail(str(fd, "email")) : null;
  const name = str(fd, "name");
  const role = str(fd, "admin_role");
  const errors: Record<string, string> = {};
  if (!phone) errors.phone = "Enter a valid 10-digit mobile number";
  if (str(fd, "email") && !email) errors.email = "Invalid email";
  if (!ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) errors.admin_role = "Pick a role";
  if (Object.keys(errors).length) return fail("Fix the highlighted fields.", errors);
  const existing = db.prepare("SELECT id, role, admin_role, blocked FROM users WHERE phone = ? AND deleted_at IS NULL").get(phone) as { id: number; role: string; admin_role: string | null; blocked: number } | undefined;
  if (existing?.role === "admin") return fail("This number is already a staff account. Change its role in the table below.", { phone: "Already staff" });
  if (existing?.blocked) return fail("This user is blocked. Unblock them first.");
  if (email) {
    const other = db.prepare("SELECT id FROM users WHERE email = ? AND (? IS NULL OR id <> ?)").get(email, existing?.id ?? null, existing?.id ?? null);
    if (other) return fail("That email belongs to another account.", { email: "In use" });
  }
  let id: number;
  if (existing) {
    db.prepare("UPDATE users SET role = 'admin', admin_role = ?, name = COALESCE(NULLIF(?, ''), name), email = COALESCE(?, email) WHERE id = ?").run(role, name, email, existing.id);
    id = existing.id;
  } else {
    id = Number(db.prepare("INSERT INTO users (phone, email, name, role, admin_role) VALUES (?,?,?,'admin',?)").run(phone, email, name || null, role).lastInsertRowid);
    db.prepare("INSERT OR IGNORE INTO notification_prefs (user_id) VALUES (?)").run(id);
  }
  await auditAs(me, "staff.create", "user", id, { phone, role, previous_role: existing?.role ?? null });
  notify(id, { kind: "system", title: "You have been added to the 10cent admin team", body: `Role: ${role}. Sign in with your mobile number and open /admin.`, link: "/admin" }, ["sms", "email"]);
  return done(`${name || phone} added as ${role}. They can sign in with OTP on +91 ${phone}.`);
}

export async function changeStaffRole(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("staff");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const role = str(fd, "admin_role");
  if (!ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) return fail("Pick a role.");
  if (id === me.id) return fail("You can't change your own role.");
  const u = getU(id);
  if (!u || u.role !== "admin") return fail("Not a staff account.");
  if (u.admin_role === role) return fail(`Already ${role}.`);
  db.prepare("UPDATE users SET admin_role = ? WHERE id = ?").run(role, id);
  await auditAs(me, "staff.role", "user", id, { from: u.admin_role, to: role });
  return done(`Role changed to ${role}.`);
}

export async function revokeStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("staff");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  if (id === me.id) return fail("You can't revoke your own access.");
  const u = getU(id);
  if (!u || u.role !== "admin") return fail("Not a staff account.");
  if (u.admin_role === "super") {
    const supers = (db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'admin' AND admin_role = 'super' AND blocked = 0").get() as { n: number }).n;
    if (supers <= 1) return fail("At least one super admin must remain.");
  }
  db.transaction(() => {
    db.prepare("UPDATE users SET role = 'seeker', admin_role = NULL WHERE id = ?").run(id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  })();
  await auditAs(me, "staff.revoke", "user", id, { previous_role: u.admin_role });
  return done(`Staff access revoked for ${u.name ?? `user #${id}`}; they were signed out.`);
}

/* ---------------------------------------------------------------- AD4 fraud reports */

export async function resolveReport(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("reports");
  if (!me) return NOT_ALLOWED;
  const id = Number(fd.get("id"));
  const op = str(fd, "op");
  const note = str(fd, "note");
  const r = db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as { id: number; listing_id: number | null; reported_user_id: number | null; reporter_id: number | null; status: string; reason: string } | undefined;
  if (!r) return fail("Report not found.");
  if (op === "note") {
    if (note.length < 2) return fail("Write a note first.", { note: "Required" });
    db.prepare("UPDATE reports SET admin_note = TRIM(COALESCE(admin_note || char(10), '') || ?) WHERE id = ?").run(`${new Date().toISOString().slice(0, 10)} ${me.name ?? "staff"}: ${note}`, id);
    await auditAs(me, "report.note", "report", id, { note });
    return done("Note added.");
  }
  if (r.status !== "open") return fail(`Already ${r.status}.`);
  const resolve = (status: string, extra: string) => {
    db.prepare("UPDATE reports SET status = ?, resolved_at = ?, resolved_by = ?, admin_note = TRIM(COALESCE(admin_note || char(10), '') || ?) WHERE id = ?")
      .run(status, nowIso(), me.id, `${new Date().toISOString().slice(0, 10)} ${me.name ?? "staff"}: ${extra}${note ? ` (${note})` : ""}`, id);
  };
  const thank = () => {
    if (r.reporter_id) notify(r.reporter_id, { kind: "system", title: "Thanks, we acted on your report", body: "The listing or account you reported has been reviewed and action was taken.", link: r.listing_id ? `/property/${r.listing_id}` : undefined }, ["email"]);
  };
  if (op === "dismiss") {
    resolve("dismissed", "Dismissed");
    await auditAs(me, "report.dismiss", "report", id, { note });
    return done("Report dismissed.");
  }
  if (op === "takedown") {
    if (!r.listing_id) return fail("This report isn't about a listing.");
    const l = db.prepare("SELECT id, user_id, title, status FROM listings WHERE id = ?").get(r.listing_id) as { id: number; user_id: number; title: string; status: string } | undefined;
    if (!l) return fail("Listing no longer exists.");
    const reason = `Fraud report #${id}: ${r.reason.replace(/_/g, " ")}${note ? `. ${note}` : ""}`;
    if (l.status !== "removed") {
      db.prepare("UPDATE listings SET status = 'removed', reject_reason = ?, featured = 0, updated_at = ? WHERE id = ?").run(reason, nowIso(), l.id);
      db.prepare("INSERT INTO moderation_logs (listing_id, actor_id, action, reason) VALUES (?,?,?,?)").run(l.id, me.id, "takedown", reason);
      notify(l.user_id, { kind: "moderation", title: "Your listing was taken down", body: `“${l.title}” was removed after a user report (${r.reason.replace(/_/g, " ")}). Write to support@10cent.in to appeal.`, link: "/dashboard/listings" }, ["sms", "email"]);
    }
    resolve("actioned", `Listing #${l.id} taken down`);
    await auditAs(me, "report.takedown", "report", id, { listing: l.id });
    thank();
    return done(`Listing #${l.id} taken down; report closed and reporter notified.`);
  }
  if (op === "block") {
    if (!r.reported_user_id) return fail("No user attached to this report.");
    const reason = `Fraud report #${id}: ${r.reason.replace(/_/g, " ")}${note ? `. ${note}` : ""}`;
    const res = blockUserCore(me.id, r.reported_user_id, reason);
    if (typeof res === "string" && res !== "User is already blocked.") return fail(res);
    resolve("actioned", `User #${r.reported_user_id} blocked`);
    await auditAs(me, "report.block_user", "report", id, { user: r.reported_user_id, paused: typeof res === "string" ? 0 : res.paused });
    await auditAs(me, "user.block", "user", r.reported_user_id, { reason, via_report: id });
    thank();
    return done(`User blocked${typeof res === "string" ? " (already)" : `, ${res.paused} listings paused`}; report closed and reporter notified.`);
  }
  if (op === "action") {
    resolve("actioned", "Actioned");
    await auditAs(me, "report.action", "report", id, { note });
    thank();
    return done("Marked as actioned; reporter notified.");
  }
  return fail("Unknown action.");
}
