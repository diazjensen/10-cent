import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { inputClass, cx } from "@/components/ui";
import { AdminHeader, Panel, Table, Th, Td, EmptyRow } from "@/components/admin/ui";
import { Tabs, CMS_TABS } from "@/components/admin/tabs";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/action-form";
import { savePage } from "@/lib/admin/actions-content";

export const metadata: Metadata = { title: "Static pages" };

export default async function StaticPages() {
  await requireAdmin("cms");
  const rows = db.prepare("SELECT slug, title, updated_at, length(body) len FROM static_pages ORDER BY slug").all() as { slug: string; title: string; updated_at: string; len: number }[];
  return (
    <div>
      <AdminHeader eyebrow="AD7 · Content" title="Articles & pages" sub="About, terms, privacy, posting policy and other fixed pages. Same simple markdown as articles." />
      <Tabs items={CMS_TABS} current="/admin/cms/pages" />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <Table>
          <thead><tr><Th>Page</Th><Th>URL</Th><Th className="text-right">Length</Th><Th>Updated</Th></tr></thead>
          <tbody>
            {!rows.length && <EmptyRow cols={4}>No static pages yet.</EmptyRow>}
            {rows.map((p) => (
              <tr key={p.slug} className="hover:bg-paper/40">
                <Td><Link href={`/admin/cms/pages/${p.slug}`} className="font-medium hover:underline">{p.title}</Link></Td>
                <Td><a href={`/${p.slug}`} target="_blank" className="font-mono text-xs underline">/{p.slug}</a></Td>
                <Td className="text-right num text-muted">{p.len.toLocaleString("en-IN")} ch</Td>
                <Td className="text-muted whitespace-nowrap">{timeAgo(p.updated_at)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Panel title="New page">
          <ActionForm action={savePage} className="space-y-3">
            <input type="hidden" name="new" value="1" />
            <label className="block text-[12px] font-medium text-ink-2">Title<input name="title" className={cx(inputClass, "h-9 mt-1 text-[13px]")} placeholder="Refund policy" /><FieldError name="title" /></label>
            <label className="block text-[12px] font-medium text-ink-2">Slug<input name="slug" className={cx(inputClass, "h-9 mt-1 font-mono text-[13px]")} placeholder="refund-policy" /><FieldError name="slug" /></label>
            <label className="block text-[12px] font-medium text-ink-2">Body<textarea name="body" rows={6} className={cx(inputClass, "h-auto py-2 mt-1 font-mono text-[12.5px]")} /><FieldError name="body" /></label>
            <p className="text-xs text-muted">The public route for a new slug must exist on the site to be reachable.</p>
            <SubmitButton size="md">Create page</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}
