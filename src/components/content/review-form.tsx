"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import type { ReviewState } from "@/lib/content/review-actions";
import { Button, Notice, Textarea, cx } from "@/components/ui";

export function ReviewForm({ action, signedIn, loginHref, existing, subject }: {
  action: (prev: ReviewState, form: FormData) => Promise<ReviewState>;
  signedIn: boolean;
  loginHref: string;
  existing?: { rating: number; body: string | null } | null;
  subject: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  if (!signedIn)
    return (
      <div className="bg-paper-2 border border-line rounded-[var(--radius-md)] p-4 text-sm flex flex-wrap items-center justify-between gap-3">
        <span className="text-ink-2">Lived or worked with {subject}? Share what it&apos;s really like.</span>
        <Link href={loginHref} className="font-medium text-accent-ink underline underline-offset-2">Log in to write a review</Link>
      </div>
    );
  return (
    <form action={formAction} className="bg-card border border-line rounded-[var(--radius-md)] p-4 md:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{existing ? "Update your review" : "Write a review"}</h3>
        {existing && <span className="text-xs text-muted">One review per person. Saving replaces your earlier one.</span>}
      </div>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2 mb-1">Your rating</legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only peer" />
              <Star size={26} aria-label={`${n} star${n > 1 ? "s" : ""}`} className={cx("transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-accent rounded", (hover || rating) >= n ? "text-accent fill-accent" : "text-line-2")} />
            </label>
          ))}
        </div>
        {state.fieldErrors?.rating && <p className="text-xs text-danger mt-1">{state.fieldErrors.rating}</p>}
      </fieldset>
      <div>
        <label htmlFor="review-body" className="sr-only">Your review</label>
        <Textarea id="review-body" name="body" defaultValue={existing?.body ?? ""} placeholder="Traffic, water supply, safety at night, how the society is run…" rows={4} maxLength={1200} />
        {state.fieldErrors?.body && <p className="text-xs text-danger mt-1">{state.fieldErrors.body}</p>}
      </div>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="trust">Thanks. Your review is published.</Notice>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : existing ? "Update review" : "Publish review"}</Button>
    </form>
  );
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} aria-hidden className={value >= n - 0.25 ? "text-accent fill-accent" : value >= n - 0.75 ? "text-accent fill-accent/40" : "text-line-2"} />
      ))}
    </span>
  );
}
