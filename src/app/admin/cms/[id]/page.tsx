import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { pgInt } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { getCities } from "@/lib/listings";
import { formatDate } from "@/lib/format";
import { Breadcrumbs, Notice } from "@/components/ui";
import { AdminHeader } from "@/components/admin/ui";
import { ArticleEditor, type ArticleInput } from "@/components/admin/article-editor";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { deleteArticle } from "@/lib/admin/actions-content";

export async function generateMetadata({ params }: PageProps<"/admin/cms/[id]">): Promise<Metadata> {
  const { id } = await params;
  const a = await db.prepare("SELECT title FROM articles WHERE id = ?").get(pgInt(id)) as { title: string } | undefined;
  return { title: a ? `Edit: ${a.title}` : "Article" };
}

export default async function EditArticle({ params, searchParams }: PageProps<"/admin/cms/[id]">) {
  const me = await requireAdmin("cms");
  const { id } = await params;
  const sp = await searchParams;
  const a = await db.prepare("SELECT * FROM articles WHERE id = ?").get(pgInt(id)) as (ArticleInput & { id: number; created_at: string; updated_at: string; published_at: string | null }) | undefined;
  if (!a) notFound();
  return (
    <div>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Articles", href: "/admin/cms" }, { label: `#${a.id}` }]} />
      <div className="mt-3" />
      <AdminHeader title="Edit article" sub={`Created ${formatDate(a.created_at)} · last saved ${formatDate(a.updated_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}${a.published_at ? ` · published ${formatDate(a.published_at)}` : ""}`} />
      {sp.saved && <Notice tone="trust" className="mb-4">{sp.saved === "published" ? "Article created and published." : "Draft created. Publish when it is ready."}</Notice>}
      <ArticleEditor a={a} cities={(await getCities()).map((c) => ({ id: c.id, name: c.name }))} defaultAuthor={me.name ?? ""} />
      <ActionForm action={deleteArticle} className="mt-8 pt-5 border-t border-line">
        <input type="hidden" name="id" value={a.id} />
        <SubmitButton variant="ghost" className="text-danger" confirm="Delete this article permanently?">Delete article</SubmitButton>
      </ActionForm>
    </div>
  );
}
