import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPaise } from "@/lib/format";
import { Badge, inputClass, cx } from "@/components/ui";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { Tabs, BILLING_TABS } from "@/components/admin/tabs";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/action-form";
import { savePlan, deletePlan } from "@/lib/admin/actions-billing";

export const metadata: Metadata = { title: "Billing · Plans" };

type Plan = { id: number; code: string; name: string; audience: string; price_paise: number; duration_days: number; listing_limit: number; boost: number; features: string | null; active: number; sort: number; orders: number; active_subs: number };

const lbl = "block text-[12px] font-medium text-ink-2";
const inp = cx(inputClass, "h-9 mt-1 text-[13px]");

function PlanForm({ p }: { p?: Plan }) {
  const feats = p?.features ? (JSON.parse(p.features) as string[]).join("\n") : "";
  return (
    <ActionForm action={savePlan} resetOnSuccess={!p} className="grid sm:grid-cols-2 gap-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <label className={lbl}>Name<input name="name" defaultValue={p?.name} className={inp} placeholder="Owner Plus" /><FieldError name="name" /></label>
      <label className={lbl}>Code<input name="code" defaultValue={p?.code} className={cx(inp, "font-mono")} placeholder="auto from name" /><FieldError name="code" /></label>
      <label className={lbl}>Audience
        <select name="audience" defaultValue={p?.audience ?? "owner"} className={inp}>
          <option value="owner">Owners</option><option value="agent">Agents</option><option value="builder">Builders</option>
        </select><FieldError name="audience" />
      </label>
      <label className={lbl}>Price (₹, before GST)<input name="price" inputMode="decimal" defaultValue={p ? p.price_paise / 100 : ""} className={cx(inp, "num")} placeholder="999" /><FieldError name="price" /></label>
      <label className={lbl}>Duration (days)<input name="duration_days" inputMode="numeric" defaultValue={p?.duration_days ?? 30} className={cx(inp, "num")} /><FieldError name="duration_days" /></label>
      <label className={lbl}>Active listing limit<input name="listing_limit" inputMode="numeric" defaultValue={p?.listing_limit ?? 5} className={cx(inp, "num")} /><FieldError name="listing_limit" /></label>
      <label className={lbl}>Search boost (0–5)<input name="boost" inputMode="numeric" defaultValue={p?.boost ?? 0} className={cx(inp, "num")} /><FieldError name="boost" /></label>
      <label className={lbl}>Sort order<input name="sort" inputMode="numeric" defaultValue={p?.sort ?? 10} className={cx(inp, "num")} /><FieldError name="sort" /></label>
      <label className={cx(lbl, "sm:col-span-2")}>Features <span className="font-normal text-muted">(one per line, shown on /plans)</span>
        <textarea name="features" rows={4} defaultValue={feats} className={cx(inputClass, "h-auto py-2 mt-1 text-[13px]")} />
        <FieldError name="features" />
      </label>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="active" defaultChecked={p ? !!p.active : true} className="accent-[var(--color-ink)]" /> Active (available to buy)</label>
      <div className="sm:col-span-2"><SubmitButton size="md">{p ? "Save plan" : "Create plan"}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function PlansPage() {
  await requireAdmin("billing");
  const plans = db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM orders o WHERE o.plan_id = p.id) orders,
    (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = p.id AND s.status = 'active') active_subs FROM plans p ORDER BY p.sort, p.id`).all() as Plan[];
  return (
    <div>
      <AdminHeader eyebrow="AD5 · Revenue" title="Billing" sub="Plans are shown on the public pricing page and the checkout. Prices are stored before GST (18% is added at checkout)." />
      <Tabs items={BILLING_TABS} current="/admin/billing/plans" />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
        <div className="space-y-3 min-w-0">
          {plans.map((p) => (
            <details key={p.id} className="bg-card border border-line rounded-[var(--radius-md)] group">
              <summary className="list-none cursor-pointer px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold">{p.name}</span>
                <span className="font-mono text-xs text-muted">{p.code}</span>
                <Badge>{p.audience}</Badge>
                {!p.active && <Badge tone="danger">Inactive</Badge>}
                <span className="ml-auto num text-[13px]"><strong>{formatPaise(p.price_paise).replace(/\.00$/, "")}</strong> <span className="text-muted">/ {p.duration_days} d · {p.listing_limit} listings · boost {p.boost}</span></span>
                <span className="text-xs text-muted w-full sm:w-auto">{p.orders} orders · {p.active_subs} active subs</span>
              </summary>
              <div className="px-4 pb-4 pt-1 border-t border-line">
                <div className="pt-3"><PlanForm p={p} /></div>
                <ActionForm action={deletePlan} className="mt-3 pt-3 border-t border-line">
                  <input type="hidden" name="id" value={p.id} />
                  <SubmitButton variant="ghost" className="text-danger" confirm={p.orders ? "This plan has orders; it will be deactivated, not deleted. Continue?" : "Delete this plan?"}>{p.orders ? "Deactivate plan" : "Delete plan"}</SubmitButton>
                </ActionForm>
              </div>
            </details>
          ))}
        </div>
        <Panel title="New plan"><PlanForm /></Panel>
      </div>
    </div>
  );
}
