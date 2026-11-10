import Link from "next/link";
import type { ReactNode } from "react";
import { TOOLS } from "@/lib/tools/list";
import { Breadcrumbs, Container, cx } from "@/components/ui";

/** Common frame for every tool page: breadcrumb, heading, tool switcher. */
export function ToolShell({ slug, title, intro, children, wide }: { slug: string; title: string; intro: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Tools", href: "/tools" }, { label: title }]} />
      <div className="mt-4 mb-8 max-w-3xl">
        <h1 className="font-display text-[40px] md:text-[56px] leading-[1]">{title}</h1>
        <p className="mt-3 text-ink-2 leading-relaxed">{intro}</p>
      </div>
      <nav aria-label="Other tools" className="-mx-4 px-4 md:mx-0 md:px-0 mb-8 flex gap-1.5 overflow-x-auto scrollbar-none print:hidden">
        {TOOLS.map((t) => (
          <Link key={t.slug} href={`/tools/${t.slug}`} aria-current={t.slug === slug ? "page" : undefined}
            className={cx("shrink-0 h-8 px-3 inline-flex items-center rounded-full text-[13px] border", t.slug === slug ? "bg-ink text-white border-ink" : "bg-card border-line text-ink-2 hover:border-ink-2")}>
            {t.title}
          </Link>
        ))}
      </nav>
      <div className={wide ? "" : ""}>{children}</div>
    </Container>
  );
}
