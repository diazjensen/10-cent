"use client";

import { useActionState, useState, useTransition } from "react";
import { Copy, Eye, EyeOff, Send } from "lucide-react";
import { deleteWebhookAction, rotateWebhookSecretAction, saveWebhookAction, testWebhookAction, type FormState } from "@/app/dashboard/actions";
import { Button, btnClass, cx, Input, Notice } from "@/components/ui";
import { Field } from "./field";

export function WebhookPanel({ hook }: { hook: { url: string; secret: string; active: number; last_status: string | null } | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveWebhookAction, null);
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; status: string } | null>(null);
  const [testing, startTest] = useTransition();
  const [, startOther] = useTransition();

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        {state?.message && <Notice tone={state.ok ? "trust" : "danger"}>{state.message}</Notice>}
        <Field label="Endpoint URL" error={state?.errors?.url} hint="we POST JSON for every new lead">
          <Input name="url" type="url" defaultValue={hook?.url ?? ""} placeholder="https://crm.example.com/hooks/10cent" required />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={hook ? !!hook.active : true} className="w-4 h-4 accent-[var(--color-ink)]" /> Active
        </label>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : hook ? "Update webhook" : "Add webhook"}</Button>
      </form>

      {hook && (
        <>
          <div>
            <p className="text-[13px] font-medium text-ink-2 mb-1.5">Signing secret</p>
            <div className="flex gap-2">
              <code className="flex-1 min-w-0 truncate h-9 px-3 flex items-center rounded-[var(--radius-sm)] bg-paper-2 border border-line text-xs font-mono">{show ? hook.secret : `whsec_${"•".repeat(24)}`}</code>
              <button type="button" onClick={() => setShow((s) => !s)} className={btnClass("ghost", "sm", "h-9 w-9 px-0")} aria-label={show ? "Hide secret" : "Show secret"}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              <button type="button" onClick={() => { navigator.clipboard?.writeText(hook.secret); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className={btnClass("ghost", "sm", "h-9 w-9 px-0")} aria-label="Copy secret"><Copy size={15} /></button>
            </div>
            <p className="text-xs text-muted mt-1.5">{copied ? "Copied." : <>Each request carries <code className="font-mono">X-10cent-Signature: sha256=&lt;HMAC-SHA256 of the raw body&gt;</code>. Recompute it with this secret to verify.</>}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={testing} onClick={() => startTest(async () => setTest(await testWebhookAction()))} className={btnClass("secondary", "sm")}>
              <Send size={14} /> {testing ? "Sending…" : "Send test"}
            </button>
            <button type="button" onClick={() => { if (confirm("Rotate the secret? Your CRM must be updated with the new one.")) startOther(() => rotateWebhookSecretAction()); }} className={btnClass("ghost", "sm")}>Rotate secret</button>
            <button type="button" onClick={() => { if (confirm("Remove this webhook?")) startOther(() => deleteWebhookAction()); }} className={btnClass("ghost", "sm", "text-danger")}>Remove</button>
          </div>
          {test && <p role="status" className={cx("text-sm", test.ok ? "text-trust" : "text-danger")}>{test.ok ? "Delivered" : "Failed"}: {test.status}</p>}
          <p className="text-xs text-muted">Last delivery: <span className="num">{hook.last_status ?? "none yet"}</span></p>
        </>
      )}
    </div>
  );
}
