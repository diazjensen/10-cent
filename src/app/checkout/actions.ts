"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { audit, db } from "@/lib/db";
import { STATES } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";
import { findCoupon, fulfilOrder, getPlan, quote, validateGstin, type OrderRow } from "@/lib/supply/billing";

export type CouponState = { ok: boolean; code?: string; percent?: number; error?: string } | null;

/** Validates a coupon for display; it is checked again when the order is created and when it's paid. */
export async function checkCouponAction(code: string): Promise<CouponState> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Log in again." };
  if (!(await rateLimit(`coupon:${user.id}`, 20, 600)).ok) return { ok: false, error: "Too many attempts. Try again in a few minutes." };
  if (!code.trim()) return { ok: false, error: "Enter a coupon code" };
  const r = await findCoupon(code);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, code: r.coupon.code, percent: r.coupon.percent_off };
}

export type CheckoutState = { errors?: Record<string, string>; message?: string; values?: { billing_name: string; gstin: string; state: string } } | null;

export async function createOrderAction(_prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const user = await getUser();
  if (!user) return { message: "Your session expired. Log in again." };
  const plan = await getPlan(String(fd.get("plan") ?? ""));
  if (!plan || plan.price_paise === 0) return { message: "This plan isn't available." };
  const name = String(fd.get("billing_name") ?? "").trim();
  const gstin = String(fd.get("gstin") ?? "").trim().toUpperCase();
  const state = String(fd.get("state") ?? "");
  const couponCode = String(fd.get("coupon") ?? "").trim();
  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 120) errors.billing_name = "Enter the name to print on the invoice";
  if (!(STATES as readonly string[]).includes(state)) errors.state = "Choose your state";
  else {
    const g = validateGstin(gstin, state);
    if (g) errors.gstin = g;
  }
  let couponId: number | null = null;
  let coupon = null;
  if (couponCode) {
    const c = await findCoupon(couponCode);
    if (!c.ok) errors.coupon = c.error;
    else { coupon = c.coupon; couponId = c.coupon.id; }
  }
  const role = user.role === "seeker" ? "owner" : user.role;
  if (role !== "admin" && plan.audience !== role) errors.form = `${plan.name} is for ${plan.audience}s. Your account is registered as ${role === "owner" ? "an owner" : `a ${role}`}; pick a plan from the ${role} section.`;
  if (Object.keys(errors).length) return { errors, values: { billing_name: name, gstin, state } };

  const q = quote(plan, coupon, state);
  const info = await db.prepare(
      "INSERT INTO orders (user_id, plan_id, coupon_id, amount_paise, discount_paise, gst_paise, total_paise, status, gateway) VALUES (?,?,?,?,?,?,?, 'created', 'test')"
    ).run(user.id, plan.id, couponId, q.amount, q.discount, q.gst, q.total);
  const orderId = Number(info.lastInsertRowid);
  await audit(user.id, "order.created", "order", orderId, { plan: plan.code, billing: { name, gstin: gstin || null, state }, coupon: coupon?.code ?? null });
  redirect(`/checkout/pay/${orderId}`);
}

/** Test gateway callback. In production this is replaced by Razorpay order + signature verification. */
export async function payOrderAction(orderId: number, outcome: "success" | "failure") {
  const user = await getUser();
  if (!user) redirect(`/login?next=/checkout/pay/${orderId}`);
  const o = await db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  if (!o || (o.user_id !== user.id && user.role !== "admin")) redirect("/dashboard/billing");
  if (o.status === "paid") redirect(`/checkout/pay/${orderId}`);
  if (outcome === "failure") {
    await db.prepare("UPDATE orders SET status = 'failed' WHERE id = ? AND status IN ('created','failed')").run(orderId);
    await audit(user.id, "order.failed", "order", orderId, { reason: "Simulated failure (test gateway)" });
    await notify(o.user_id, { kind: "billing", title: "Payment failed", body: `Payment for order #${orderId} didn't go through. No money was deducted. You can retry from Billing.`, link: `/checkout/pay/${orderId}` });
    redirect(`/checkout/pay/${orderId}?r=failed`);
  }
  const r = await fulfilOrder(orderId);
  revalidatePath("/dashboard", "layout");
  if (!r.ok) redirect(`/checkout/pay/${orderId}?r=error&msg=${encodeURIComponent(r.error)}`);
  redirect(`/checkout/pay/${orderId}?r=paid`);
}
