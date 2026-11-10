"use client";

import { useState } from "react";
import { ActionForm, FieldError, SubmitButton } from "./action-form";
import { Markdown } from "./markdown";
import { savePage } from "@/lib/admin/actions-content";
import { inputClass, cx } from "@/components/ui";

export function PageEditor({ page }: { page: { slug: string; title: string; body: string } }) {
  const [body, setBody] = useState(page.body);
  const [title, setTitle] = useState(page.title);
  return (
    <ActionForm action={savePage} notice="top" className="space-y-4">
      <input type="hidden" name="slug" value={page.slug} />
      <label className="block text-[12.5px] font-medium text-ink-2 max-w-xl">Title
        <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} className={cx(inputClass, "mt-1")} />
        <FieldError name="title" />
      </label>
      <div className="grid xl:grid-cols-2 gap-4">
        <label className="block text-[12.5px] font-medium text-ink-2">Body
          <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={26} className={cx(inputClass, "h-auto py-3 mt-1 font-mono text-[13px] leading-relaxed")} />
          <FieldError name="body" />
        </label>
        <div>
          <div className="text-[12.5px] font-medium text-ink-2">Preview</div>
          <article className="mt-1 p-5 bg-card border border-line rounded-[var(--radius-md)] text-[15px] max-h-[640px] overflow-y-auto">
            <h1 className="font-display text-4xl">{title}</h1>
            <Markdown source={body} />
          </article>
        </div>
      </div>
      <SubmitButton size="md" pendingLabel="Saving…">Save page</SubmitButton>
    </ActionForm>
  );
}
