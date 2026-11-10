import { ActionForm, FieldError, SubmitButton } from "./action-form";
import { approveListing, rejectListing, editListing, takedownListing, restoreListing, toggleListing } from "@/lib/admin/actions-listings";
import { REJECT_REASONS, TAKEDOWN_REASONS } from "@/lib/admin/areas";
import { PROPERTY_TYPES } from "@/lib/constants";
import { inputClass, cx } from "@/components/ui";
import type { AdminListing } from "@/lib/admin/moderation";

const small = "h-9 text-[13px]";

export function ApproveForm({ id, label = "Approve" }: { id: number; label?: string }) {
  return (
    <ActionForm action={approveListing} inline className="contents">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="trust" pendingLabel="Approving…">{label}</SubmitButton>
    </ActionForm>
  );
}

function ReasonFields({ reasons, label }: { reasons: readonly string[]; label: string }) {
  return (
    <>
      <label className="block text-[12px] font-medium text-ink-2">
        {label}
        <select name="preset" className={cx(inputClass, small, "mt-1")} defaultValue="">
          <option value="">Choose a common reason…</option>
          {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label className="block text-[12px] font-medium text-ink-2">
        Note to the poster <span className="font-normal text-muted">(optional if a reason is picked)</span>
        <textarea name="note" rows={2} maxLength={500} className={cx(inputClass, "h-auto py-2 mt-1 text-[13px]")} placeholder="e.g. Kitchen photo is from another flat; please upload your own." />
      </label>
      <FieldError name="reason" />
    </>
  );
}

export function RejectForm({ id }: { id: number }) {
  return (
    <details className="group">
      <summary className="list-none cursor-pointer inline-flex h-8 px-3 items-center rounded-[var(--radius-sm)] border border-line-2 bg-card text-[13px] font-medium hover:border-danger hover:text-danger group-open:border-danger group-open:text-danger">Reject…</summary>
      <ActionForm action={rejectListing} className="mt-2 p-3 space-y-2.5 bg-danger-soft/40 border border-danger/20 rounded-[var(--radius-sm)] w-full sm:w-96">
        <input type="hidden" name="id" value={id} />
        <ReasonFields reasons={REJECT_REASONS} label="Reason" />
        <SubmitButton variant="danger" pendingLabel="Rejecting…">Reject and notify poster</SubmitButton>
      </ActionForm>
    </details>
  );
}

export function TakedownForm({ id }: { id: number }) {
  return (
    <details className="group">
      <summary className="list-none cursor-pointer inline-flex h-8 px-3 items-center rounded-[var(--radius-sm)] border border-line-2 bg-card text-[13px] font-medium hover:border-danger hover:text-danger group-open:border-danger group-open:text-danger">Take down…</summary>
      <ActionForm action={takedownListing} className="mt-2 p-3 space-y-2.5 bg-danger-soft/40 border border-danger/20 rounded-[var(--radius-sm)] w-full sm:w-96">
        <input type="hidden" name="id" value={id} />
        <ReasonFields reasons={TAKEDOWN_REASONS} label="Takedown reason" />
        <SubmitButton variant="danger" pendingLabel="Removing…">Take down listing</SubmitButton>
      </ActionForm>
    </details>
  );
}

export function RestoreForm({ id }: { id: number }) {
  return (
    <ActionForm action={restoreListing} inline className="contents">
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="secondary" confirm="Make this listing live again?">Restore</SubmitButton>
    </ActionForm>
  );
}

export function ToggleForm({ id, field, on }: { id: number; field: "featured" | "premium"; on: boolean }) {
  return (
    <ActionForm action={toggleListing} inline className="contents" notice="none">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <button
        type="submit"
        aria-pressed={on}
        title={`${on ? "Remove" : "Mark as"} ${field}`}
        className={cx("h-7 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wide border", on ? "bg-ink text-white border-ink" : "bg-card text-muted border-line-2 hover:border-ink hover:text-ink")}
      >
        {field === "featured" ? "Featured" : "Premium"}
      </button>
    </ActionForm>
  );
}

export function EditForm({ l }: { l: AdminListing }) {
  const f = "block text-[12px] font-medium text-ink-2";
  return (
    <details className="group">
      <summary className="list-none cursor-pointer inline-flex h-8 px-3 items-center rounded-[var(--radius-sm)] border border-line-2 bg-card text-[13px] font-medium hover:border-ink group-open:border-ink">Edit fields…</summary>
      <ActionForm action={editListing} className="mt-2 p-3 bg-paper border border-line rounded-[var(--radius-sm)] grid sm:grid-cols-2 gap-2.5 w-full lg:w-[560px]">
        <input type="hidden" name="id" value={l.id} />
        <label className={cx(f, "sm:col-span-2")}>Title
          <input name="title" defaultValue={l.title} className={cx(inputClass, small, "mt-1")} />
          <FieldError name="title" />
        </label>
        <label className={f}>Price (₹{l.transaction_type === "sell" ? "" : " / month"})
          <input name="price" inputMode="numeric" defaultValue={l.price} className={cx(inputClass, small, "mt-1 num")} />
          <FieldError name="price" />
        </label>
        <label className={f}>Property type
          <select name="property_type" defaultValue={l.property_type} className={cx(inputClass, small, "mt-1")}>
            {PROPERTY_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <FieldError name="property_type" />
        </label>
        <label className={f}>BHK
          <input name="bhk" inputMode="numeric" defaultValue={l.bhk ?? ""} className={cx(inputClass, small, "mt-1 num")} />
          <FieldError name="bhk" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className={f}>Carpet sq ft
            <input name="carpet_area" inputMode="numeric" defaultValue={l.carpet_area ?? ""} className={cx(inputClass, small, "mt-1 num")} />
            <FieldError name="carpet_area" />
          </label>
          <label className={f}>Super sq ft
            <input name="super_area" inputMode="numeric" defaultValue={l.super_area ?? ""} className={cx(inputClass, small, "mt-1 num")} />
            <FieldError name="super_area" />
          </label>
        </div>
        <label className={cx(f, "sm:col-span-2")}>Description
          <textarea name="description" rows={5} defaultValue={l.description ?? ""} className={cx(inputClass, "h-auto py-2 mt-1 text-[13px] leading-relaxed")} />
          <FieldError name="description" />
        </label>
        <div className="sm:col-span-2"><SubmitButton pendingLabel="Saving…">Save changes</SubmitButton></div>
      </ActionForm>
    </details>
  );
}
