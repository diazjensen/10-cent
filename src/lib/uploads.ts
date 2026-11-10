import "server-only";
import crypto from "node:crypto";
import sharp from "sharp";
import { db } from "./db";

/**
 * Uploaded files live in the `media_files` table (BYTEA), not on local disk, so every serverless instance can see them
 * (Vercel instances do not share a filesystem). Served by /api/media/[file].
 * Vercel caps request/response bodies at ~4.5 MB, so videos and PDFs are limited to 4 MB; photos are resized and
 * re-encoded here (and shrunk in the browser first), which keeps them well under that.
 */
const MAX_IMAGE_IN = 12 * 1024 * 1024; // accepted input size for photos (the browser shrinks big ones before upload)
const MAX_VIDEO = 4 * 1024 * 1024;
const MAX_PDF = 4 * 1024 * 1024;
const MAX_EDGE = 2000; // px, longest side after processing

function sniff(buf: Buffer): { ext: string; mime: string; kind: "image" | "video" | "pdf" } | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: ".jpg", mime: "image/jpeg", kind: "image" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: ".png", mime: "image/png", kind: "image" };
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return { ext: ".webp", mime: "image/webp", kind: "image" };
  if (buf.subarray(0, 4).toString() === "GIF8") return { ext: ".gif", mime: "image/gif", kind: "image" };
  if (buf.subarray(4, 8).toString() === "ftyp") return { ext: ".mp4", mime: "video/mp4", kind: "video" };
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { ext: ".webm", mime: "video/webm", kind: "video" };
  if (buf.subarray(0, 4).toString() === "%PDF") return { ext: ".pdf", mime: "application/pdf", kind: "pdf" };
  return null;
}

export type SavedFile = { url: string; sha256: string; kind: "image" | "video" | "pdf"; width?: number; height?: number };

/**
 * Validates and stores an uploaded file (PRD P3 image checks).
 * - Type is sniffed from bytes, not trusted from the client.
 * - Photos must be at least 400px wide; they are auto-rotated, resized to 2000px and re-encoded as JPEG.
 * - Size limits per type.
 */
export async function saveUpload(file: File, allowed: Array<"image" | "video" | "pdf"> = ["image"]): Promise<{ ok: true; file: SavedFile } | { ok: false; error: string }> {
  let buf: Buffer = Buffer.from(await file.arrayBuffer());
  const t = sniff(buf);
  if (!t || !allowed.includes(t.kind)) return { ok: false, error: `${file.name}: unsupported file type` };
  const max = t.kind === "image" ? MAX_IMAGE_IN : t.kind === "video" ? MAX_VIDEO : MAX_PDF;
  if (buf.length > max) return { ok: false, error: `${file.name}: file is larger than ${Math.round(max / 1024 / 1024)} MB` };

  let ext = t.ext, mime = t.mime;
  let width: number | undefined, height: number | undefined;
  if (t.kind === "image") {
    try {
      const meta = await sharp(buf).metadata();
      if ((meta.width ?? 0) < 400) return { ok: false, error: `${file.name}: image is too small (min 400px wide)` };
      const out = await sharp(buf).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true });
      buf = out.data;
      ext = ".jpg";
      mime = "image/jpeg";
      width = out.info.width;
      height = out.info.height;
    } catch {
      return { ok: false, error: `${file.name}: this image could not be read. Try a different file.` };
    }
  }

  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  await db.prepare("INSERT INTO media_files (name, mime, size, sha256, data) VALUES (?,?,?,?,?)").run(name, mime, buf.length, sha256, buf);
  return { ok: true, file: { url: `/api/media/${name}`, sha256, kind: t.kind, width, height } };
}
