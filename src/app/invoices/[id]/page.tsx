import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { HOME_STATE } from "@/lib/constants";
import { formatDate, formatPaise } from "@/lib/format";
import { Container } from "@/components/ui";
import { Logo } from "@/components/logo";
import { PrintButton } from "@/components/supply/print-button";
import { rupeesInWords } from "@/lib/supply/words";
import { GST_STATE_CODE } from "@/lib/supply/billing";

export const metadata: Metadata = { title: "Tax invoice", robots: { index: false } };

// Supplier details come from environment so the legal entity can be set without code changes.
const SUPPLIER = {
  name: process.env.COMPANY_LEGAL_NAME || "10cent",
  address: process.env.COMPANY_ADDRESS || "Registered office address not configured",
  gstin: process.env.COMPANY_GSTIN || "GSTIN not configured",
  state: HOME_STATE,
};

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=/invoices/${id}`);
  const inv = db.prepare(
    `SELECT i.*, o.user_id, o.amount_paise, o.discount_paise, o.gateway_ref, o.paid_at, o.id order_id, p.name plan_name, p.duration_days, c.code coupon_code, u.phone, u.email
     FROM invoices i JOIN orders o ON o.id = i.order_id JOIN plans p ON p.id = o.plan_id LEFT JOIN coupons c ON c.id = o.coupon_id JOIN users u ON u.id = o.user_id
     WHERE i.id = ?`
  ).get(Number(id)) as
    | { id: number; number: string; billing_name: string | null; billing_gstin: string | null; billing_state: string | null; taxable_paise: number; cgst_paise: number; sgst_paise: number; igst_paise: number; total_paise: number; created_at: string; user_id: number; amount_paise: number; discount_paise: number; gateway_ref: string | null; paid_at: string | null; order_id: number; plan_name: string; duration_days: number; coupon_code: string | null; phone: string | null; email: string | null }
    | undefined;
  if (!inv) notFound();
  const isAdmin = user.role === "admin" && ["super", "sales"].includes(user.admin_role ?? "");
  if (inv.user_id !== user.id && !isAdmin) notFound();
  const intra = inv.igst_paise === 0 && (inv.cgst_paise > 0 || inv.billing_state === HOME_STATE);

  return (
    <Container className="py-8 max-w-4xl">
      <style>{`@media print { body > a, body > header, body > footer, .no-print { display: none !important; } body { background: #fff; } .invoice { border: none !important; box-shadow: none !important; padding: 0 !important; } main { padding: 0 !important; } @page { margin: 14mm; } }`}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-5">
        <Link href={user.id === inv.user_id ? "/dashboard/billing" : "/admin"} className="text-sm text-ink-2 hover:underline">← Back to billing</Link>
        <PrintButton />
      </div>
      <article className="invoice bg-card border border-line rounded-[var(--radius-md)] p-6 md:p-10 text-sm">
        <header className="flex flex-wrap justify-between gap-6 items-start">
          <div>
            <Logo />
            <p className="mt-3 font-medium">{SUPPLIER.name}</p>
            <p className="text-muted max-w-xs">{SUPPLIER.address}</p>
            <p className="text-muted">GSTIN: <span className="num">{SUPPLIER.gstin}</span> · State: {SUPPLIER.state} ({GST_STATE_CODE[SUPPLIER.state]})</p>
          </div>
          <div className="text-right">
            <h1 className="font-display text-4xl">Tax invoice</h1>
            <p className="mt-2"><span className="text-muted">Invoice no. </span><b className="num">{inv.number}</b></p>
            <p><span className="text-muted">Date </span><span className="num">{formatDate(inv.created_at)}</span></p>
            <p><span className="text-muted">Order </span><span className="num">#{inv.order_id}</span></p>
          </div>
        </header>

        <section className="mt-8 grid sm:grid-cols-2 gap-6 border-t border-line pt-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Billed to</p>
            <p className="mt-1.5 font-medium">{inv.billing_name || "—"}</p>
            {inv.billing_gstin && <p className="num">GSTIN: {inv.billing_gstin}</p>}
            <p className="text-muted">{[inv.email, inv.phone && `+91 ${inv.phone}`].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Place of supply</p>
            <p className="mt-1.5">{inv.billing_state} ({GST_STATE_CODE[inv.billing_state ?? ""] ?? "—"})</p>
            <p className="text-muted">{intra ? "Intra-state supply: CGST + SGST" : "Inter-state supply: IGST"}</p>
            <p className="text-muted">Reverse charge: No</p>
          </div>
        </section>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead className="text-left text-xs text-muted border-y border-line">
              <tr><th className="font-medium py-2.5 pr-3">Description</th><th className="font-medium py-2.5 px-3">SAC</th><th className="font-medium py-2.5 px-3 text-right">Qty</th><th className="font-medium py-2.5 pl-3 text-right">Amount</th></tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="py-3 pr-3"><p className="font-medium">{inv.plan_name} subscription</p><p className="text-xs text-muted">Online property listing and advertising services, {inv.duration_days} days</p></td>
                <td className="py-3 px-3 num">998365</td>
                <td className="py-3 px-3 text-right num">1</td>
                <td className="py-3 pl-3 text-right num">{formatPaise(inv.amount_paise)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 ml-auto max-w-xs space-y-1.5">
          {inv.discount_paise > 0 && <Line k={`Discount${inv.coupon_code ? ` (${inv.coupon_code})` : ""}`} v={`− ${formatPaise(inv.discount_paise)}`} />}
          <Line k="Taxable value" v={formatPaise(inv.taxable_paise)} />
          {intra ? (
            <>
              <Line k="CGST @ 9%" v={formatPaise(inv.cgst_paise)} />
              <Line k="SGST @ 9%" v={formatPaise(inv.sgst_paise)} />
            </>
          ) : (
            <Line k="IGST @ 18%" v={formatPaise(inv.igst_paise)} />
          )}
          <div className="flex justify-between border-t border-ink pt-2 mt-2 text-base font-semibold"><span>Total</span><span className="num">{formatPaise(inv.total_paise)}</span></div>
        </div>
        <p className="mt-4 text-right text-xs text-ink-2">{rupeesInWords(inv.total_paise)}</p>

        <footer className="mt-10 pt-5 border-t border-line text-xs text-muted grid sm:grid-cols-2 gap-4">
          <p>Paid on {formatDate(inv.paid_at)} via online payment · Ref <span className="num">{inv.gateway_ref}</span></p>
          <p className="sm:text-right">This is a computer-generated invoice and does not require a signature.</p>
        </footer>
      </article>
    </Container>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted">{k}</span><span className="num">{v}</span></div>;
}
