import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getCities } from "@/lib/listings";
import { Breadcrumbs } from "@/components/ui";
import { AdminHeader } from "@/components/admin/ui";
import { ArticleEditor } from "@/components/admin/article-editor";

export const metadata: Metadata = { title: "New article" };

export default async function NewArticle() {
  const me = await requireAdmin("cms");
  return (
    <div>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Articles", href: "/admin/cms" }, { label: "New" }]} />
      <div className="mt-3" />
      <AdminHeader title="New article" sub="Saves as a draft until you publish. Use Preview to see exactly how it will render." />
      <ArticleEditor cities={getCities().map((c) => ({ id: c.id, name: c.name }))} defaultAuthor={me.name ?? ""} />
    </div>
  );
}
