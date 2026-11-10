import type { Metadata } from "next";
import Link from "next/link";
import { Container, btnClass } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <Container className="py-20 md:py-28">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Error 404</p>
        <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mt-3">This address doesn&apos;t exist.</h1>
        <p className="mt-5 text-ink-2 text-lg leading-relaxed">
          The listing may have been sold, rented or taken down by its owner, or the link was typed incorrectly.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/search" className={btnClass("primary", "lg")}>Search properties</Link>
          <Link href="/projects" className={btnClass("secondary", "lg")}>New projects</Link>
          <Link href="/" className={btnClass("ghost", "lg")}>Go to home</Link>
        </div>
        <div className="mt-12 pt-6 border-t border-line grid sm:grid-cols-3 gap-4 text-sm">
          <Link href="/tools/emi" className="hover:text-accent-ink">EMI calculator</Link>
          <Link href="/tools/price-trends" className="hover:text-accent-ink">Locality price trends</Link>
          <Link href="/news" className="hover:text-accent-ink">News &amp; guides</Link>
        </div>
      </div>
    </Container>
  );
}
