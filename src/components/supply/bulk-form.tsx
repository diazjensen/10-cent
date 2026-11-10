"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { bulkUploadAction, type BulkResult } from "@/app/dashboard/bulk/actions";
import { Button, Card, cx, Notice } from "@/components/ui";

export function BulkForm() {
  const [state, action, pending] = useActionState<BulkResult, FormData>(bulkUploadAction, null);
  const [name, setName] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <form action={action} className="bg-card border border-line rounded-[var(--radius-md)] p-5 space-y-4">
        <label className={cx("flex flex-col items-center justify-center gap-2 border border-dashed rounded-[var(--radius-md)] p-8 text-center cursor-pointer", name ? "border-ink bg-paper" : "border-line-2 hover:border-ink")}>
          <FileSpreadsheet size={28} className="text-muted" aria-hidden />
          <span className="text-sm font-medium">{name ?? "Choose a CSV file"}</span>
          <span className="text-xs text-muted">UTF-8 CSV, up to 200 rows and 2 MB</span>
          <input type="file" name="file" accept=".csv,text/csv" className="sr-only" required onChange={(e) => setName(e.target.files?.[0]?.name ?? null)} />
        </label>
        <Button type="submit" disabled={pending || !name}><Upload size={15} /> {pending ? "Validating and creating…" : "Upload and validate"}</Button>
      </form>

      {state && !state.ok && state.message && <Notice tone="danger">{state.message}</Notice>}
      {state?.ok && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4"><p className="text-xs text-muted">Rows read</p><p className="num text-2xl font-semibold">{state.total}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted">Created (pending review)</p><p className="num text-2xl font-semibold text-trust">{state.created.length}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted">Rows with errors</p><p className={cx("num text-2xl font-semibold", state.errors.length && "text-danger")}>{state.errors.length}</p></Card>
          </div>
          {state.message && <Notice tone="warn">{state.message}</Notice>}
          {state.errors.length > 0 && (
            <Card className="overflow-hidden">
              <p className="px-4 py-2.5 bg-danger-soft text-danger text-sm font-medium">Fix these rows and upload them again (only the failed rows, to avoid duplicates)</p>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted border-b border-line"><tr><th className="px-4 py-2 font-medium w-16">Row</th><th className="px-4 py-2 font-medium">Problems</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {state.errors.map((e) => (
                    <tr key={e.row}><td className="px-4 py-2.5 num align-top">{e.row}</td><td className="px-4 py-2.5"><ul className="space-y-0.5">{e.messages.map((m, i) => <li key={i} className="text-ink-2">{m}</li>)}</ul></td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {state.created.length > 0 && (
            <Card className="overflow-hidden">
              <p className="px-4 py-2.5 bg-trust-soft text-trust text-sm font-medium">Created and sent for review</p>
              <ul className="divide-y divide-line text-sm">
                {state.created.map((c) => (
                  <li key={c.id} className="px-4 py-2.5 flex gap-3"><span className="num text-muted w-10">{c.row}</span><span className="flex-1 min-w-0 truncate">{c.title}</span>{c.flagged && <span className="text-xs text-warn">flagged for manual check</span>}<Link href={`/dashboard/listings/${c.id}/edit`} className="text-xs underline">Add photos</Link></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
