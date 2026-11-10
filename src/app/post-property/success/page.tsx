import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { btnClass, Container, Notice } from "@/components/ui";
import type { AutoFlags } from "@/lib/supply/listing-service";

export const metadata: Metadata = { title: "Listing submitted", robots: { index: false } };

export default async function SuccessPage({ searchParams }: PageProps<"/post-property/success">) {
  const sp = await searchParams;
  const id = Number(sp.id);
  const user = await requireUser(`/post-property/success?id=${id}`);
  const l = await db.prepare("SELECT id, title, status, user_id, auto_flags, created_at, verification_requested_at, verified FROM listings WHERE id = ?").get(id) as
    | { id: number; title: string; status: string; user_id: number; auto_flags: string | null; created_at: string; verification_requested_at: string | null; verified: number }
    | undefined;
  if (!l || (l.user_id !== user.id && user.role !== "admin")) notFound();
  const flags = l.auto_flags ? (JSON.parse(l.auto_flags) as Partial<AutoFlags>) : {};
  const edited = sp.edited === "1";

  return (
    <Container className="py-12 md:py-16 max-w-3xl">
      <CheckCircle2 size={40} className="text-trust" aria-hidden />
      <h1 className="font-display text-4xl md:text-5xl mt-4 leading-tight">{edited ? "Changes saved" : "Your listing is submitted"}</h1>
      <p className="text-ink-2 mt-2">
        <b>{l.title}</b> <span className="text-muted">· Listing #{l.id} · {formatDate(l.created_at)}</span>
      </p>

      {(flags.duplicate || flags.duplicateImages || flags.priceOutlier || flags.contactInDescription || flags.phoneValid === false) && (
        <Notice tone="warn" className="mt-6">
          <p className="font-medium">Our automated checks noted a few things the moderator will look at:</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            {flags.duplicate && <li>It looks similar to an existing listing (#{flags.duplicateOf}). If it&apos;s a different unit, mention the tower or flat number in the description.</li>}
            {flags.duplicateImages && <li>Some photos are already used on another listing. Use your own, recent photos.</li>}
            {flags.priceOutlier && <li>The price is far from the locality average ({flags.priceRatio}x). Double-check it isn&apos;t a typo.</li>}
            {flags.contactInDescription && <li>We removed phone numbers or emails from your description. Enquiries reach you through 10cent.</li>}
            {flags.phoneValid === false && <li>Your account has no verified mobile number. Add one so seekers can reach you.</li>}
          </ul>
        </Notice>
      )}

      <div className="mt-8 bg-card border border-line rounded-[var(--radius-md)] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">What happens next</p>
        <ol className="mt-4 space-y-5">
          {[
            ["Review", "A moderator checks the details and photos. Most listings go live within 24 hours."],
            ["Goes live", "We send you an SMS and email when it's approved. It stays live for 60 days and you can renew in one click."],
            ["Enquiries", "Seekers verify their phone with OTP before contacting you. Every enquiry shows up in your Responses inbox."],
          ].map(([t, b], i) => (
            <li key={t} className="flex gap-4">
              <span className="font-display text-2xl text-accent num w-7 shrink-0">{i + 1}</span>
              <div><p className="font-medium">{t}</p><p className="text-sm text-muted mt-0.5">{b}</p></div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/dashboard/listings?highlight=${l.id}`} className={btnClass("primary", "md")}>Go to my listings</Link>
        {!edited && <Link href="/post-property" className={btnClass("secondary", "md")}>Post another property</Link>}
        <Link href={`/dashboard/listings/${l.id}/edit`} className={btnClass("ghost", "md")}>Edit listing</Link>
      </div>
      {!l.verified && !l.verification_requested_at && (
        <p className="text-sm text-muted mt-6">Want the green <b className="text-trust">Verified</b> badge? Request a field visit from <Link href={`/dashboard/listings?highlight=${l.id}`} className="underline underline-offset-2">My listings</Link> once the listing is live.</p>
      )}
    </Container>
  );
}
