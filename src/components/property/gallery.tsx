"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X, Images, LayoutGrid, Video, Rotate3d } from "lucide-react";
import { cx } from "@/components/ui";

type M = { id: number; kind: string; url: string; caption: string | null };

const TABS = [
  { kind: "photo", label: "Photos", icon: Images },
  { kind: "floorplan", label: "Floor plan", icon: LayoutGrid },
  { kind: "video", label: "Video", icon: Video },
  { kind: "tour", label: "360° tour", icon: Rotate3d },
] as const;

const isFile = (u: string) => /\.(mp4|webm|mov)(\?|$)/i.test(u) || u.startsWith("/api/media/");

/** Gallery with media tabs and a keyboard-navigable lightbox (PRD D1). */
export function Gallery({ media, title }: { media: M[]; title: string }) {
  const tabs = TABS.filter((t) => media.some((m) => m.kind === t.kind));
  const [tab, setTab] = useState<string>(tabs[0]?.kind ?? "photo");
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const items = media.filter((m) => m.kind === tab);
  const imageTab = tab === "photo" || tab === "floorplan";
  const cur = items[Math.min(idx, items.length - 1)];
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  const count = items.length;
  const go = (d: number) => setIdx((i) => (count ? (i + d + count) % count : 0));

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") setIdx((i) => (count ? (i + 1) % count : 0));
      if (e.key === "ArrowLeft") setIdx((i) => (count ? (i - 1 + count) % count : 0));
    };
    window.addEventListener("keydown", onKey);
    const openerEl = opener.current;
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; openerEl?.focus(); };
  }, [open, count]);

  if (!media.length)
    return (
      <div className="aspect-[16/9] grid place-items-center bg-paper-2 border border-line rounded-[var(--radius-md)] text-sm text-muted">
        The poster hasn&apos;t added photos yet.
      </div>
    );

  return (
    <div>
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Media" className="flex gap-1 mb-2 overflow-x-auto scrollbar-none">
          {tabs.map((t) => {
            const n = media.filter((m) => m.kind === t.kind).length;
            return (
              <button key={t.kind} role="tab" aria-selected={tab === t.kind} type="button" onClick={() => { setTab(t.kind); setIdx(0); }}
                className={cx("shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] border", tab === t.kind ? "bg-ink text-white border-ink" : "bg-card border-line-2 text-ink-2 hover:border-ink")}>
                <t.icon size={14} aria-hidden /> {t.label} <span className="num opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {imageTab ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-[minmax(0,1fr)_168px]">
          <div className="relative aspect-[16/10] bg-paper-2 rounded-[var(--radius-md)] overflow-hidden border border-line group">
            <button ref={opener} type="button" onClick={() => setOpen(true)} className="block w-full h-full" aria-label={`Open ${tab === "photo" ? "photo" : "floor plan"} ${idx + 1} of ${items.length} full screen`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cur.url} alt={cur.caption || `${title}, ${tab === "photo" ? "photo" : "floor plan"} ${idx + 1}`} className={cx("w-full h-full", tab === "floorplan" ? "object-contain bg-white" : "object-cover")} />
            </button>
            {items.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous" className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full bg-white/95 shadow-sm hover:bg-white"><ChevronLeft size={18} /></button>
                <button type="button" onClick={() => go(1)} aria-label="Next" className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full bg-white/95 shadow-sm hover:bg-white"><ChevronRight size={18} /></button>
              </>
            )}
            <span className="absolute left-2.5 bottom-2.5 text-[11px] text-white bg-ink/75 px-2 py-0.5 rounded num">{idx + 1} / {items.length}{cur.caption ? ` · ${cur.caption}` : ""}</span>
            <button type="button" onClick={() => setOpen(true)} className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 text-[11px] text-white bg-ink/75 px-2 py-1 rounded hover:bg-ink"><Expand size={12} aria-hidden /> Full screen</button>
          </div>
          {items.length > 1 && (
            <div className="md:relative">
              <div className="flex gap-2 overflow-x-auto scrollbar-none md:absolute md:inset-0 md:grid md:grid-rows-4 md:overflow-hidden">
                {items.map((m, i) => (
                  <button key={m.id} type="button" onClick={() => setIdx(i)} aria-label={`Show ${i + 1}`} aria-current={i === idx}
                    className={cx("relative shrink-0 w-24 aspect-[4/3] md:w-full md:aspect-auto md:min-h-0 rounded-[var(--radius-sm)] overflow-hidden border-2", i > 3 && "md:hidden", i === idx ? "border-accent" : "border-transparent opacity-80 hover:opacity-100")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt="" loading="lazy" className={cx("absolute inset-0 w-full h-full", tab === "floorplan" ? "object-contain bg-white" : "object-cover")} />
                    {i === 3 && items.length > 4 && <span className="hidden md:grid absolute inset-0 place-items-center bg-ink/55 text-white text-sm font-medium num">+{items.length - 4}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-video bg-ink rounded-[var(--radius-md)] overflow-hidden border border-line">
          {isFile(cur.url) && tab === "video" ? (
            <video src={cur.url} controls preload="metadata" className="w-full h-full" aria-label={`${title} video`} />
          ) : (
            <iframe src={cur.url} title={tab === "tour" ? `${title} 360° virtual tour` : `${title} video`} className="w-full h-full" allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer" sandbox="allow-scripts allow-same-origin allow-presentation" />
          )}
        </div>
      )}

      {open && imageTab && (
        <div role="dialog" aria-modal="true" aria-label={`${title} gallery`} className="fixed inset-0 z-[60] bg-[#0d0e10]/95 flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="flex items-center justify-between px-4 h-14 text-white/90 text-sm">
            <span className="num">{idx + 1} / {items.length}{cur.caption ? ` · ${cur.caption}` : ""}</span>
            <button ref={closeBtn} type="button" onClick={() => setOpen(false)} aria-label="Close gallery" className="w-10 h-10 grid place-items-center rounded-full hover:bg-white/10"><X size={22} /></button>
          </div>
          <div className="relative flex-1 min-h-0 flex items-center justify-center px-2 md:px-16 pb-4" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.url} alt={cur.caption || `${title} ${idx + 1}`} className={cx("max-w-full max-h-full object-contain", tab === "floorplan" && "bg-white")} />
            {items.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous" className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft size={24} /></button>
                <button type="button" onClick={() => go(1)} aria-label="Next" className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight size={24} /></button>
              </>
            )}
          </div>
          <div className="flex gap-2 px-4 pb-4 overflow-x-auto scrollbar-none justify-start md:justify-center">
            {items.map((m, i) => (
              <button key={m.id} type="button" onClick={() => setIdx(i)} aria-label={`Show ${i + 1}`} className={cx("shrink-0 w-16 h-12 rounded overflow-hidden border-2", i === idx ? "border-accent" : "border-transparent opacity-60 hover:opacity-100")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="w-full h-full object-cover bg-white" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
