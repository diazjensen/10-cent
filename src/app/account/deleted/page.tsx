import type { Metadata } from "next";
import Link from "next/link";
import { Container, btnClass } from "@/components/ui";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false } };

export default function Deleted() {
  return (
    <Container className="py-20">
      <div className="max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Done</p>
        <h1 className="font-display text-5xl leading-[1] mt-2">Your account has been deleted.</h1>
        <p className="mt-4 text-ink-2 leading-relaxed">
          We removed your name, phone number and email, your shortlist, saved searches, history, alerts and requirements, and took
          down any listings you had posted. Invoices for past payments are kept for 8 years as required by GST law, without your contact details.
        </p>
        <p className="mt-3 text-ink-2">You can sign up again any time with the same number; it will be a fresh account.</p>
        <Link href="/" className={btnClass("primary", "md", "mt-6")}>Back to 10cent</Link>
      </div>
    </Container>
  );
}
