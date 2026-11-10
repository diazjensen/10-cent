"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, FileText, ImagePlus, Loader2, Star, Trash2, Upload, Video } from "lucide-react";
import { cx } from "@/components/ui";
import type { MediaRef } from "@/lib/supply/listing-schema";

type Kind = "image" | "video" | "pdf" | "image_or_pdf";

/**
 * Phone photos are often 4-10 MB, but hosting platforms cap request bodies at about 4.5 MB. Shrink big photos in the
 * browser first (longest side 2000 px, JPEG). Falls back to the original file if the browser cannot decode it.
 */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function uploadFile(original: File, kind: Kind): Promise<{ ok: true; ref: MediaRef } | { ok: false; error: string }> {
  const file = kind === "image" || kind === "image_or_pdf" ? await shrinkImage(original) : original;
  if (file.size > 4.4 * 1024 * 1024) return { ok: false, error: `${original.name}: file is too large (max 4 MB for ${kind === "video" ? "videos" : "this file type"}).` };
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await res.json();
    if (!j.ok) return { ok: false, error: j.error || "Upload failed" };
    return { ok: true, ref: { url: j.url, sha256: j.sha256, name: j.name } };
  } catch {
    return { ok: false, error: `${file.name}: upload failed. Check your connection and try again.` };
  }
}

const ACCEPT: Record<Kind, string> = {
  image: "image/jpeg,image/png,image/webp",
  video: "video/mp4,video/webm",
  pdf: "application/pdf",
  image_or_pdf: "image/jpeg,image/png,image/webp,application/pdf",
};

/** Multi-photo uploader with previews, reorder, remove and set-cover (PRD P2). First photo is the cover. */
export function PhotoUploader({ photos, onChange, max, label = "Add photos", id = "photos" }: { photos: MediaRef[]; onChange: (p: MediaRef[]) => void; max: number; label?: string; id?: string }) {
  const [busy, setBusy] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);

  const addFiles = async (files: File[]) => {
    const room = max - latest.current.length;
    const errs: string[] = [];
    if (files.length > room) errs.push(`Only ${max} photos allowed; ${files.length - Math.max(room, 0)} skipped.`);
    const take = files.slice(0, Math.max(room, 0));
    setBusy((b) => b + take.length);
    await Promise.all(
      take.map(async (f) => {
        const r = await uploadFile(f, "image");
        setBusy((b) => b - 1);
        if (r.ok) {
          if (latest.current.some((p) => p.sha256 && p.sha256 === r.ref.sha256)) { errs.push(`${f.name}: already added`); return; }
          latest.current = [...latest.current, r.ref];
          onChange(latest.current);
        } else errs.push(r.error);
      })
    );
    setErrors(errs);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const cover = (i: number) => onChange([photos[i], ...photos.filter((_, k) => k !== i)]);
  const remove = (i: number) => onChange(photos.filter((_, k) => k !== i));

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))); }}
        className={cx("border border-dashed rounded-[var(--radius-md)] p-6 text-center transition-colors", drag ? "border-accent bg-accent-soft/40" : "border-line-2 bg-paper/60")}
      >
        <ImagePlus className="mx-auto text-muted" size={26} aria-hidden />
        <p className="mt-2 text-sm text-ink-2">Drag photos here or</p>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={photos.length >= max} className="mt-2 inline-flex items-center gap-2 h-9 px-3 rounded-[var(--radius-sm)] bg-ink text-white text-sm font-medium disabled:opacity-50">
          <Upload size={15} aria-hidden /> {label}
        </button>
        <p className="mt-2 text-xs text-muted">JPG, PNG or WebP, at least 400 px wide, up to 8 MB each. <span className="num">{photos.length}/{max}</span> added.</p>
        <input
          ref={inputRef}
          id={id}
          type="file"
          multiple
          accept={ACCEPT.image}
          className="sr-only"
          aria-label={label}
          onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) addFiles(fs); }}
        />
      </div>
      {busy > 0 && <p className="mt-2 text-sm text-ink-2 flex items-center gap-2" role="status"><Loader2 size={14} className="animate-spin" aria-hidden /> Uploading {busy} {busy === 1 ? "photo" : "photos"}…</p>}
      {errors.length > 0 && (
        <ul className="mt-2 text-xs text-danger space-y-0.5" role="alert">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      )}
      {photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((p, i) => (
            <li key={p.url} className="relative group border border-line rounded-[var(--radius-sm)] overflow-hidden bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Photo ${i + 1}${i === 0 ? " (cover)" : ""}`} className="aspect-[4/3] w-full object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 text-[10px] font-bold uppercase tracking-wider bg-ink text-white px-1.5 py-0.5 rounded">Cover</span>}
              <div className="flex items-center justify-between gap-1 px-1.5 py-1 border-t border-line">
                <div className="flex">
                  <IconBtn label="Move left" onClick={() => move(i, -1)} disabled={i === 0}><ArrowLeft size={14} /></IconBtn>
                  <IconBtn label="Move right" onClick={() => move(i, 1)} disabled={i === photos.length - 1}><ArrowRight size={14} /></IconBtn>
                </div>
                <div className="flex">
                  <IconBtn label="Set as cover" onClick={() => cover(i)} disabled={i === 0}><Star size={14} /></IconBtn>
                  <IconBtn label="Remove photo" onClick={() => remove(i)} danger><Trash2 size={14} /></IconBtn>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cx("w-7 h-7 grid place-items-center rounded-[var(--radius-xs)] text-ink-2 hover:bg-paper-2 disabled:opacity-30", danger && "hover:text-danger")}>
      {children}
    </button>
  );
}

/** Single-file uploader (video, floor plan, brochure, master plan). */
export function FileUploader({ value, onChange, kind, label, hint, id }: { value: MediaRef | null; onChange: (v: MediaRef | null) => void; kind: Kind; label: string; hint?: string; id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isImage = value && /\.(png|jpe?g|webp|gif)$/i.test(value.url);
  const Icon = kind === "video" ? Video : FileText;
  return (
    <div className="border border-line rounded-[var(--radius-md)] p-3.5 bg-card">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
        <label className={cx("shrink-0 inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium rounded-[var(--radius-sm)] border border-line-2 hover:border-ink cursor-pointer", busy && "opacity-50 pointer-events-none")}>
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />} {value ? "Replace" : "Upload"}
          <input
            id={id}
            type="file"
            accept={ACCEPT[kind]}
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setBusy(true); setError(null);
              const r = await uploadFile(f, kind);
              setBusy(false);
              if (r.ok) onChange(r.ref); else setError(r.error);
            }}
          />
        </label>
      </div>
      {error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}
      {value && (
        <div className="mt-3 flex items-center gap-3">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.url} alt="" className="w-20 h-14 object-cover rounded border border-line" />
          ) : kind === "video" ? (
            <video src={value.url} className="w-28 h-16 rounded border border-line bg-ink" muted />
          ) : (
            <span className="w-10 h-10 grid place-items-center rounded bg-paper-2 text-ink-2"><Icon size={18} aria-hidden /></span>
          )}
          <a href={value.url} target="_blank" rel="noreferrer" className="text-xs text-ink-2 underline underline-offset-2 truncate">{value.name || value.url.split("/").pop()}</a>
          <button type="button" onClick={() => onChange(null)} className="ml-auto text-xs text-danger hover:underline">Remove</button>
        </div>
      )}
    </div>
  );
}
