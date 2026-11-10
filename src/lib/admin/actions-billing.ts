"use server";

import { z } from "zod";
import { db, nowIso } from "@/lib/db";
import { notify } from "@/lib/notify";
import { slugify, formatPaise } from "@/lib/format";
import { pgInt, staff, auditAs, done, fail, NOT_ALLOWED, str, int, bool, zodErrors, type ActionState } from "./guard";

const planSchema = z.object({
  code: z.string().regex(/^[a-z0-9_]{3,40}$/, "3–40 chars: a–z, 0–9, _"),
  name: z.string().trim().min(2, "Required").max(60),
  audience: z.enum(["owner", "agent", "builder"], { message: "Pick an audience" }),
  price: z.number({ message: "Enter a price" }).min(0, "Can't be negative").max(10_000_000, "Too high"),
  duration_days: z.number({ message: "Required" }).int().min(1, "At least 1 day").max(730),
  listing_limit: z.number({ message: "Required" }).int().min(1).max(10000),
  boost: z.number().int().min(0).max(5, "0–5"),
  sort: z.number().int().min(0).max(999),
  features: z.array(z.string().trim().min(1).max(120)).max(15, "Up to 15 features"),
});

export async function savePlan(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("billing");
  if (!me) return NOT_ALLOWED;
  const id = pgInt(fd.get("id")) || null;
  const priceRaw = str(fd, "price").replace(/[,₹\s]/g, "");
  const parsed = planSchema.safeParse({
    code: str(fd, "code") || slugify(str(fd, "name")).replace(/-/g, "_"),
    name: str(fd, "name"),
    audience: str(fd, "audience"),
    price: priceRaw === "" ? undefined : Number(priceRaw),
    duration_days: int(fd, "duration_days") ?? undefined,
    listing_limit: int(fd, "listing_limit") ?? undefined,
    boost: int(fd, "boost") ?? 0,
    sort: int(fd, "sort") ?? 0,
    features: str(fd, "features").split("\n").map((s) => s.trim()).filter(Boolean),
  });
  if (!parsed.success) return fail("Fix the highlighted fields.", zodErrors(parsed.error.issues));
  const v = parsed.data;
  const clash = await db.prepare("SELECT id FROM plans WHERE code = ? AND id IS DISTINCT FROM ?::int").get(v.code, id);
  if (clash) return fail("Another plan uses this code.", { code: "Already used" });
  const paise = Math.round(v.price * 100);
  const active = bool(fd, "active");
  if (id) {
    const before = await db.prepare("SELECT * FROM plans WHERE id = ?").get(id);
    if (!before) return fail("Plan not found.");
    await db.prepare("UPDATE plans SET code=?, name=?, audience=?, price_paise=?, duration_days=?, listing_limit=?, boost=?, features=?, active=?, sort=? WHERE id = ?")
            .run(v.code, v.name, v.audience, paise, v.duration_days, v.listing_limit, v.boost, JSON.stringify(v.features), active, v.sort, id);
    await auditAs(me, "plan.update", "plan", id, { before, after: { ...v, price_paise: paise, active } });
    return done(`Plan “${v.name}” saved.`);
  }
  const newId = Number((await db.prepare("INSERT INTO plans (code, name, audience, price_paise, duration_days, listing_limit, boost, features, active, sort) VALUES (?,?,?,?,?,?,?,?,?,?)")
          .run(v.code, v.name, v.audience, paise, v.duration_days, v.listing_limit, v.boost, JSON.stringify(v.features), active, v.sort)).lastInsertRowid);
  await auditAs(me, "plan.create", "plan", newId, { ...v, price_paise: paise });
  return done(`Plan “${v.name}” created.`);
}

export async function deletePlan(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("billing");
  if (!me) return NOT_ALLOWED;
  const id = pgInt(fd.get("id"));
  const used = (await db.prepare("SELECT COUNT(*) n FROM orders WHERE plan_id = ?").get(id) as { n: number }).n;
  if (used) {
    await db.prepare("UPDATE plans SET active = 0 WHERE id = ?").run(id);
    await auditAs(me, "plan.deactivate", "plan", id, { reason: "has orders" });
    return done(`Plan has ${used} orders, so it was deactivated instead of deleted.`);
  }
  await db.prepare("DELETE FROM plans WHERE id = ?").run(id);
  await auditAs(me, "plan.delete", "plan", id);
  return done("Plan deleted.");
}

const couponSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{4,20}$/, "4–20 letters/digits"),
  percent_off: z.number({ message: "Required" }).int().min(1, "1–90").max(90, "1–90"),
  max_uses: z.number().int().min(1, "At least 1").max(1_000_000).nullable(),
  expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date").nullable(),
});

export async function saveCoupon(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("billing");
  if (!me) return NOT_ALLOWED;
  const id = pgInt(fd.get("id")) || null;
  const parsed = couponSchema.safeParse({
    code: str(fd, "code").toUpperCase(),
    percent_off: int(fd, "percent_off") ?? undefined,
    max_uses: int(fd, "max_uses"),
    expires_at: str(fd, "expires_at") || null,
  });
  if (!parsed.success) return fail("Fix the highlighted fields.", zodErrors(parsed.error.issues));
  const v = parsed.data;
  if (!id && v.expires_at && v.expires_at < new Date().toISOString().slice(0, 10)) return fail("Expiry is in the past.", { expires_at: "In the past" });
  const clash = await db.prepare("SELECT id FROM coupons WHERE code = ? AND id IS DISTINCT FROM ?::int").get(v.code, id);
  if (clash) return fail("A coupon with this code exists.", { code: "Already exists" });
  const exp = v.expires_at ? new Date(v.expires_at + "T23:59:59+05:30").toISOString() : null;
  const active = bool(fd, "active");
  if (id) {
    const before = await db.prepare("SELECT * FROM coupons WHERE id = ?").get(id) as { used: number } | undefined;
    if (!before) return fail("Coupon not found.");
    if (v.max_uses != null && v.max_uses < before.used) return fail(`Already used ${before.used} times.`, { max_uses: `At least ${before.used}` });
    await db.prepare("UPDATE coupons SET code=?, percent_off=?, max_uses=?, expires_at=?, active=? WHERE id = ?").run(v.code, v.percent_off, v.max_uses, exp, active, id);
    await auditAs(me, "coupon.update", "coupon", id, { before, after: { ...v, active } });
    return done(`Coupon ${v.code} saved.`);
  }
  const newId = Number((await db.prepare("INSERT INTO coupons (code, percent_off, max_uses, expires_at, active) VALUES (?,?,?,?,?)").run(v.code, v.percent_off, v.max_uses, exp, active)).lastInsertRowid);
  await auditAs(me, "coupon.create", "coupon", newId, v);
  return done(`Coupon ${v.code} created: ${v.percent_off}% off.`);
}

export async function deleteCoupon(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("billing");
  if (!me) return NOT_ALLOWED;
  const id = pgInt(fd.get("id"));
  const c = await db.prepare("SELECT code, used FROM coupons WHERE id = ?").get(id) as { code: string; used: number } | undefined;
  if (!c) return fail("Coupon not found.");
  const used = (await db.prepare("SELECT COUNT(*) n FROM orders WHERE coupon_id = ?").get(id) as { n: number }).n;
  if (used || c.used) {
    await db.prepare("UPDATE coupons SET active = 0 WHERE id = ?").run(id);
    await auditAs(me, "coupon.deactivate", "coupon", id);
    return done(`${c.code} has been used, so it was deactivated instead of deleted.`);
  }
  await db.prepare("DELETE FROM coupons WHERE id = ?").run(id);
  await auditAs(me, "coupon.delete", "coupon", id, { code: c.code });
  return done(`${c.code} deleted.`);
}

export async function refundOrder(_p: ActionState, fd: FormData): Promise<ActionState> {
  const me = await staff("billing");
  if (!me) return NOT_ALLOWED;
  const id = pgInt(fd.get("id"));
  const reason = str(fd, "reason");
  if (reason.length < 4) return fail("Write a short refund reason.", { reason: "Required" });
  const o = await db.prepare("SELECT o.*, p.name plan FROM orders o JOIN plans p ON p.id = o.plan_id WHERE o.id = ?").get(id) as { id: number; user_id: number; status: string; total_paise: number; gateway_ref: string | null; plan: string } | undefined;
  if (!o) return fail("Order not found.");
  if (o.status !== "paid") return fail(`Only paid orders can be refunded (this one is ${o.status}).`);
  let cancelled = 0;
  let raced = false;
  await db.transaction(async () => {
        // Conditional update so a double click / two admins cannot refund (and notify) twice.
        const won = await db.prepare("UPDATE orders SET status = 'refunded', refunded_at = ? WHERE id = ? AND status = 'paid'").run(nowIso(), id);
        if (!won.changes) { raced = true; return; }
        cancelled = (await db.prepare("UPDATE subscriptions SET status = 'cancelled', ends_at = ? WHERE order_id = ? AND status = 'active'").run(nowIso(), id)).changes;
        const stillActive = await db.prepare("SELECT MAX(p.boost) b FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = ? AND s.status = 'active' AND s.ends_at > ?").get(o.user_id, nowIso()) as { b: number | null };
        await db.prepare("UPDATE listings SET boost = ? WHERE user_id = ? AND boost > ?").run(stillActive.b ?? 0, o.user_id, stillActive.b ?? 0);
      })();
  if (raced) return fail("This order was already refunded.");
  await auditAs(me, "order.refund", "order", id, { reason, amount_paise: o.total_paise, gateway_ref: o.gateway_ref, subscriptions_cancelled: cancelled });
  await notify(o.user_id, { kind: "billing", title: "Refund processed", body: `${formatPaise(o.total_paise)} for ${o.plan} (order #${id}) will reach your original payment method in 5–7 working days. The plan has been cancelled.`, link: "/dashboard/billing" }, ["sms", "email"]);
  return done(`Order #${id} refunded (${formatPaise(o.total_paise)}); ${cancelled} subscription${cancelled === 1 ? "" : "s"} cancelled.`);
}
