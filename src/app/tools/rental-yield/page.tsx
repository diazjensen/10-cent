import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/shell";
import { YieldCalculator } from "@/components/tools/yield-calculator";

export const metadata: Metadata = {
  title: "Rental yield and ROI calculator",
  description: "Gross and net rental yield after maintenance, vacancy and tax, plus a five-year return including price appreciation.",
  alternates: { canonical: "/tools/rental-yield" },
};

export default function Page() {
  return (
    <ToolShell slug="rental-yield" title="Rental yield & ROI" intro="Residential rents in Indian metros usually return 2–4% gross. See what is left after maintenance, empty months and tax, and how much of the return depends on price growth.">
      <YieldCalculator />
    </ToolShell>
  );
}
