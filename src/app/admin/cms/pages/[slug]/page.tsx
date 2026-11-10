import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui";
import { AdminHeader } from "@/components/admin/ui";
import { PageEditor } from "@/components/admin/page-editor";

export async function generateMetadata({ params }: PageProps<"/admin/cms/pages/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Edit /${slug}` };
}

export default async function EditStaticPage({ params }: PageProps<"/admin/cms/pages/[slug]">) {
  await requireAdmin("cms");
  const { slug } = await params;
  const p = await db.prepare("SELECT * FROM static_pages WHERE slug = ?").get(slug) as { slug: string; title: string; body: string; updated_at: string } | undefined;
  if (!p) notFound();
  return (
    <div>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Static pages", href: "/admin/cms/pages" }, { label: `/${p.slug}` }]} />
      <div className="mt-3" />
      <AdminHeader title={p.title} sub={<>Public at <a className="underline font-mono" href={`/${p.slug}`} target="_blank">/{p.slug}</a> · updated {timeAgo(p.updated_at)}</>} />
      <PageEditor page={p} />
    </div>
  );
}
