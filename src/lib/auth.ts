import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, nowIso, addDays } from "./db";
import { rateLimit } from "./rate-limit";
import { queueMessage } from "./notify";
import type { AdminRole } from "./constants";

export const SESSION_COOKIE = "tc_session";
const SESSION_DAYS = 30;
const OTP_TTL_MIN = 10;
const OTP_MAX_ATTEMPTS = 5;

export type User = {
  id: number;
  phone: string | null;
  email: string | null;
  name: string | null;
  role: "seeker" | "owner" | "agent" | "builder" | "admin";
  admin_role: AdminRole | null;
  kyc_status: string;
  blocked: number;
  is_nri: number;
  preferred_cities: string | null;
  budget_min: number | null;
  budget_max: number | null;
  free_listing_limit: number;
  created_at: string;
};

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Dev mode: OTPs are returned to the client and shown on screen, because no SMS provider is configured. */
export const OTP_DEV_MODE = !process.env.SMS_PROVIDER_KEY;

export function normalizePhone(input: string): string | null {
  const d = input.replace(/\D/g, "");
  const ten = d.length === 12 && d.startsWith("91") ? d.slice(2) : d.length === 11 && d.startsWith("0") ? d.slice(1) : d;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

export function normalizeEmail(input: string): string | null {
  const e = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "local";
}

/** Create and "send" an OTP to a phone number or email. */
export async function sendOtp(target: string): Promise<{ ok: true; devCode?: string } | { ok: false; error: string }> {
  const ip = await clientIp();
  const perTarget = await rateLimit(`otp:t:${target}`, 5, 3600);
  const perIp = await rateLimit(`otp:ip:${ip}`, 20, 3600);
  if (!perTarget.ok || !perIp.ok) return { ok: false, error: "Too many OTP requests. Please try again in a while." };

  const code = String(crypto.randomInt(100000, 1000000));
  await db.prepare("UPDATE otps SET consumed = 1 WHERE target = ? AND consumed = 0").run(target);
  await db.prepare("INSERT INTO otps (target, code_hash, expires_at, ip) VALUES (?,?,?,?)").run(
        target, sha(`${target}:${code}`), new Date(Date.now() + OTP_TTL_MIN * 60000).toISOString(), ip
      );
  const isEmail = target.includes("@");
  await queueMessage(isEmail ? "email" : "sms", target, `${code} is your 10cent verification code. It expires in ${OTP_TTL_MIN} minutes. Do not share it with anyone.`, "Your 10cent code");
  return OTP_DEV_MODE ? { ok: true, devCode: code } : { ok: true };
}

/** Verify an OTP; on success creates the user if needed and starts a session. */
export async function verifyOtp(target: string, code: string, extra?: { name?: string; role?: string }): Promise<{ ok: true; user: User; isNew: boolean } | { ok: false; error: string }> {
  const row = await db.prepare(
      "SELECT * FROM otps WHERE target = ? AND consumed = 0 ORDER BY id DESC LIMIT 1"
    ).get(target) as { id: number; code_hash: string; expires_at: string; attempts: number } | undefined;
  if (!row) return { ok: false, error: "Request a new OTP." };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: "OTP expired. Request a new one." };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: "Too many wrong attempts. Request a new OTP." };
  const good = crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(sha(`${target}:${code.trim()}`)));
  if (!good) {
    await db.prepare("UPDATE otps SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    return { ok: false, error: "Incorrect OTP." };
  }
  // Atomic single-use: a concurrent verify of the same code loses this race instead of creating a duplicate user.
  const claimed = await db.prepare("UPDATE otps SET consumed = 1 WHERE id = ? AND consumed = 0").run(row.id);
  if (!claimed.changes) return { ok: false, error: "This code was already used. Request a new OTP." };

  const isEmail = target.includes("@");
  let user = await db.prepare(`SELECT * FROM users WHERE ${isEmail ? "email" : "phone"} = ?`).get(target) as User & { deleted_at: string | null } | undefined;
  let isNew = false;
  if (user?.deleted_at) {
    // A deleted account's identifiers were already scrubbed; this branch is defensive.
    user = undefined;
  }
  if (!user) {
    const allowedRoles = ["seeker", "owner", "agent", "builder"];
    const role = extra?.role && allowedRoles.includes(extra.role) ? extra.role : "seeker";
    const info = await db.prepare(`INSERT INTO users (${isEmail ? "email" : "phone"}, name, role) VALUES (?,?,?)`).run(target, extra?.name?.trim() || null, role);
    await db.prepare("INSERT OR IGNORE INTO notification_prefs (user_id) VALUES (?)").run(info.lastInsertRowid);
    user = await db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid) as User & { deleted_at: string | null };
    isNew = true;
  }
  if (user.blocked) return { ok: false, error: "This account has been blocked. Contact support@10cent.in." };
  await db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(nowIso(), user.id);
  await createSession(user.id);
  return { ok: true, user, isNew };
}

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)").run(sha(token), userId, addDays(SESSION_DAYS));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha(token));
  jar.delete(SESSION_COOKIE);
}

/** Current logged-in user, or null. Safe to call from any server component / action / route. */
export async function getUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await db.prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.deleted_at IS NULL AND u.blocked = 0`
    ).get(sha(token), nowIso()) as User | undefined;
  return row ?? null;
}

/** Redirects to /login if not signed in. */
export async function requireUser(next = "/"): Promise<User> {
  const u = await getUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

export function isSupply(u: User | null) {
  return !!u && ["owner", "agent", "builder", "admin"].includes(u.role);
}

/**
 * Role-based access for the admin panel (PRD AD1).
 * super can do everything; other roles get their own areas.
 */
export const ADMIN_PERMISSIONS: Record<string, AdminRole[]> = {
  dashboard: ["super", "moderator", "support", "sales", "content"],
  moderation: ["super", "moderator"],
  users: ["super", "moderator", "support"],
  reports: ["super", "moderator", "support"],
  billing: ["super", "sales"],
  projects: ["super", "sales", "moderator"],
  banners: ["super", "sales"],
  cms: ["super", "content"],
  analytics: ["super", "sales", "content"],
  audit: ["super"],
  outbox: ["super", "support"],
  staff: ["super"],
};

export function can(u: User | null, area: keyof typeof ADMIN_PERMISSIONS | string) {
  if (!u || u.role !== "admin" || !u.admin_role) return false;
  return (ADMIN_PERMISSIONS[area] ?? ["super"]).includes(u.admin_role);
}

export async function requireAdmin(area: string): Promise<User> {
  const u = await getUser();
  if (!u) redirect(`/login?next=/admin`);
  if (u.role !== "admin" || !u.admin_role) redirect("/?denied=admin");
  if (!can(u, area)) redirect("/admin?denied=1");
  return u;
}
