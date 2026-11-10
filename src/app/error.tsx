"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Container, btnClass } from "@/components/ui";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <Container className="py-20 md:py-28">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Something broke</p>
        <h1 className="font-display text-5xl md:text-6xl leading-[0.95] mt-3">We couldn&apos;t load this page.</h1>
        <p className="mt-5 text-ink-2 text-lg leading-relaxed">
          It&apos;s a problem on our side, not yours. Try again in a moment. If it keeps happening, write to{" "}
          <a href="mailto:support@10cent.in" className="text-accent-ink underline underline-offset-2">support@10cent.in</a>
          {digest ? <> and quote reference <code className="num text-sm bg-paper-2 px-1.5 py-0.5 rounded">{digest}</code></> : null}.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className={btnClass("primary", "lg")}>Try again</button>
          <Link href="/" className={btnClass("secondary", "lg")}>Go to home</Link>
        </div>
      </div>
    </Container>
  );
}
