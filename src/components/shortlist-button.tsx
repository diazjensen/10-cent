"use client";

import { Heart } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleShortlist } from "@/app/actions/shortlist";
import { cx } from "./ui";

export function ShortlistButton({ listingId, initial, variant = "icon" }: { listingId: number; initial: boolean; variant?: "icon" | "full" }) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const path = usePathname();
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      const prev = saved;
      setSaved(!prev);
      const r = await toggleShortlist(listingId);
      if (r.needLogin) { setSaved(prev); router.push(`/login?next=${encodeURIComponent(path)}`); return; }
      if (!r.ok) setSaved(prev);
      else setSaved(!!r.saved);
    });
  };
  if (variant === "full")
    return (
      <button type="button" onClick={onClick} disabled={pending} aria-pressed={saved} className={cx("inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-sm)] border text-sm font-medium", saved ? "border-accent text-accent-ink bg-accent-soft" : "border-line-2 bg-card hover:border-ink")}>
        <Heart size={16} fill={saved ? "currentColor" : "none"} /> {saved ? "Shortlisted" : "Shortlist"}
      </button>
    );
  return (
    <button type="button" onClick={onClick} disabled={pending} aria-pressed={saved} aria-label={saved ? "Remove from shortlist" : "Add to shortlist"} className={cx("w-9 h-9 grid place-items-center rounded-full bg-white/95 shadow-sm hover:scale-105 transition-transform", saved ? "text-accent" : "text-ink")}>
      <Heart size={17} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
