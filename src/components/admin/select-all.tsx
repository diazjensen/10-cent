"use client";

/** Checks/unchecks every checkbox that belongs to the given form id. */
export function SelectAll({ form, label = "Select all" }: { form: string; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-ink-2 cursor-pointer select-none">
      <input
        type="checkbox"
        className="w-4 h-4 accent-[var(--color-ink)]"
        onChange={(e) => {
          document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][form="${form}"]`).forEach((c) => (c.checked = e.target.checked));
        }}
      />
      {label}
    </label>
  );
}
