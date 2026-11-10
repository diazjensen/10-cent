import type { ReactNode } from "react";

/**
 * Like ui.Field, but wraps the control in its <label> so the label is programmatically
 * associated (ui.Field renders a <label> without htmlFor).
 */
export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block">
        <span className="block text-[13px] font-medium text-ink-2 mb-1.5">
          {label}
          {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
        </span>
        {children}
      </label>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
