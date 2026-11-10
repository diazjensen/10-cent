import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Calculator, Wallet, Ruler, TrendingUp, Gauge, Landmark, Percent, ReceiptText } from "lucide-react";
import { TOOLS } from "@/lib/tools/list";
import { Breadcrumbs, Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Property tools and calculators",
  description: "Free home-loan EMI, eligibility, stamp duty, area conversion, rental yield and price trend tools for Indian property buyers and owners.",
  alternates: { canonical: "/tools" },
};

const ICONS = { emi: Calculator, eligibility: Wallet, "area-converter": Ruler, "price-trends": TrendingUp, valuation: Gauge, "stamp-duty": Landmark, "rental-yield": Percent, "rent-receipt": ReceiptText } as const;

export default function ToolsIndex() {
  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Tools" }]} />
      <div className="mt-4 mb-10 max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Research before you sign</p>
        <h1 className="font-display text-[44px] md:text-[64px] leading-[0.98] mt-2">Calculators that show their working.</h1>
        <p className="mt-4 text-ink-2 leading-relaxed max-w-2xl">
          Every number on these pages comes from a formula you can see: RBI loan-to-value slabs, state stamp duty schedules and
          10cent&apos;s locality price index. Nothing here needs an account.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-line">
        {TOOLS.map((t) => {
          const Icon = ICONS[t.slug];
          return (
            <Link key={t.slug} href={`/tools/${t.slug}`} className="group bg-card border-r border-b border-line p-5 md:p-6 hover:bg-paper-2 transition-colors flex flex-col min-h-[190px]">
              <div className="flex items-start justify-between">
                <span className="w-10 h-10 grid place-items-center rounded-full bg-accent-soft text-accent-ink"><Icon size={18} aria-hidden /></span>
                <ArrowUpRight size={16} className="text-muted group-hover:text-ink" aria-hidden />
              </div>
              <h2 className="mt-5 font-medium text-[17px]">{t.title}</h2>
              <p className="mt-1 text-sm text-muted leading-relaxed">{t.blurb}</p>
            </Link>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-muted max-w-3xl">
        Results are estimates for planning. Banks decide eligibility on their own credit policy, and stamp duty is charged on the
        higher of agreement value and the government guidance value.
      </p>
    </Container>
  );
}
