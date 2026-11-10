import { renderArt, ART_KINDS, type ArtKind } from "@/lib/art";

export async function GET(_req: Request, ctx: RouteContext<"/api/art/[kind]/[seed]">) {
  const { kind, seed } = await ctx.params;
  if (!ART_KINDS.includes(kind as ArtKind)) return new Response("Not found", { status: 404 });
  const svg = renderArt(kind as ArtKind, parseInt(seed, 10) || 1);
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
