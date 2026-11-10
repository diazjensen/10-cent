import { db } from "@/lib/db";

/** Serves an uploaded file from the media_files table. File names are random and immutable, so responses cache forever. */
export async function GET(req: Request, ctx: RouteContext<"/api/media/[file]">) {
  const { file } = await ctx.params;
  if (!/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(file)) return new Response("Not found", { status: 404 });
  const row = (await db.prepare("SELECT mime, sha256, data FROM media_files WHERE name = ?").get(file)) as { mime: string; sha256: string; data: Buffer } | undefined;
  if (!row) return new Response("Not found", { status: 404 });
  const etag = `"${row.sha256}"`;
  const headers = { "Content-Type": row.mime, "Cache-Control": "public, max-age=31536000, immutable", ETag: etag };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(row.data), { headers });
}
