"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { btnClass, cx } from "@/components/ui";

export type ActionState = { ok?: string; error?: string; errors?: Record<string, string>; at?: number; data?: unknown };
type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const Ctx = createContext<ActionState>({});
const PendingCtx = createContext(false);

/**
 * A <form> bound to an admin server action with inline success / error feedback.
 * Field-level errors are shown by <FieldError name="..."/> anywhere inside.
 */
export function ActionForm({
  action, children, className, resetOnSuccess, notice = "bottom", onDone, id, inline,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  notice?: "top" | "bottom" | "none";
  onDone?: (s: ActionState) => void;
  id?: string;
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const seen = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (state.at && state.at !== seen.current) {
      seen.current = state.at;
      if (state.ok && resetOnSuccess) ref.current?.reset();
      onDone?.(state);
    }
  }, [state, resetOnSuccess, onDone]);
  const msg = notice !== "none" && (state.error || state.ok) ? (
    <p role={state.error ? "alert" : "status"} className={cx("text-[13px] leading-snug", state.error ? "text-danger" : "text-trust", inline ? "" : notice === "top" ? "mb-3" : "mt-2")}>
      {state.error || state.ok}
    </p>
  ) : null;
  // Submit manually (not via the `action` prop) so React does not auto-reset the form:
  // after a validation error the user's input must stay put. Reset happens only on success when asked.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(fd));
  };
  return (
    <Ctx.Provider value={state}>
      <PendingCtx.Provider value={pending}>
      <form ref={ref} onSubmit={onSubmit} className={className} id={id} aria-busy={pending || undefined}>
        {notice === "top" && msg}
        {children}
        {notice === "bottom" && msg}
      </form>
      </PendingCtx.Provider>
    </Ctx.Provider>
  );
}

export function useActionResult() {
  return useContext(Ctx);
}

export function FieldError({ name }: { name: string }) {
  const s = useContext(Ctx);
  const e = s.errors?.[name];
  return e ? <p className="mt-1 text-xs text-danger">{e}</p> : null;
}

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "trust";

/** Submit button with pending state and optional confirm() prompt. */
export function SubmitButton({
  children, variant = "primary", size = "sm", confirm, className, pendingLabel, ...p
}: Omit<ComponentProps<"button">, "type"> & { variant?: Variant; size?: "sm" | "md" | "lg"; confirm?: string; pendingLabel?: string }) {
  const pending = useContext(PendingCtx);
  return (
    <button
      {...p}
      type="submit"
      disabled={pending || p.disabled}
      aria-busy={pending || undefined}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
        p.onClick?.(e);
      }}
      className={btnClass(variant, size, className)}
    >
      {pending ? pendingLabel ?? "Working…" : children}
    </button>
  );
}
