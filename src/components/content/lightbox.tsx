"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cx } from "@/components/ui";

export type Shot = { url: string; caption?: string };

/** Full-screen image viewer; keyboard: ← → Esc. */
export function Lightbox({ shots, index, onClose, onIndex }: { shots: Shot[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const go = useCallback((d: number) => onIndex((index + d + shots.length) % shots.length), [index, shots.length, onIndex]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => { document.removeEventListener("keydown", h); document.body.style.overflow = prev; };
  }, [go, onClose]);
  const s = shots[index];
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={s.caption || "Image viewer"} className="fixed inset-0 z-[60] bg-ink/95 flex flex-col outline-none" onClick={onClose}>
      <div className="flex items-center justify-between px-4 h-14 text-white/80 text-sm" onClick={(e) => e.stopPropagation()}>
        <span className="num">{index + 1} / {shots.length}{s.caption ? ` · ${s.caption}` : ""}</span>
        <button type="button" onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-white/10" aria-label="Close"><X size={20} /></button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 pb-6 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.url} alt={s.caption || ""} className="max-w-full max-h-full object-contain bg-white rounded" onClick={(e) => e.stopPropagation()} />
        {shots.length > 1 && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous image" className="absolute left-3 md:left-6 w-11 h-11 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next image" className="absolute right-3 md:right-6 w-11 h-11 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight /></button>
          </>
        )}
      </div>
    </div>
  );
}

/** Mosaic gallery: one large image, up to four small ones, "+N" overlay. Click opens the lightbox. */
export function Gallery({ shots, badge }: { shots: Shot[]; badge?: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!shots.length) return <div className="aspect-[16/7] bg-paper-2 rounded-[var(--radius-md)] grid place-items-center text-sm text-muted">No photos yet</div>;
  const rest = shots.slice(1, 5);
  return (
    <>
      <div className={cx("grid gap-1.5 rounded-[var(--radius-md)] overflow-hidden", rest.length ? "md:grid-cols-[2fr_1fr_1fr] md:grid-rows-2 h-[280px] md:h-[440px]" : "h-[280px] md:h-[440px]")}>
        <button type="button" onClick={() => setOpen(0)} className="relative md:row-span-2 bg-paper-2 overflow-hidden group" aria-label="Open photo 1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shots[0].url} alt={shots[0].caption || ""} className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform" />
          {badge && <span className="absolute left-3 top-3">{badge}</span>}
          <span className="md:hidden absolute right-3 bottom-3 text-xs bg-ink/75 text-white px-2 py-1 rounded num">{shots.length} photos</span>
        </button>
        {rest.map((s, i) => (
          <button key={i} type="button" onClick={() => setOpen(i + 1)} className="relative hidden md:block bg-paper-2 overflow-hidden group" aria-label={`Open photo ${i + 2}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.url} alt={s.caption || ""} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
            {i === rest.length - 1 && shots.length > 5 && <span className="absolute inset-0 bg-ink/55 text-white grid place-items-center font-medium num">+{shots.length - 5} more</span>}
          </button>
        ))}
      </div>
      {open != null && <Lightbox shots={shots} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Thumbnail button that opens a single-or-multi image lightbox (used for floor plans and master plans). */
export function ZoomThumb({ shots, index = 0, className, children }: { shots: Shot[]; index?: number; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(index)} aria-label={`View ${shots[index]?.caption ?? "image"} larger`}>{children}</button>
      {open != null && <Lightbox shots={shots} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  );
}
