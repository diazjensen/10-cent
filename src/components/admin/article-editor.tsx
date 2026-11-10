"use client";

import { useState } from "react";
import { ActionForm, FieldError, SubmitButton } from "./action-form";
import { Markdown } from "./markdown";
import { saveArticle } from "@/lib/admin/actions-content";
import { ARTICLE_CATEGORIES } from "@/lib/constants";
import { slugify } from "@/lib/format";
import { inputClass, cx } from "@/components/ui";

export type ArticleInput = {
  id?: number; title: string; slug: string; category: string; author_name: string; excerpt: string | null; body: string;
  cover_url: string | null; city_id: number | null; seo_title: string | null; seo_description: string | null; status: string;
};

const lbl = "block text-[12.5px] font-medium text-ink-2";
const inp = cx(inputClass, "mt-1");

export function ArticleEditor({ a, cities, defaultAuthor }: { a?: ArticleInput; cities: { id: number; name: string }[]; defaultAuthor: string }) {
  const [title, setTitle] = useState(a?.title ?? "");
  const [slug, setSlug] = useState(a?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!a);
  const [body, setBody] = useState(a?.body ?? "## \n\n");
  const [excerpt, setExcerpt] = useState(a?.excerpt ?? "");
  const [seoTitle, setSeoTitle] = useState(a?.seo_title ?? "");
  const [seoDesc, setSeoDesc] = useState(a?.seo_description ?? "");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [coverPreview, setCoverPreview] = useState<string | null>(a?.cover_url ?? null);
  const effSlug = slugTouched ? slug : slugify(title);
  const published = a?.status === "published";
  const words = body.trim().split(/\s+/).filter(Boolean).length;

  return (
    <ActionForm action={saveArticle} notice="top" className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      {a?.id && <input type="hidden" name="id" value={a.id} />}
      <div className="space-y-4 min-w-0">
        <label className={lbl}>Title
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} className={cx(inp, "h-12 text-lg font-medium")} placeholder="How to check a project's RERA registration" />
          <FieldError name="title" />
        </label>
        <label className={lbl}>Slug <span className="font-normal text-muted">/news/{effSlug || "…"}</span>
          <input name="slug" value={effSlug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} className={cx(inp, "h-9 font-mono text-[13px]")} />
          <FieldError name="slug" />
        </label>
        <label className={lbl}>Excerpt <span className="font-normal text-muted">{excerpt.length}/300 · shown on cards</span>
          <textarea name="excerpt" rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className={cx(inp, "h-auto py-2")} />
          <FieldError name="excerpt" />
        </label>

        <div>
          <div className="flex items-end justify-between gap-3">
            <span className={lbl}>Body</span>
            <div role="tablist" aria-label="Editor mode" className="inline-flex p-0.5 bg-paper-2 rounded-[var(--radius-sm)] text-[12.5px]">
              {(["write", "preview"] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("h-7 px-3 rounded-[var(--radius-xs)] capitalize", tab === t ? "bg-card shadow-sm font-medium" : "text-muted")}>{t}</button>
              ))}
            </div>
          </div>
          <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={22} aria-label="Article body"
            className={cx(inp, "h-auto py-3 font-mono text-[13px] leading-relaxed", tab === "preview" && "hidden")} />
          {tab === "preview" && (
            <article className="mt-1 p-5 md:p-8 bg-card border border-line rounded-[var(--radius-md)] min-h-[420px] text-[15px] text-ink max-w-none">
              <h1 className="font-display text-4xl leading-tight">{title || "Untitled"}</h1>
              {excerpt && <p className="mt-2 text-muted text-base">{excerpt}</p>}
              {coverPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverPreview} alt="" className="mt-4 w-full max-h-80 object-cover rounded-[var(--radius-md)]" />
              )}
              <Markdown source={body} className="mt-4" />
            </article>
          )}
          <FieldError name="body" />
          <p className="mt-1.5 text-xs text-muted"><span className="num">{words}</span> words · <code>## Heading</code>, blank line between paragraphs, <code>- item</code> lists, <code>**bold**</code>, <code>[link text](/tools/emi)</code></p>
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20">
        <div className="bg-card border border-line rounded-[var(--radius-md)] p-4 space-y-3">
          <div className="flex items-center justify-between text-[13px]"><span className="text-muted">Status</span><span className={cx("font-semibold", published ? "text-trust" : "text-warn")}>{published ? "Published" : a ? "Draft" : "New draft"}</span></div>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="intent" value="save" variant="secondary" size="md">{published ? "Update" : "Save draft"}</SubmitButton>
            {!published && <SubmitButton name="intent" value="publish" variant="accent" size="md" confirm="Publish this article on /news?">Publish</SubmitButton>}
            {published && <SubmitButton name="intent" value="unpublish" variant="ghost" size="md" confirm="Unpublish and move back to draft?">Unpublish</SubmitButton>}
          </div>
          {published && a?.slug && <a href={`/news/${a.slug}`} target="_blank" className="block text-[13px] underline">View live article</a>}
        </div>

        <div className="bg-card border border-line rounded-[var(--radius-md)] p-4 space-y-3">
          <label className={lbl}>Category
            <select name="category" defaultValue={a?.category ?? "buying-guide"} className={cx(inp, "h-9 text-[13px]")}>
              {ARTICLE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <FieldError name="category" />
          </label>
          <label className={lbl}>Author
            <input name="author_name" defaultValue={a?.author_name ?? defaultAuthor} className={cx(inp, "h-9 text-[13px]")} />
            <FieldError name="author_name" />
          </label>
          <label className={lbl}>City <span className="font-normal text-muted">(for city guides)</span>
            <select name="city_id" defaultValue={a?.city_id ?? ""} className={cx(inp, "h-9 text-[13px]")}>
              <option value="">All India</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div>
            <span className={lbl}>Cover image</span>
            {coverPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="Cover preview" className="mt-1 w-full h-32 object-cover rounded-[var(--radius-sm)] border border-line" />
            )}
            <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" aria-label="Cover image"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setCoverPreview(URL.createObjectURL(f)); }}
              className="mt-1.5 block w-full text-[12.5px] file:mr-2 file:h-8 file:px-3 file:rounded-[var(--radius-sm)] file:border file:border-line-2 file:bg-card file:text-[12.5px]" />
            {a?.cover_url && <label className="mt-1.5 flex items-center gap-2 text-[12.5px]"><input type="checkbox" name="remove_cover" /> Remove current cover</label>}
            <FieldError name="cover" />
            <p className="text-[11.5px] text-muted mt-1">JPG, PNG or WebP, at least 400 px wide, up to 8 MB.</p>
          </div>
        </div>

        <div className="bg-card border border-line rounded-[var(--radius-md)] p-4 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Search appearance</div>
          <label className={lbl}>SEO title <span className={cx("font-normal", seoTitle.length > 60 ? "text-warn" : "text-muted")}>{seoTitle.length}/60</span>
            <input name="seo_title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={title} className={cx(inp, "h-9 text-[13px]")} />
            <FieldError name="seo_title" />
          </label>
          <label className={lbl}>Meta description <span className={cx("font-normal", seoDesc.length > 160 ? "text-warn" : "text-muted")}>{seoDesc.length}/160</span>
            <textarea name="seo_description" rows={3} value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} placeholder={excerpt} className={cx(inp, "h-auto py-2 text-[13px]")} />
            <FieldError name="seo_description" />
          </label>
          <div className="p-3 bg-paper rounded-[var(--radius-sm)] text-[12.5px]">
            <div className="text-[#1a0dab] text-[14px] leading-snug line-clamp-1">{seoTitle || title || "Article title"} · 10cent</div>
            <div className="text-trust text-[11.5px]">10cent.in/news/{effSlug}</div>
            <div className="text-ink-2 line-clamp-2">{seoDesc || excerpt || "Meta description shown in search results."}</div>
          </div>
        </div>
      </aside>
    </ActionForm>
  );
}
