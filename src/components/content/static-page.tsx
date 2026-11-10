import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { Breadcrumbs, Container } from "@/components/ui";
import { Markdown, headings, stripInline, parseBlocks } from "./markdown";

type Page = { slug: string; title: string; body: string; updated_at: string };

const NAV = [
  { slug: "about", label: "About 10cent" },
  { slug: "posting-policy", label: "Posting policy" },
  { slug: "terms", label: "Terms of use" },
  { slug: "privacy", label: "Privacy policy" },
];

const CORE_PAGES = new Set(NAV.map((n) => n.slug));
/** Public URL of a CMS page: the four core pages have their own routes, everything else lives under /info. */
export const staticPagePath = (slug: string) => (CORE_PAGES.has(slug) ? `/${slug}` : `/info/${slug}`);

async function getPage(slug: string) {
  return await db.prepare("SELECT * FROM static_pages WHERE slug = ?").get(slug) as Page | undefined;
}

export async function staticPageMetadata(slug: string): Promise<Metadata> {
  const p = await getPage(slug);
  if (!p) return { title: "Page not found" };
  const first = parseBlocks(p.body).find((b) => b.kind === "p");
  return {
    title: p.title,
    description: first ? stripInline(first.lines.join(" ")).slice(0, 160) : undefined,
    alternates: { canonical: staticPagePath(slug) },
  };
}

/** Renders a CMS-managed static page (about, terms, privacy, posting policy). */
export async function StaticPage({ slug }: { slug: string }) {
  const p = await getPage(slug);
  if (!p) notFound();
  const toc = headings(p.body);
  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: p.title }]} />
      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-10 mt-6">
        <aside className="order-2 lg:order-1">
          <nav aria-label="Company pages" className="lg:sticky lg:top-24 text-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-2">Company</div>
            <ul className="space-y-0.5 border-l border-line">
              {NAV.map((n) => (
                <li key={n.slug}>
                  <Link href={`/${n.slug}`} aria-current={n.slug === slug ? "page" : undefined} className={`block -ml-px pl-3 py-1.5 border-l ${n.slug === slug ? "border-ink text-ink font-medium" : "border-transparent text-ink-2 hover:text-ink"}`}>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
            {toc.length > 2 && (
              <>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mt-8 mb-2">On this page</div>
                <ul className="space-y-1.5">
                  {toc.map((h) => <li key={h.id}><a href={`#${h.id}`} className="text-ink-2 hover:text-ink">{h.text}</a></li>)}
                </ul>
              </>
            )}
          </nav>
        </aside>
        <article className="order-1 lg:order-2 max-w-[720px]">
          <h1 className="font-display text-5xl md:text-6xl leading-[1]">{p.title}</h1>
          <p className="text-xs text-muted mt-3">Last updated {formatDate(p.updated_at)}</p>
          <Markdown body={p.body} className="mt-6" />
          <p className="mt-10 pt-6 border-t border-line text-sm text-muted">
            Questions about this page? Write to <a className="text-accent-ink underline underline-offset-2" href="mailto:support@10cent.in">support@10cent.in</a>.
          </p>
        </article>
      </div>
    </Container>
  );
}
