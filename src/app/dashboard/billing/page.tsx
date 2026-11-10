import { nowMs } from "@/lib/supply/time";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate, formatPaise } from "@/lib/format";
import { Badge, btnClass, Card, EmptyState } from "@/components/ui";
import { dashboardContext, listingQuota } from "@/lib/supply/account";
import { PageTitle, QuotaBar } from "@/components/supply/bits";

export const metadata: Metadata = { title: "Plan and billing", robots: { index: false } };

const TONE: Record<string, "trust" | "warn" | "danger" | "neutral"> = { paid: "trust", created: "warn", failed: "danger", refunded: "neutral" };
const LABEL: Record<string, string> = { paid: "Paid", created: "Awaiting payment", failed: "Failed", refunded: "Refunded" };

export default async function BillingPage() {
  const { subject } = await dashboardContext("/dashboard/billing");
  const q = listingQuota(subject.id);
  const orders = db.prepare(
    `SELECT o.*, p.name plan_name, c.code coupon_code, i.id invoice_id, i.number invoice_number
     FROM orders o JOIN plans p ON p.id = o.plan_id LEFT JOIN coupons c ON c.id = o.coupon_id LEFT JOIN invoices i ON i.order_id = o.id
     WHERE o.user_id = ? ORDER BY o.created_at DESC`
  ).all(subject.id) as Array<{ id: number; plan_name: string; coupon_code: string | null; total_paise: number; status: string; created_at: string; paid_at: string | null; gateway_ref: string | null; invoice_id: number | null; invoice_number: string | null }>;
  const subs = db.prepare("SELECT s.*, p.name FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = ? ORDER BY s.starts_at DESC LIMIT 10").all(subject.id) as Array<{ id: number; name: string; starts_at: string; ends_at: string; status: string }>;
  const daysLeft = q.plan ? Math.max(0, Math.ceil((new Date(q.plan.ends_at).getTime() - nowMs()) / 86400000)) : null;

  return (
    <div>
      <PageTitle eyebrow="Billing" title="Plan and billing" sub="GST invoices for every payment. Plans don't auto-renew." action={<Link href="/plans" className={btnClass(q.plan ? "secondary" : "accent", "md")}>{q.plan ? "Change plan" : "Upgrade plan"}</Link>} />
      <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-4">
        <Card className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Current plan</p>
          <p className="font-display text-4xl mt-1">{q.plan?.name ?? "Free"}</p>
          <p className="text-sm text-muted mt-1">
            {q.plan ? <>Active until {formatDate(q.plan.ends_at)} · <span className="num">{daysLeft}</span> days left · search boost level {q.plan.boost}</> : "3 free listings, 60 days each. No ranking boost."}
          </p>
          <QuotaBar used={q.used} limit={q.limit} className="mt-5 max-w-md" />
        </Card>
        <Card className="p-5 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Plan history</p>
          {subs.length === 0 ? <p className="text-muted mt-2">No paid plans yet.</p> : (
            <ul className="mt-2 divide-y divide-line">
              {subs.map((s) => (
                <li key={s.id} className="py-2 flex justify-between gap-2">
                  <span>{s.name}<span className="block text-xs text-muted">{formatDate(s.starts_at)} – {formatDate(s.ends_at)}</span></span>
                  <Badge tone={s.status === "active" && s.ends_at > new Date().toISOString() ? "trust" : "neutral"}>{s.status === "active" && s.ends_at <= new Date().toISOString() ? "expired" : s.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="font-display text-2xl mt-10 mb-3">Orders and invoices</h2>
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" body="When you buy a plan, the order and its GST invoice appear here." action={<Link href="/plans" className={btnClass("primary", "md")}>See plans</Link>} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-left text-xs text-muted border-b border-line">
              <tr><th className="font-medium px-4 py-2.5">Order</th><th className="font-medium px-3 py-2.5">Plan</th><th className="font-medium px-3 py-2.5">Date</th><th className="font-medium px-3 py-2.5 text-right">Total</th><th className="font-medium px-3 py-2.5">Status</th><th className="font-medium px-4 py-2.5">Invoice</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 num">#{o.id}</td>
                  <td className="px-3 py-3">{o.plan_name}{o.coupon_code && <span className="block text-xs text-muted">Coupon {o.coupon_code}</span>}</td>
                  <td className="px-3 py-3 num">{formatDate(o.paid_at ?? o.created_at)}</td>
                  <td className="px-3 py-3 text-right num">{formatPaise(o.total_paise)}</td>
                  <td className="px-3 py-3"><Badge tone={TONE[o.status] ?? "neutral"}>{LABEL[o.status] ?? o.status}</Badge></td>
                  <td className="px-4 py-3">
                    {o.invoice_id ? <Link href={`/invoices/${o.invoice_id}`} className="underline underline-offset-2 num">{o.invoice_number}</Link>
                      : o.status === "created" || o.status === "failed" ? <Link href={`/checkout/pay/${o.id}`} className="text-accent-ink font-medium hover:underline">{o.status === "failed" ? "Retry payment" : "Complete payment"}</Link>
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
