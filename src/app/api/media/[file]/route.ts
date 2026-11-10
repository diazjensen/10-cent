import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/db";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
  ".mp4": "video/mp4", ".webm": "video/webm", ".pdf": "application/pdf",
};

export async function GET(_req: Request, ctx: RouteContext<"/api/media/[file]">) {
  const { file } = await ctx.params;
  if (!/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(file)) return new Response("Not found", { status: 404 });
  const p = path.join(UPLOAD_DIR, file);
  if (!fs.existsSync(p)) return new Response("Not found", { status: 404 });
  const buf = fs.readFileSync(p);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
