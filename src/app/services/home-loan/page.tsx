import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { emi } from "@/lib/tools/emi";
import { formatINR } from "@/lib/format";
import { BANK_RATES, RATES_AS_OF } from "@/lib/content/services";
import { applyHomeLoan } from "../actions";
import { HomeLoanForm } from "@/components/content/service-forms";
import { Breadcrumbs, Container, Notice } from "@/components/ui";

export const metadata: Metadata = {
  title: "Compare home loan interest rates and apply",
  description: `Indicative home loan rates from SBI, HDFC Bank, ICICI Bank, Axis, Kotak, Bank of Baroda, PNB and LIC HFL as of ${RATES_AS_OF}. Get a free call from a loan advisor.`,
  alternates: { canonical: "/services/home-loan" },
};

export default async function HomeLoanPage() {
  const u = await getUser();
  const city = u?.preferred_cities ? (db.prepare("SELECT name FROM cities WHERE slug = ?").get(u.preferred_cities.split(",")[0]) as { name: string } | undefined)?.name : undefined;
  const me = u ? { name: u.name ?? "", phone: u.phone ?? "", email: u.email ?? "", city: city ?? "" } : null;
  const rows = [...BANK_RATES].sort((a, b) => a.min - b.min);
  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: "Home loans" }]} />
      <div className="mt-4 max-w-3xl">
        <h1 className="font-display text-[44px] md:text-[64px] leading-[1]">Home loans, compared.</h1>
        <p className="text-ink-2 mt-3 leading-relaxed">Starting rates from eight lenders side by side. Leave your details and a 10cent loan advisor will get you sanctioned offers from partner banks. The service is free for you; banks pay us a fee if your loan is disbursed.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-8 mt-8 items-start">
        <section>
          <Notice tone="warn" className="mb-3">Indicative rates as of {RATES_AS_OF}, for salaried borrowers with good credit scores. Your actual rate depends on your CIBIL score, income, loan amount and the lender&apos;s policy on the day.</Notice>
          <div className="overflow-x-auto bg-card border border-line rounded-[var(--radius-md)]">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-paper-2 text-xs text-muted text-left">
                <tr><th className="font-medium px-4 py-2.5">Lender</th><th className="font-medium px-4 py-2.5 text-right">Interest rate (p.a.)</th><th className="font-medium px-4 py-2.5 text-right">EMI per ₹1 L*</th><th className="font-medium px-4 py-2.5">Processing fee</th></tr>
              </thead>
              <tbody>
                {rows.map((b, i) => (
                  <tr key={b.bank} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">{b.bank}{i === 0 && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-trust">Lowest</span>}</td>
                    <td className="px-4 py-3 text-right num">{b.min.toFixed(2)}% – {b.max.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-right num">₹{formatINR(Math.round(emi(1_00_000, b.min, 240)))}</td>
                    <td className="px-4 py-3 text-ink-2 text-xs">{b.fee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-2">* At the starting rate for a 20-year tenure. Max tenure is 30 years at most lenders, subject to retirement age.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 text-sm">
            <Link href="/tools/eligibility" className="bg-card border border-line rounded-[var(--radius-md)] p-4 hover:border-ink-2"><div className="font-medium">Check eligibility</div><div className="text-xs text-muted mt-1">How much can you borrow on your salary?</div></Link>
            <Link href="/tools/emi" className="bg-card border border-line rounded-[var(--radius-md)] p-4 hover:border-ink-2"><div className="font-medium">EMI & prepayment</div><div className="text-xs text-muted mt-1">See the full amortisation schedule</div></Link>
            <Link href="/tools/stamp-duty" className="bg-card border border-line rounded-[var(--radius-md)] p-4 hover:border-ink-2"><div className="font-medium">Stamp duty</div><div className="text-xs text-muted mt-1">Costs your loan won&apos;t cover</div></Link>
          </div>
        </section>
        <aside className="bg-card border border-line rounded-[var(--radius-md)] p-5 md:p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-3xl">Get loan offers</h2>
          <p className="text-sm text-muted mt-1 mb-5">Takes a minute. No documents needed yet.</p>
          <HomeLoanForm me={me} action={applyHomeLoan} banks={rows.map((b) => b.bank)} />
        </aside>
      </div>
    </Container>
  );
}
