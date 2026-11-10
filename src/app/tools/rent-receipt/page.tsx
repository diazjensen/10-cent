import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/shell";
import { RentReceipt } from "@/components/tools/rent-receipt";

export const metadata: Metadata = {
  title: "Rent receipt generator for HRA",
  description: "Generate printable monthly rent receipts with landlord PAN for your HRA exemption claim. Free, works in your browser.",
  alternates: { canonical: "/tools/rent-receipt" },
};

export default function Page() {
  return (
    <ToolShell slug="rent-receipt" title="Rent receipt generator" intro="Employers ask for rent receipts to allow the HRA exemption. Fill in the details once and print a receipt for every month of the financial year.">
      <RentReceipt />
    </ToolShell>
  );
}
