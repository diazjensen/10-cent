import Link from "next/link";
import { Container, btnClass } from "@/components/ui";

export default function PropertyNotFound() {
  return (
    <Container className="py-20 max-w-xl text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">404</p>
      <h1 className="font-display text-5xl mt-3">This property isn&apos;t available</h1>
      <p className="text-ink-2 mt-4">It may have been sold, rented, paused by the poster or removed after review.</p>
      <div className="mt-8 flex justify-center gap-2">
        <Link href="/search" className={btnClass("primary", "md")}>Search similar homes</Link>
        <Link href="/account/shortlist" className={btnClass("secondary", "md")}>Your shortlist</Link>
      </div>
    </Container>
  );
}
