import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { Container } from "@/components/ui";
import { FraudForm } from "@/components/property/fraud-form";

export const metadata: Metadata = {
  title: "Report fraud",
  description: "Report a fake listing, a broker posing as an owner, or anyone asking for money before a visit. Reviewed within 24 hours.",
};

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const [sp, user] = await Promise.all([searchParams, getUser()]);
  const listing = typeof sp.listing === "string" ? sp.listing.slice(0, 300) : undefined;
  return (
    <Container className="py-10 md:py-16 pb-24">
      <div className="grid lg:grid-cols-[1fr_520px] gap-10 lg:gap-16 items-start max-w-5xl mx-auto">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Trust and safety</p>
          <h1 className="font-display text-[44px] md:text-[60px] leading-[0.98] mt-3">Report fraud</h1>
          <p className="mt-4 text-ink-2 leading-relaxed max-w-md">Tell us about fake listings, brokers posing as owners, or anyone who asked you for money before a visit. A person on our team reviews every report within 24 hours.</p>
          <ol className="mt-8 space-y-5 max-w-md text-sm text-ink-2">
            <li className="flex gap-3"><span className="font-display text-2xl text-accent leading-none w-6">1</span><span><strong className="text-ink font-medium">Never pay a token before visiting.</strong> 10cent does not collect booking amounts, and genuine owners don&apos;t need one to show a home.</span></li>
            <li className="flex gap-3"><span className="font-display text-2xl text-accent leading-none w-6">2</span><span><strong className="text-ink font-medium">Check the RERA number</strong> on the state portal for any under-construction project before you book.</span></li>
            <li className="flex gap-3"><span className="font-display text-2xl text-accent leading-none w-6">3</span><span><strong className="text-ink font-medium">Repeat offenders are blocked.</strong> Listings found to be fake are taken down and the poster&apos;s account is suspended.</span></li>
          </ol>
          <p className="mt-8 text-xs text-muted max-w-md">Lost money already? Report it to the National Cyber Crime portal at cybercrime.gov.in or call 1930, then let us know here so we can act on the account.</p>
        </div>
        <div className="bg-card border border-line rounded-[var(--radius-lg)] p-6 md:p-8">
          <FraudForm initialListing={listing} signedIn={!!user} />
        </div>
      </div>
    </Container>
  );
}
