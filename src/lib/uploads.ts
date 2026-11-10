import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "./db";

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 60 * 1024 * 1024;
const MAX_PDF = 15 * 1024 * 1024;

function sniff(buf: Buffer): { ext: string; kind: "image" | "video" | "pdf" } | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: ".jpg", kind: "image" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: ".png", kind: "image" };
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return { ext: ".webp", kind: "image" };
  if (buf.subarray(0, 4).toString() === "GIF8") return { ext: ".gif", kind: "image" };
  if (buf.subarray(4, 8).toString() === "ftyp") return { ext: ".mp4", kind: "video" };
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { ext: ".webm", kind: "video" };
  if (buf.subarray(0, 4).toString() === "%PDF") return { ext: ".pdf", kind: "pdf" };
  return null;
}

/** Image width/height from PNG/JPEG headers (used for the minimum-resolution check). */
function imageSize(buf: Buffer, ext: string): { w: number; h: number } | null {
  try {
    if (ext === ".png") return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (ext === ".jpg") {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) return null;
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
  } catch {}
  return null;
}

export type SavedFile = { url: string; sha256: string; kind: "image" | "video" | "pdf"; width?: number; height?: number };

/**
 * Validates and stores an uploaded file (PRD P3 image checks).
 * - Type is sniffed from bytes, not trusted from the client.
 * - Size limits per type; images must be at least 400px wide.
 */
export async function saveUpload(file: File, allowed: Array<"image" | "video" | "pdf"> = ["image"]): Promise<{ ok: true; file: SavedFile } | { ok: false; error: string }> {
  const buf = Buffer.from(await file.arrayBuffer());
  const t = sniff(buf);
  if (!t || !allowed.includes(t.kind)) return { ok: false, error: `${file.name}: unsupported file type` };
  const max = t.kind === "image" ? MAX_IMAGE : t.kind === "video" ? MAX_VIDEO : MAX_PDF;
  if (buf.length > max) return { ok: false, error: `${file.name}: file is larger than ${Math.round(max / 1024 / 1024)} MB` };
  let dims: { w: number; h: number } | null = null;
  if (t.kind === "image") {
    dims = imageSize(buf, t.ext);
    if (dims && dims.w < 400) return { ok: false, error: `${file.name}: image is too small (min 400px wide)` };
  }
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}${t.ext}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return { ok: true, file: { url: `/api/media/${name}`, sha256, kind: t.kind, width: dims?.w, height: dims?.h } };
}
