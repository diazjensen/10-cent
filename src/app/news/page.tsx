import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { ARTICLE_CATEGORIES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Breadcrumbs, Container, EmptyState, Pagination, cx } from "@/components/ui";

const PAGE = 9;
const CAT_LABEL: Record<string, string> = Object.fromEntries(ARTICLE_CATEGORIES.map((c) => [c.value, c.label]));

export async function generateMetadata({ searchParams }: PageProps<"/news">): Promise<Metadata> {
  const sp = await searchParams;
  const cat = typeof sp.category === "string" ? CAT_LABEL[sp.category] : undefined;
  return {
    title: cat ? `${cat}: property news and guides` : "Property news, buying and renting guides",
    description: "Real estate news, home-buying and renting guides, legal and tax explainers and city guides from the 10cent editorial team.",
    alternates: { canonical: cat ? `/news?category=${sp.category}` : "/news" },
  };
}

type Row = { slug: string; title: string; category: string; excerpt: string | null; cover_url: string | null; author_name: string; published_at: string; city: string | null; words: number };

export default async function NewsIndex({ searchParams }: PageProps<"/news">) {
  const sp = await searchParams;
  const cat = typeof sp.category === "string" && CAT_LABEL[sp.category] ? sp.category : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where = `a.status = 'published' AND a.published_at <= ?${cat ? " AND a.category = ?" : ""}`;
  const args = [new Date().toISOString(), ...(cat ? [cat] : [])];
  const total = (await db.prepare(`SELECT COUNT(*) n FROM articles a WHERE ${where}`).get(...args) as { n: number }).n;
  const rows = await db.prepare(`SELECT a.slug, a.title, a.category, a.excerpt, a.cover_url, a.author_name, a.published_at, c.name city,
      (LENGTH(a.body) - LENGTH(REPLACE(a.body, ' ', '')) + 1) words
    FROM articles a LEFT JOIN cities c ON c.id = a.city_id WHERE ${where} ORDER BY a.published_at DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`).all(...args) as Row[];
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const counts = Object.fromEntries((await db.prepare("SELECT category, COUNT(*) n FROM articles WHERE status = 'published' GROUP BY category").all() as Array<{ category: string; n: number }>).map((r) => [r.category, r.n]));
  const [lead, ...rest] = rows;
  const href = (c: string, p = 1) => { const q = new URLSearchParams(); if (c) q.set("category", c); if (p > 1) q.set("page", String(p)); const s = q.toString(); return `/news${s ? `?${s}` : ""}`; };

  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "News & guides" }]} />
      <h1 className="font-display text-[44px] md:text-[64px] leading-[1] mt-4">News &amp; guides</h1>
      <p className="text-ink-2 mt-2 max-w-2xl">Plain-language explainers on buying, renting, RERA, stamp duty and tax, and what is moving prices in your city.</p>

      <nav aria-label="Categories" className="mt-6 mb-8 flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 border-b border-line">
        {[{ value: "", label: "All" }, ...ARTICLE_CATEGORIES].map((c) => (
          <Link key={c.value} href={href(c.value)} aria-current={cat === c.value ? "page" : undefined}
            className={cx("shrink-0 px-3 h-10 inline-flex items-center gap-1.5 text-sm border-b-2 -mb-px", cat === c.value ? "border-accent text-ink font-medium" : "border-transparent text-muted hover:text-ink")}>
            {c.label}{c.value && counts[c.value] ? <span className="num text-[11px] text-muted">{counts[c.value]}</span> : null}
          </Link>
        ))}
      </nav>

      {!rows.length ? (
        <EmptyState title="Nothing published in this category yet" body="Our editors add new guides every week." action={<Link href="/news" className="text-sm font-medium text-accent-ink">See all articles</Link>} />
      ) : (
        <>
          {lead && page === 1 && (
            <Link href={`/news/${lead.slug}`} className="group grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-6 md:gap-10 items-center mb-12">
              <div className="aspect-[16/10] bg-paper-2 rounded-[var(--radius-md)] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {lead.cover_url && <img src={lead.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform" />}
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">{CAT_LABEL[lead.category]}</div>
                <h2 className="font-display text-4xl md:text-5xl leading-[1.02] mt-2 group-hover:underline decoration-1 underline-offset-4">{lead.title}</h2>
                {lead.excerpt && <p className="text-ink-2 mt-3 leading-relaxed">{lead.excerpt}</p>}
                <p className="text-xs text-muted mt-4">{lead.author_name} · {formatDate(lead.published_at)} · {Math.max(1, Math.round(lead.words / 200))} min read</p>
              </div>
            </Link>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
            {(page === 1 ? rest : rows).map((a) => (
              <Link key={a.slug} href={`/news/${a.slug}`} className="group">
                <div className="aspect-[16/10] bg-paper-2 rounded-[var(--radius-md)] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.cover_url && <img src={a.cover_url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink mt-4">{CAT_LABEL[a.category]}{a.city ? <span className="text-muted"> · {a.city}</span> : null}</div>
                <h3 className="font-display text-2xl leading-tight mt-1 group-hover:underline decoration-1 underline-offset-4">{a.title}</h3>
                {a.excerpt && <p className="text-sm text-ink-2 mt-2 line-clamp-2">{a.excerpt}</p>}
                <p className="text-xs text-muted mt-2">{formatDate(a.published_at)} · {Math.max(1, Math.round(a.words / 200))} min read</p>
              </Link>
            ))}
          </div>
          <Pagination page={page} pages={pages} hrefFor={(p) => href(cat, p)} />
        </>
      )}
    </Container>
  );
}
