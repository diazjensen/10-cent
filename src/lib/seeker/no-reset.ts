"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Submits a form to a useActionState dispatcher without React's automatic form reset,
 * so typed values survive server-side validation errors.
 */
export function submitNoReset(dispatch: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
}
