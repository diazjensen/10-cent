import { searchListings } from "@/lib/listings";
import { rateLimit } from "@/lib/rate-limit";
import { flattenParams } from "@/lib/seeker/search-params";

/**
 * JSON search API over the same params as /search (PRD S2–S7).
 * `?count=1` returns only the total (used by the mobile filter drawer's "Show N results").
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  if (!rateLimit(`api:search:${ip}`, 600, 3600).ok) return Response.json({ error: "Too many requests" }, { status: 429 });
  const p = flattenParams(Object.fromEntries(url.searchParams.entries()));
  if (url.searchParams.get("count") === "1") {
    const r = searchListings(p, { pageSize: 1 });
    return Response.json({ total: r.total });
  }
  const size = Math.min(50, Math.max(1, Number(url.searchParams.get("size")) || 20));
  const r = searchListings(p, { pageSize: size });
  return Response.json({
    total: r.total, page: r.page, pages: r.pages,
    rows: r.rows.map((l) => ({
      id: l.id, title: l.title, price: l.price, transaction_type: l.transaction_type, property_type: l.property_type,
      bhk: l.bhk, area: l.area, locality: l.locality_name, city: l.city_name, lat: l.lat, lng: l.lng,
      verified: !!l.verified, rera: !!l.rera_id, posted_by: l.posted_by_type, cover_url: l.cover_url, url: `/property/${l.id}`,
    })),
  });
}
