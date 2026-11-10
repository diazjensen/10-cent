import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getUser, can } from "@/lib/auth";
import { ARTICLE_CATEGORIES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Markdown, headings } from "@/components/content/markdown";
import { Breadcrumbs, Container, Notice } from "@/components/ui";

const CAT_LABEL: Record<string, string> = Object.fromEntries(ARTICLE_CATEGORIES.map((c) => [c.value, c.label]));

type Article = { id: number; slug: string; title: string; category: string; author_name: string; excerpt: string | null; body: string; cover_url: string | null; city_id: number | null; city: string | null; city_slug: string | null; seo_title: string | null; seo_description: string | null; status: string; published_at: string | null; updated_at: string };

async function getArticle(slug: string) {
  return await db.prepare("SELECT a.*, c.name city, c.slug city_slug FROM articles a LEFT JOIN cities c ON c.id = a.city_id WHERE a.slug = ?").get(slug) as Article | undefined;
}
const isPublic = (a: Article) => a.status === "published" && !!a.published_at && a.published_at <= new Date().toISOString();

export async function generateMetadata({ params }: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a || !isPublic(a)) return { title: "Article not found", robots: { index: false } };
  return {
    title: a.seo_title || a.title,
    description: a.seo_description || a.excerpt || undefined,
    alternates: { canonical: `/news/${a.slug}` },
    openGraph: { type: "article", title: a.seo_title || a.title, description: a.seo_description || a.excerpt || undefined, publishedTime: a.published_at ?? undefined, authors: [a.author_name], images: a.cover_url ? [a.cover_url] : undefined },
  };
}

export default async function ArticlePage({ params }: PageProps<"/news/[slug]">) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();
  let preview = false;
  if (!isPublic(a)) {
    const u = await getUser();
    if (!can(u, "cms")) notFound();
    preview = true;
  }
  const toc = headings(a.body);
  const words = a.body.split(/\s+/).length;
  const related = await db.prepare(`SELECT slug, title, category, cover_url, published_at FROM articles WHERE status = 'published' AND published_at <= ? AND id <> ?
    ORDER BY (category = ?) DESC, (city_id IS NOT NULL AND city_id = ?) DESC, published_at DESC LIMIT 3`).all(new Date().toISOString(), a.id, a.category, a.city_id ?? -1) as Array<{ slug: string; title: string; category: string; cover_url: string | null; published_at: string }>;
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: a.title, datePublished: a.published_at, dateModified: a.updated_at, author: { "@type": "Person", name: a.author_name }, publisher: { "@type": "Organization", name: "10cent" }, image: a.cover_url ?? undefined, description: a.excerpt ?? undefined };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Container className="py-8 md:py-12">
        {preview && <Notice tone="warn" className="mb-4">Preview: this article is a draft and is only visible to the content team.</Notice>}
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "News & guides", href: "/news" }, { label: CAT_LABEL[a.category] ?? a.category, href: `/news?category=${a.category}` }]} />
        <header className="max-w-3xl mt-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">{CAT_LABEL[a.category]}{a.city ? <span className="text-muted"> · {a.city}</span> : null}</div>
          <h1 className="font-display text-[40px] md:text-[60px] leading-[1.02] mt-3">{a.title}</h1>
          {a.excerpt && <p className="text-lg text-ink-2 mt-4 leading-relaxed">{a.excerpt}</p>}
          <p className="text-sm text-muted mt-5">By <span className="text-ink-2 font-medium">{a.author_name}</span> · {formatDate(a.published_at ?? a.updated_at)} · {Math.max(1, Math.round(words / 200))} min read</p>
        </header>
        {a.cover_url && (
          <div className="mt-8 aspect-[21/9] bg-paper-2 rounded-[var(--radius-md)] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.cover_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,720px)_1fr] gap-12 mt-10">
          <article>
            <Markdown body={a.body} />
            <div className="mt-10 pt-6 border-t border-line text-xs text-muted">
              This article is general information, not legal or tax advice. Rules and rates change; check with a professional before you act.
              {a.updated_at && a.published_at && a.updated_at.slice(0, 10) > a.published_at.slice(0, 10) && <> Updated {formatDate(a.updated_at)}.</>}
            </div>
          </article>
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-8">
              {toc.length > 1 && (
                <nav aria-label="In this article">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-2">In this article</div>
                  <ul className="space-y-1.5 text-sm border-l border-line">{toc.map((h) => <li key={h.id}><a href={`#${h.id}`} className="block pl-3 text-ink-2 hover:text-ink">{h.text}</a></li>)}</ul>
                </nav>
              )}
              <div className="bg-card border border-line rounded-[var(--radius-md)] p-4 text-sm">
                <div className="font-medium">Run the numbers</div>
                <ul className="mt-2 space-y-1.5">
                  <li><Link href="/tools/emi" className="text-accent-ink hover:underline">EMI calculator</Link></li>
                  <li><Link href="/tools/stamp-duty" className="text-accent-ink hover:underline">Stamp duty by state</Link></li>
                  <li><Link href="/tools/eligibility" className="text-accent-ink hover:underline">Loan eligibility</Link></li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
        {related.length > 0 && (
          <section className="mt-16 pt-10 border-t border-line">
            <h2 className="font-display text-3xl mb-6">Keep reading</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {related.map((r) => (
                <Link key={r.slug} href={`/news/${r.slug}`} className="group">
                  <div className="aspect-[16/10] bg-paper-2 rounded-[var(--radius-md)] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.cover_url && <img src={r.cover_url} alt="" loading="lazy" className="w-full h-full object-cover" />}
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink mt-3">{CAT_LABEL[r.category]}</div>
                  <h3 className="font-display text-xl leading-tight mt-1 group-hover:underline underline-offset-4 decoration-1">{r.title}</h3>
                </Link>
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  );
}
