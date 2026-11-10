"use server";

import { redirect } from "next/navigation";
import { sendOtp, verifyOtp, destroySession, normalizePhone, normalizeEmail, getUser } from "@/lib/auth";
import { db } from "@/lib/db";

export type OtpState = { step: "start" | "verify"; target?: string; devCode?: string; error?: string; isEmail?: boolean };

export async function requestOtpAction(_prev: OtpState, form: FormData): Promise<OtpState> {
  const raw = String(form.get("target") ?? "");
  const isEmail = raw.includes("@");
  const target = isEmail ? normalizeEmail(raw) : normalizePhone(raw);
  if (!target) return { step: "start", error: isEmail ? "Enter a valid email address." : "Enter a valid 10-digit Indian mobile number." };
  const r = await sendOtp(target);
  if (!r.ok) return { step: "start", error: r.error };
  return { step: "verify", target, devCode: r.devCode, isEmail };
}

export async function verifyOtpAction(_prev: OtpState, form: FormData): Promise<OtpState> {
  const target = String(form.get("target") ?? "");
  const code = String(form.get("code") ?? "");
  const name = String(form.get("name") ?? "");
  const role = String(form.get("role") ?? "seeker");
  const next = String(form.get("next") ?? "/");
  if (!/^\d{6}$/.test(code.trim())) return { step: "verify", target, error: "Enter the 6-digit code.", isEmail: target.includes("@") };
  const r = await verifyOtp(target, code, { name, role });
  if (!r.ok) return { step: "verify", target, error: r.error, isEmail: target.includes("@") };
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (r.isNew && !r.user.name) redirect(`/account/profile?welcome=1&next=${encodeURIComponent(safeNext)}`);
  redirect(safeNext);
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

/** Lightweight endpoint used by client widgets (header, contact forms) to know who is signed in. */
export async function whoAmI() {
  const u = await getUser();
  if (!u) return null;
  const unread = (db.prepare("SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read = 0").get(u.id) as { n: number }).n;
  return { id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role, admin_role: u.admin_role, unread };
}
