import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/shell";
import { StampDutyCalculator } from "@/components/tools/stamp-duty-calculator";

export const metadata: Metadata = {
  title: "Stamp duty and registration charges calculator",
  description: "Stamp duty, cess and registration fee for property purchases in Karnataka, Maharashtra, Telangana, Tamil Nadu, Haryana, Delhi, UP, Gujarat, Kerala and West Bengal.",
  alternates: { canonical: "/tools/stamp-duty" },
};

export default function Page() {
  return (
    <ToolShell slug="stamp-duty" title="Stamp duty & registration" intro="What you pay the state when the sale deed is registered. These charges are not covered by a home loan, so plan for them in your down payment.">
      <StampDutyCalculator />
    </ToolShell>
  );
}
