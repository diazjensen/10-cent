import { getCards } from "@/lib/listings";

/** Card data for a list of live listing ids (recently viewed, compare tray refresh). `?ids=1,2,3`, max 24. */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") || "")
    .split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 24);
  const rows = getCards(ids).filter((l) => l.status === "live");
  return Response.json({
    rows: rows.map((l) => ({
      id: l.id, title: l.title, price: l.price, transaction_type: l.transaction_type, bhk: l.bhk, area: l.area,
      locality: l.locality_name, city: l.city_name, cover_url: l.cover_url, verified: !!l.verified, posted_by: l.posted_by_type,
    })),
  });
}
