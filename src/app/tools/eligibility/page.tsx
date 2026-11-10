import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/shell";
import { EligibilityCalculator } from "@/components/tools/eligibility-calculator";

export const metadata: Metadata = {
  title: "Home loan eligibility and affordability calculator",
  description: "Find the maximum home loan you can get on your income and existing EMIs, and the property price you can afford with your savings.",
  alternates: { canonical: "/tools/eligibility" },
};

export default function Page() {
  return (
    <ToolShell slug="eligibility" title="Loan eligibility & affordability" intro="Banks size a home loan by how much of your income can go to EMIs (FOIR). Combine that with your savings and RBI's loan-to-value limits to get a realistic budget.">
      <EligibilityCalculator />
    </ToolShell>
  );
}
