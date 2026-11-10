import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { pgInt, pageNum } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { formatPaise, formatPhone, formatDate } from "@/lib/format";
import { inputClass, cx } from "@/components/ui";
import { AdminHeader, FilterBar, FInput, FSelect, Table, Th, Td, EmptyRow, StatusBadge, Pager, qs, Kpi } from "@/components/admin/ui";
import { Tabs, BILLING_TABS } from "@/components/admin/tabs";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/action-form";
import { refundOrder } from "@/lib/admin/actions-billing";

export const metadata: Metadata = { title: "Billing · Orders" };
const PER = 25;

type Row = { id: number; user_id: number; name: string | null; phone: string | null; plan: string; audience: string; coupon: string | null; amount_paise: number; discount_paise: number; gst_paise: number; total_paise: number; status: string; gateway: string; gateway_ref: string | null; created_at: string; paid_at: string | null; refunded_at: string | null; invoice_id: number | null; invoice_no: string | null };

export default async function OrdersPage({ searchParams }: PageProps<"/admin/billing">) {
  await requireAdmin("billing");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const status = s("status"), plan = s("plan"), phone = s("phone").replace(/\D/g, ""), from = s("from"), to = s("to"), id = s("id").replace("#", "");
  const page = pageNum(s("page"));
  const where = ["1=1"]; const args: unknown[] = [];
  if (id) { where.push("o.id = ?"); args.push(pgInt(id)); }
  if (status) { where.push("o.status = ?"); args.push(status); }
  if (plan) { where.push("o.plan_id = ?"); args.push(pgInt(plan)); }
  if (phone) { where.push("u.phone LIKE ?"); args.push(`%${phone}%`); }
  if (from) { where.push("substr(o.created_at,1,10) >= ?"); args.push(from); }
  if (to) { where.push("substr(o.created_at,1,10) <= ?"); args.push(to); }
  const base = `FROM orders o JOIN users u ON u.id = o.user_id JOIN plans p ON p.id = o.plan_id LEFT JOIN coupons c ON c.id = o.coupon_id LEFT JOIN invoices i ON i.order_id = o.id WHERE ${where.join(" AND ")}`;
  const sum = await db.prepare(`SELECT COUNT(*) n, SUM(CASE WHEN o.status='paid' THEN o.total_paise END) paid, SUM(CASE WHEN o.status='refunded' THEN o.total_paise END) refunded, SUM(CASE WHEN o.status='paid' THEN o.gst_paise END) gst ${base}`).get(...args) as { n: number; paid: number | null; refunded: number | null; gst: number | null };
  const rows = await db.prepare(`SELECT o.*, u.name, u.phone, p.name plan, p.audience, c.code coupon, i.id invoice_id, i.number invoice_no ${base} ORDER BY o.id DESC LIMIT ${PER} OFFSET ${(page - 1) * PER}`).all(...args) as Row[];
  const plans = await db.prepare("SELECT id, name FROM plans ORDER BY sort").all() as { id: number; name: string }[];
  const params = { status, plan, phone, from, to, id };

  return (
    <div>
      <AdminHeader eyebrow="AD5 · Revenue" title="Billing" sub="Orders from the plans checkout. Refunding cancels the linked subscription and removes the plan's search boost." />
      <Tabs items={BILLING_TABS} current="/admin/billing" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Orders (filtered)" value={sum.n} />
        <Kpi label="Collected" value={formatPaise(sum.paid ?? 0)} tone="trust" />
        <Kpi label="GST in collected" value={formatPaise(sum.gst ?? 0)} />
        <Kpi label="Refunded" value={formatPaise(sum.refunded ?? 0)} />
      </div>
      <FilterBar action="/admin/billing" reset={Object.values(params).some(Boolean)}>
        <FInput label="Order #" name="id" defaultValue={id} className="w-24" />
        <FInput label="User phone" name="phone" defaultValue={phone} className="w-36" inputMode="numeric" />
        <FSelect label="Status" name="status" defaultValue={status}>
          <option value="">Any</option>
          {["created", "paid", "failed", "refunded"].map((x) => <option key={x} value={x}>{x}</option>)}
        </FSelect>
        <FSelect label="Plan" name="plan" defaultValue={plan}>
          <option value="">Any</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </FSelect>
        <FInput label="From" type="date" name="from" defaultValue={from} />
        <FInput label="To" type="date" name="to" defaultValue={to} />
      </FilterBar>
      <Table>
        <thead><tr><Th>Order</Th><Th>Customer</Th><Th>Plan</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th>Invoice</Th><Th className="text-right">Refund</Th></tr></thead>
        <tbody>
          {!rows.length && <EmptyRow cols={7}>No orders match.</EmptyRow>}
          {rows.map((o) => (
            <tr key={o.id} className="hover:bg-paper/40">
              <Td className="whitespace-nowrap"><span className="num font-medium">#{o.id}</span><div className="text-xs text-muted">{formatDate(o.created_at)}</div><div className="text-[11px] text-muted font-mono">{o.gateway}{o.gateway_ref ? ` · ${o.gateway_ref}` : ""}</div></Td>
              <Td className="whitespace-nowrap"><Link href={`/admin/users/${o.user_id}`} className="hover:underline">{o.name || "—"}</Link><div className="text-xs text-muted num">{formatPhone(o.phone)}</div></Td>
              <Td>{o.plan}<div className="text-xs text-muted capitalize">{o.audience}{o.coupon ? ` · ${o.coupon}` : ""}</div></Td>
              <Td className="text-right num whitespace-nowrap">{formatPaise(o.total_paise)}<div className="text-xs text-muted">incl. GST {formatPaise(o.gst_paise)}{o.discount_paise ? ` · −${formatPaise(o.discount_paise)}` : ""}</div></Td>
              <Td><StatusBadge status={o.status} />{o.refunded_at && <div className="text-xs text-muted mt-0.5">{formatDate(o.refunded_at)}</div>}</Td>
              <Td className="whitespace-nowrap">{o.invoice_id ? <a href={`/invoices/${o.invoice_id}`} target="_blank" className="underline num text-[12.5px]">{o.invoice_no}</a> : <span className="text-muted">—</span>}</Td>
              <Td className="text-right">
                {o.status === "paid" && (
                  <details className="inline-block text-left">
                    <summary className="list-none cursor-pointer text-[13px] text-danger hover:underline">Refund…</summary>
                    <ActionForm action={refundOrder} className="mt-2 w-60 space-y-2">
                      <input type="hidden" name="id" value={o.id} />
                      <input name="reason" placeholder="Reason, e.g. duplicate payment" aria-label="Refund reason" className={cx(inputClass, "h-9 text-[13px]")} />
                      <FieldError name="reason" />
                      <SubmitButton variant="danger" confirm={`Refund ${formatPaise(o.total_paise)} for order #${o.id} and cancel the plan?`}>Refund {formatPaise(o.total_paise)}</SubmitButton>
                    </ActionForm>
                  </details>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager page={page} pages={Math.max(1, Math.ceil(sum.n / PER))} href={(p) => qs("/admin/billing", { ...params, page: p })} />
    </div>
  );
}
