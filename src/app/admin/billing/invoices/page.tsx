import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPaise, formatDate } from "@/lib/format";
import { AdminHeader, FilterBar, FInput, Table, Th, Td, EmptyRow, StatusBadge, Pager, qs } from "@/components/admin/ui";
import { Tabs, BILLING_TABS } from "@/components/admin/tabs";

export const metadata: Metadata = { title: "Billing · Invoices" };
const PER = 30;

type Row = { id: number; number: string; billing_name: string | null; billing_gstin: string | null; billing_state: string | null; taxable_paise: number; cgst_paise: number; sgst_paise: number; igst_paise: number; total_paise: number; created_at: string; order_id: number; order_status: string; user_id: number; plan: string };

export default async function InvoicesPage({ searchParams }: PageProps<"/admin/billing/invoices">) {
  await requireAdmin("billing");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const q = s("q"), from = s("from"), to = s("to");
  const page = Math.max(1, Number(s("page")) || 1);
  const where = ["1=1"]; const args: unknown[] = [];
  if (q) { where.push("(i.number LIKE ? OR i.billing_name LIKE ? OR i.billing_gstin LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (from) { where.push("substr(i.created_at,1,10) >= ?"); args.push(from); }
  if (to) { where.push("substr(i.created_at,1,10) <= ?"); args.push(to); }
  const base = `FROM invoices i JOIN orders o ON o.id = i.order_id JOIN plans p ON p.id = o.plan_id WHERE ${where.join(" AND ")}`;
  const sum = db.prepare(`SELECT COUNT(*) n, SUM(i.taxable_paise) t, SUM(i.cgst_paise + i.sgst_paise) cs, SUM(i.igst_paise) ig, SUM(i.total_paise) tot ${base}`).get(...args) as { n: number; t: number | null; cs: number | null; ig: number | null; tot: number | null };
  const rows = db.prepare(`SELECT i.*, o.status order_status, o.user_id, p.name plan ${base} ORDER BY i.id DESC LIMIT ${PER} OFFSET ${(page - 1) * PER}`).all(...args) as Row[];

  return (
    <div>
      <AdminHeader eyebrow="AD5 · Revenue" title="Billing" sub="GST invoices raised on paid orders. Intra-state (Karnataka) invoices split CGST + SGST; others carry IGST." />
      <Tabs items={BILLING_TABS} current="/admin/billing/invoices" />
      <FilterBar action="/admin/billing/invoices" reset={!!(q || from || to)}>
        <FInput label="Number, name or GSTIN" name="q" defaultValue={q} className="w-56" />
        <FInput label="From" type="date" name="from" defaultValue={from} />
        <FInput label="To" type="date" name="to" defaultValue={to} />
      </FilterBar>
      <p className="text-[13px] text-muted mb-3 num">{sum.n} invoices · taxable {formatPaise(sum.t ?? 0)} · CGST+SGST {formatPaise(sum.cs ?? 0)} · IGST {formatPaise(sum.ig ?? 0)} · total {formatPaise(sum.tot ?? 0)}</p>
      <Table>
        <thead><tr><Th>Invoice</Th><Th>Billed to</Th><Th>Plan / order</Th><Th className="text-right">Taxable</Th><Th className="text-right">GST</Th><Th className="text-right">Total</Th></tr></thead>
        <tbody>
          {!rows.length && <EmptyRow cols={6}>No invoices match.</EmptyRow>}
          {rows.map((i) => (
            <tr key={i.id}>
              <Td className="whitespace-nowrap"><a href={`/invoices/${i.id}`} target="_blank" className="font-mono text-[12.5px] underline">{i.number}</a><div className="text-xs text-muted">{formatDate(i.created_at)}</div></Td>
              <Td><Link href={`/admin/users/${i.user_id}`} className="hover:underline">{i.billing_name || "—"}</Link><div className="text-xs text-muted">{i.billing_state}{i.billing_gstin ? ` · ${i.billing_gstin}` : ""}</div></Td>
              <Td>{i.plan}<div className="text-xs text-muted flex items-center gap-1.5">#{i.order_id} <StatusBadge status={i.order_status} /></div></Td>
              <Td className="text-right num">{formatPaise(i.taxable_paise)}</Td>
              <Td className="text-right num whitespace-nowrap">{i.igst_paise ? `IGST ${formatPaise(i.igst_paise)}` : `C+S ${formatPaise(i.cgst_paise + i.sgst_paise)}`}</Td>
              <Td className="text-right num font-medium">{formatPaise(i.total_paise)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager page={page} pages={Math.max(1, Math.ceil(sum.n / PER))} href={(p) => qs("/admin/billing/invoices", { q, from, to, page: p })} />
    </div>
  );
}
