import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { btnClass, Card } from "@/components/ui";
import { dashboardContext, listingQuota } from "@/lib/supply/account";
import { PageTitle, QuotaBar } from "@/components/supply/bits";
import { BulkForm } from "@/components/supply/bulk-form";

export const metadata: Metadata = { title: "Bulk upload", robots: { index: false } };

export default async function BulkPage() {
  const { subject } = await dashboardContext("/dashboard/bulk");
  if (!["agent", "builder", "admin"].includes(subject.role)) redirect("/dashboard");
  const q = listingQuota(subject.id);
  return (
    <div className="max-w-4xl">
      <PageTitle eyebrow="Listings" title="Bulk upload" sub="Add many listings at once from a spreadsheet. Each row is validated and goes through the same checks as the form." />
      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4 mb-6">
        <Card className="p-5">
          <ol className="space-y-3 text-sm text-ink-2">
            <li><b className="text-ink">1. Download the template.</b> It has the exact column headers and two example rows; delete the examples before uploading.</li>
            <li><b className="text-ink">2. Fill one listing per row.</b> Use city and locality names as shown on 10cent. Separate multiple values (tenant types, amenities) with <code className="font-mono">|</code>. Dates are YYYY-MM-DD; possession is YYYY-MM.</li>
            <li><b className="text-ink">3. Upload.</b> Valid rows become listings under review; rows with problems are listed so you can fix and re-upload just those. Add photos to each listing afterwards.</li>
          </ol>
          <a href="/api/dashboard/bulk-template" className={btnClass("secondary", "sm", "mt-4")} download><Download size={14} /> Download CSV template</a>
        </Card>
        <Card className="p-5">
          <QuotaBar used={q.used} limit={q.limit} />
          <p className="text-xs text-muted mt-3">Rows beyond your remaining <b className="num">{q.remaining}</b> listings are rejected with a &quot;limit reached&quot; error.</p>
        </Card>
      </div>
      <BulkForm />
    </div>
  );
}
