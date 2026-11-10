import "server-only";
import crypto from "node:crypto";
import { db, nowIso, addDays } from "@/lib/db";
import { GST_RATE, HOME_STATE } from "@/lib/constants";
import { notify } from "@/lib/notify";

export type Plan = { id: number; code: string; name: string; audience: string; price_paise: number; duration_days: number; listing_limit: number; boost: number; features: string | null; active: number; sort: number };
export type Coupon = { id: number; code: string; percent_off: number; max_uses: number | null; used: number; expires_at: string | null; active: number };
export type Billing = { name: string; gstin: string | null; state: string };

/** GST state codes (first two digits of a GSTIN). */
export const GST_STATE_CODE: Record<string, string> = {
  "Andhra Pradesh": "37", Assam: "18", Bihar: "10", Chhattisgarh: "22", Delhi: "07", Goa: "30", Gujarat: "24", Haryana: "06",
  "Himachal Pradesh": "02", Jharkhand: "20", Karnataka: "29", Kerala: "32", "Madhya Pradesh": "23", Maharashtra: "27",
  Odisha: "21", Punjab: "03", Rajasthan: "08", "Tamil Nadu": "33", Telangana: "36", "Uttar Pradesh": "09", Uttarakhand: "05", "West Bengal": "19",
};

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function validateGstin(raw: string, state: string): string | null {
  const g = raw.trim().toUpperCase();
  if (!g) return null;
  if (!GSTIN_RE.test(g)) return "GSTIN should be 15 characters, like 29ABCDE1234F1Z5";
  const code = GST_STATE_CODE[state];
  if (code && g.slice(0, 2) !== code) return `This GSTIN is registered in another state (code ${g.slice(0, 2)}); ${state} is ${code}`;
  return null;
}

export async function getPlan(code: string) {
  return await db.prepare("SELECT * FROM plans WHERE code = ? AND active = 1").get(code) as Plan | undefined;
}

export async function findCoupon(code: string): Promise<{ ok: true; coupon: Coupon } | { ok: false; error: string }> {
  const c = await db.prepare("SELECT * FROM coupons WHERE lower(code) = lower(?)").get(code.trim()) as Coupon | undefined;
  if (!c || !c.active) return { ok: false, error: "This coupon code isn't valid" };
  if (c.expires_at && c.expires_at < nowIso()) return { ok: false, error: "This coupon has expired" };
  if (c.max_uses != null && c.used >= c.max_uses) return { ok: false, error: "This coupon has been fully redeemed" };
  return { ok: true, coupon: c };
}

/** Price breakdown in paise. CGST+SGST for intra-state supply (HOME_STATE), IGST otherwise. */
export function quote(plan: Plan, coupon: Coupon | null, state: string) {
  const amount = plan.price_paise;
  const discount = coupon ? Math.round((amount * coupon.percent_off) / 100) : 0;
  const taxable = amount - discount;
  const gst = Math.round(taxable * GST_RATE);
  const intra = state === HOME_STATE;
  const cgst = intra ? Math.floor(gst / 2) : 0;
  const sgst = intra ? gst - cgst : 0;
  const igst = intra ? 0 : gst;
  return { amount, discount, taxable, gst, cgst, sgst, igst, total: taxable + gst, intra };
}

export function financialYear(d = new Date()) {
  // Indian FY runs April to March. Use IST for the boundary.
  const ist = new Date(d.getTime() + 5.5 * 3600000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export async function nextInvoiceNumber() {
  const fy = financialYear();
  const prefix = `10C/${fy}/`;
  // Serialise invoice numbering across concurrent payments (lock is released when the surrounding transaction ends).
  await db.prepare("SELECT pg_advisory_xact_lock(hashtext('invoice-number'))").get();
  const last = await db.prepare("SELECT number FROM invoices WHERE number LIKE ? ORDER BY number DESC LIMIT 1").get(`${prefix}%`) as { number: string } | undefined;
  const n = last ? parseInt(last.number.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(5, "0")}`;
}

/** Billing details captured at checkout, stored with the order's audit trail until the invoice is issued. */
export async function orderBilling(orderId: number): Promise<Billing | null> {
  const row = await db.prepare("SELECT details FROM audit_logs WHERE entity = 'order' AND entity_id = ? AND action = 'order.created' ORDER BY id DESC LIMIT 1").get(orderId) as { details: string } | undefined;
  if (!row) return null;
  try {
    const d = JSON.parse(row.details) as { billing?: Billing };
    return d.billing ?? null;
  } catch {
    return null;
  }
}

export type OrderRow = { id: number; user_id: number; plan_id: number; coupon_id: number | null; amount_paise: number; discount_paise: number; gst_paise: number; total_paise: number; status: string; gateway: string; gateway_ref: string | null; created_at: string; paid_at: string | null };

/**
 * Marks an order paid and fulfils it atomically: invoice, subscription, coupon usage,
 * listing quota and ranking boost (PRD O4).
 */
export async function fulfilOrder(orderId: number): Promise<{ ok: true; invoiceId: number } | { ok: false; error: string }> {
  let invoiceId = 0;
  let planName = "";
  let userId = 0;
  try {
    await db.transaction(async () => {
            const o = await db.prepare("SELECT * FROM orders WHERE id = ? FOR UPDATE").get(orderId) as OrderRow | undefined;
            if (!o) throw new Error("Order not found");
            if (o.status === "paid") {
              invoiceId = (await db.prepare("SELECT id FROM invoices WHERE order_id = ?").get(orderId) as { id: number }).id;
              return;
            }
            if (o.status !== "created" && o.status !== "failed") throw new Error(`Order is ${o.status}`);
            const plan = await db.prepare("SELECT * FROM plans WHERE id = ?").get(o.plan_id) as Plan;
            if (o.coupon_id) {
              const c = await db.prepare("SELECT * FROM coupons WHERE id = ?").get(o.coupon_id) as Coupon;
              if (c.max_uses != null && c.used >= c.max_uses) throw new Error("Coupon was fully redeemed before payment completed");
              await db.prepare("UPDATE coupons SET used = used + 1 WHERE id = ?").run(c.id);
            }
            const now = nowIso();
            const ref = `pay_test_${crypto.randomBytes(7).toString("hex")}`;
            await db.prepare("UPDATE orders SET status = 'paid', gateway_ref = ?, paid_at = ? WHERE id = ?").run(ref, now, orderId);
            const b = await orderBilling(orderId) ?? { name: "", gstin: null, state: HOME_STATE };
            const taxable = o.amount_paise - o.discount_paise;
            const intra = b.state === HOME_STATE;
            const cgst = intra ? Math.floor(o.gst_paise / 2) : 0;
            const sgst = intra ? o.gst_paise - cgst : 0;
            const info = await db.prepare(
                    "INSERT INTO invoices (order_id, number, billing_name, billing_gstin, billing_state, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise) VALUES (?,?,?,?,?,?,?,?,?,?)"
                  ).run(orderId, await nextInvoiceNumber(), b.name, b.gstin, b.state, taxable, cgst, sgst, intra ? 0 : o.gst_paise, o.total_paise);
            invoiceId = Number(info.lastInsertRowid);
            // One active plan at a time: the new purchase supersedes the old one.
            await db.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'").run(o.user_id);
            await db.prepare("INSERT INTO subscriptions (user_id, plan_id, order_id, starts_at, ends_at, status) VALUES (?,?,?,?,?, 'active')").run(o.user_id, plan.id, orderId, now, addDays(plan.duration_days));
            await db.prepare("UPDATE users SET free_listing_limit = GREATEST(free_listing_limit, ?) WHERE id = ?").run(plan.listing_limit, o.user_id);
            await db.prepare("UPDATE listings SET boost = ?, premium = ? WHERE user_id = ? AND status = 'live'").run(plan.boost, plan.boost >= 2 ? 1 : 0, o.user_id);
            await db.prepare("INSERT INTO audit_logs (actor_id, action, entity, entity_id, details) VALUES (?, 'order.paid', 'order', ?, ?)").run(o.user_id, orderId, JSON.stringify({ gateway_ref: ref, invoice_id: invoiceId }));
            planName = plan.name;
            userId = o.user_id;
          })();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (userId) {
    await notify(userId, { kind: "billing", title: `${planName} is active`, body: "Payment received. Your invoice is ready to download.", link: `/invoices/${invoiceId}` }, ["sms", "email"]);
  }
  return { ok: true, invoiceId };
}
