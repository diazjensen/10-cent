import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { inputClass, cx } from "@/components/ui";
import { AdminHeader, Panel, Table, Th, Td, EmptyRow, StatusBadge } from "@/components/admin/ui";
import { Tabs, BILLING_TABS } from "@/components/admin/tabs";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/action-form";
import { saveCoupon, deleteCoupon } from "@/lib/admin/actions-billing";

export const metadata: Metadata = { title: "Billing · Coupons" };

type Coupon = { id: number; code: string; percent_off: number; max_uses: number | null; used: number; expires_at: string | null; active: number; orders: number };
const inp = cx(inputClass, "h-9 text-[13px]");
const toDate = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 5.5 * 3600000).toISOString().slice(0, 10) : "");

export default async function CouponsPage() {
  await requireAdmin("billing");
  const rows = db.prepare("SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.coupon_id = c.id AND o.status = 'paid') orders FROM coupons c ORDER BY c.active DESC, c.id DESC").all() as Coupon[];
  const now = new Date().toISOString();
  return (
    <div>
      <AdminHeader eyebrow="AD5 · Revenue" title="Billing" sub="Percentage discounts applied at checkout before GST. A coupon stops working when it is inactive, expired or has hit its use limit." />
      <Tabs items={BILLING_TABS} current="/admin/billing/coupons" />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <Table>
          <thead><tr><Th>Code</Th><Th className="text-right">Off</Th><Th className="text-right">Used</Th><Th>Expires</Th><Th>Status</Th><Th className="text-right">Edit</Th></tr></thead>
          <tbody>
            {!rows.length && <EmptyRow cols={6}>No coupons yet.</EmptyRow>}
            {rows.map((c) => {
              const state = !c.active ? "inactive" : c.expires_at && c.expires_at < now ? "expired" : c.max_uses != null && c.used >= c.max_uses ? "used up" : "active";
              return (
                <tr key={c.id}>
                  <Td className="font-mono font-semibold">{c.code}</Td>
                  <Td className="text-right num">{c.percent_off}%</Td>
                  <Td className="text-right num">{c.used}{c.max_uses != null ? ` / ${c.max_uses}` : ""}<div className="text-xs text-muted">{c.orders} paid orders</div></Td>
                  <Td className="whitespace-nowrap">{c.expires_at ? formatDate(c.expires_at) : "Never"}</Td>
                  <Td><StatusBadge status={state === "active" ? "active" : state === "inactive" ? "cancelled" : "expired"} label={state} /></Td>
                  <Td className="text-right">
                    <details className="inline-block text-left">
                      <summary className="list-none cursor-pointer text-[13px] underline">Edit</summary>
                      <ActionForm action={saveCoupon} className="mt-2 w-64 grid grid-cols-2 gap-2">
                        <input type="hidden" name="id" value={c.id} />
                        <label className="col-span-2 text-xs text-muted">Code<input name="code" defaultValue={c.code} className={cx(inp, "font-mono uppercase")} /><FieldError name="code" /></label>
                        <label className="text-xs text-muted">% off<input name="percent_off" defaultValue={c.percent_off} className={inp} inputMode="numeric" /><FieldError name="percent_off" /></label>
                        <label className="text-xs text-muted">Max uses<input name="max_uses" defaultValue={c.max_uses ?? ""} className={inp} inputMode="numeric" placeholder="∞" /><FieldError name="max_uses" /></label>
                        <label className="col-span-2 text-xs text-muted">Expires on<input type="date" name="expires_at" defaultValue={toDate(c.expires_at)} className={inp} /><FieldError name="expires_at" /></label>
                        <label className="col-span-2 flex items-center gap-2 text-[13px]"><input type="checkbox" name="active" defaultChecked={!!c.active} className="accent-[var(--color-ink)]" /> Active</label>
                        <div className="col-span-2 flex gap-2"><SubmitButton>Save</SubmitButton></div>
                      </ActionForm>
                      <ActionForm action={deleteCoupon} className="mt-2">
                        <input type="hidden" name="id" value={c.id} />
                        <SubmitButton variant="ghost" className="text-danger" confirm={`Delete coupon ${c.code}?`}>{c.used || c.orders ? "Deactivate" : "Delete"}</SubmitButton>
                      </ActionForm>
                    </details>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <Panel title="New coupon">
          <ActionForm action={saveCoupon} resetOnSuccess className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block text-[12px] font-medium text-ink-2">Code<input name="code" placeholder="DIWALI25" className={cx(inp, "mt-1 font-mono uppercase")} /><FieldError name="code" /></label>
            <label className="block text-[12px] font-medium text-ink-2">% off<input name="percent_off" inputMode="numeric" placeholder="25" className={cx(inp, "mt-1")} /><FieldError name="percent_off" /></label>
            <label className="block text-[12px] font-medium text-ink-2">Max uses<input name="max_uses" inputMode="numeric" placeholder="Unlimited" className={cx(inp, "mt-1")} /><FieldError name="max_uses" /></label>
            <label className="col-span-2 block text-[12px] font-medium text-ink-2">Expires on<input type="date" name="expires_at" className={cx(inp, "mt-1")} /><FieldError name="expires_at" /></label>
            <label className="col-span-2 flex items-center gap-2 text-[13px]"><input type="checkbox" name="active" defaultChecked className="accent-[var(--color-ink)]" /> Active immediately</label>
            <div className="col-span-2"><SubmitButton size="md" pendingLabel="Creating…">Create coupon</SubmitButton></div>
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}
