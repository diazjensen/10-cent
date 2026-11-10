import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/shell";
import { EmiCalculator } from "@/components/tools/emi-calculator";

export const metadata: Metadata = {
  title: "Home loan EMI calculator with prepayment",
  description: "Calculate your home loan EMI, total interest and full amortisation schedule. See how much a part-prepayment saves in interest and tenure.",
  alternates: { canonical: "/tools/emi" },
};

export default async function EmiPage({ searchParams }: PageProps<"/tools/emi">) {
  const sp = await searchParams;
  const amount = Number(sp.amount) || 50_00_000;
  return (
    <ToolShell slug="emi" title="Home loan EMI calculator" intro="Monthly instalment on a reducing-balance loan, the interest you pay over the tenure, and what a part-prepayment does to both.">
      <EmiCalculator initialAmount={Math.min(10_00_00_000, Math.max(1_00_000, amount))} />
    </ToolShell>
  );
}
