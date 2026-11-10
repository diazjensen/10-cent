import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatPaise } from "@/lib/format";
import { btnClass, Container, Notice } from "@/components/ui";
import { payOrderAction } from "@/app/checkout/actions";
import type { OrderRow, Plan } from "@/lib/supply/billing";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

export default async function PayPage({ params, searchParams }: PageProps<"/checkout/pay/[orderId]">) {
  const { orderId } = await params;
  const sp = await searchParams;
  const id = Number(orderId);
  const user = await getUser();
  if (!user) redirect(`/login?next=/checkout/pay/${orderId}`);
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  if (!o || (o.user_id !== user.id && user.role !== "admin")) notFound();
  const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(o.plan_id) as Plan;
  const inv = db.prepare("SELECT id, number FROM invoices WHERE order_id = ?").get(id) as { id: number; number: string } | undefined;
  const sub = db.prepare("SELECT ends_at FROM subscriptions WHERE order_id = ?").get(id) as { ends_at: string } | undefined;
  const pay = payOrderAction.bind(null, id, "success");
  const fail = payOrderAction.bind(null, id, "failure");

  if (o.status === "paid") {
    return (
      <Container className="py-12 md:py-16 max-w-2xl">
        <CheckCircle2 size={40} className="text-trust" aria-hidden />
        <h1 className="font-display text-4xl md:text-5xl mt-4">Payment received</h1>
        <p className="text-ink-2 mt-2"><b>{plan.name}</b> is active{sub ? ` until ${formatDate(sub.ends_at)}` : ""}. Your live listings now rank higher and you can post up to <span className="num">{plan.listing_limit}</span> listings.</p>
        <dl className="mt-6 bg-card border border-line rounded-[var(--radius-md)] divide-y divide-line text-sm">
          {[["Order", `#${o.id}`], ["Payment reference", o.gateway_ref ?? "—"], ["Amount paid", formatPaise(o.total_paise)], ["Invoice", inv?.number ?? "—"], ["Paid on", formatDate(o.paid_at)]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 px-4 py-3"><dt className="text-muted">{k}</dt><dd className="num font-medium text-right">{v}</dd></div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          {inv && <Link href={`/invoices/${inv.id}`} className={btnClass("primary", "md")}>View tax invoice</Link>}
          <Link href="/dashboard" className={btnClass("secondary", "md")}>Go to dashboard</Link>
          <Link href="/post-property" className={btnClass("ghost", "md")}>Post property</Link>
        </div>
      </Container>
    );
  }
  if (o.status !== "created" && o.status !== "failed") {
    return (
      <Container className="py-16 max-w-xl">
        <h1 className="font-display text-4xl">Order #{o.id} is {o.status}</h1>
        <Link href="/dashboard/billing" className={btnClass("primary", "md", "mt-6")}>Back to billing</Link>
      </Container>
    );
  }

  return (
    <Container className="py-10 md:py-14 max-w-xl">
      {o.status === "failed" && (
        <div className="mb-6 flex gap-3 items-start">
          <XCircle className="text-danger shrink-0" size={28} aria-hidden />
          <div>
            <h1 className="font-display text-3xl">Payment failed</h1>
            <p className="text-sm text-muted mt-1">No money was deducted. You can try again below.</p>
          </div>
        </div>
      )}
      {sp.r === "error" && typeof sp.msg === "string" && <Notice tone="danger" className="mb-4">{sp.msg}</Notice>}
      <div className="bg-card border border-line rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-5 py-3 bg-warn-soft border-b border-warn/20 text-warn text-sm flex items-center gap-2">
          <FlaskConical size={16} aria-hidden /> <b>Test mode</b> — Razorpay keys not configured. No real money moves.
        </div>
        <div className="p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">10cent · Order #{o.id}</p>
          <p className="mt-2 font-medium">{plan.name}</p>
          <p className="num text-4xl font-semibold mt-1">{formatPaise(o.total_paise)}</p>
          <p className="text-xs text-muted mt-1">Incl. GST {formatPaise(o.gst_paise)}{o.discount_paise ? ` · discount ${formatPaise(o.discount_paise)}` : ""}</p>
          <div className="mt-6 grid gap-2">
            <form action={pay}><button className={btnClass("trust", "lg", "w-full")}>Pay successfully</button></form>
            <form action={fail}><button className={btnClass("secondary", "lg", "w-full")}>Simulate failure</button></form>
          </div>
          <p className="text-xs text-muted mt-4">When live keys are added, this screen is replaced by Razorpay Checkout (UPI, cards, netbanking) and the payment is confirmed by signature verification.</p>
        </div>
      </div>
      <p className="text-sm mt-4"><Link href="/dashboard/billing" className="text-ink-2 hover:underline">Cancel and go back to billing</Link></p>
    </Container>
  );
}
