import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, timeAgo } from "@/lib/format";
import { ARTICLE_CATEGORIES } from "@/lib/constants";
import { LinkButton, Notice } from "@/components/ui";
import { AdminHeader, FilterBar, FInput, FSelect, Table, Th, Td, EmptyRow, StatusBadge } from "@/components/admin/ui";
import { Tabs, CMS_TABS } from "@/components/admin/tabs";

export const metadata: Metadata = { title: "Articles" };
const CAT = Object.fromEntries(ARTICLE_CATEGORIES.map((c) => [c.value, c.label]));

export default async function ArticlesAdmin({ searchParams }: PageProps<"/admin/cms">) {
  await requireAdmin("cms");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const q = s("q"), cat = s("cat"), status = s("status");
  const where = ["1=1"]; const args: unknown[] = [];
  if (q) { where.push("(a.title LIKE ? OR a.slug LIKE ? OR a.author_name LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (cat) { where.push("a.category = ?"); args.push(cat); }
  if (status) { where.push("a.status = ?"); args.push(status); }
  const rows = db.prepare(`SELECT a.id, a.title, a.slug, a.category, a.author_name, a.status, a.published_at, a.updated_at, a.cover_url, c.name city FROM articles a LEFT JOIN cities c ON c.id = a.city_id WHERE ${where.join(" AND ")} ORDER BY a.status = 'draft' DESC, COALESCE(a.published_at, a.updated_at) DESC`).all(...args) as { id: number; title: string; slug: string; category: string; author_name: string; status: string; published_at: string | null; updated_at: string; cover_url: string | null; city: string | null }[];
  return (
    <div>
      <AdminHeader eyebrow="AD7 · Content" title="Articles & pages" sub="News, buying and renting guides, legal and tax explainers, and city guides published on /news." actions={<LinkButton href="/admin/cms/new" variant="accent" size="sm">New article</LinkButton>} />
      <Tabs items={CMS_TABS} current="/admin/cms" />
      {sp.deleted === "1" && <Notice tone="trust" className="mb-4">Article deleted.</Notice>}
      <FilterBar action="/admin/cms" reset={!!(q || cat || status)}>
        <FInput label="Title, slug or author" name="q" defaultValue={q} className="w-56" />
        <FSelect label="Category" name="cat" defaultValue={cat}><option value="">All</option>{ARTICLE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</FSelect>
        <FSelect label="Status" name="status" defaultValue={status}><option value="">Any</option><option value="draft">Draft</option><option value="published">Published</option></FSelect>
      </FilterBar>
      <Table>
        <thead><tr><Th>Article</Th><Th>Category</Th><Th>Author</Th><Th>Status</Th><Th>Updated</Th></tr></thead>
        <tbody>
          {!rows.length && <EmptyRow cols={5}>No articles match. <Link href="/admin/cms/new" className="underline">Write one</Link>.</EmptyRow>}
          {rows.map((a) => (
            <tr key={a.id} className="hover:bg-paper/40">
              <Td className="min-w-[280px]"><Link href={`/admin/cms/${a.id}`} className="font-medium hover:underline">{a.title}</Link><div className="text-xs text-muted font-mono">/news/{a.slug}</div></Td>
              <Td className="whitespace-nowrap">{CAT[a.category] ?? a.category}{a.city && <div className="text-xs text-muted">{a.city}</div>}</Td>
              <Td className="whitespace-nowrap">{a.author_name}</Td>
              <Td><StatusBadge status={a.status} />{a.published_at && <div className="text-xs text-muted mt-0.5">{formatDate(a.published_at)}</div>}</Td>
              <Td className="whitespace-nowrap text-muted">{timeAgo(a.updated_at)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
