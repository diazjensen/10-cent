import "server-only";
import { db } from "@/lib/db";
import { CARD_FROM, CARD_SELECT, bumpStat, type ListingCard } from "@/lib/listings";

export type ListingDetail = {
  id: number; user_id: number; posted_by_type: string; title: string; transaction_type: string; category: string;
  property_type: string; city_id: number; locality_id: number | null; project_id: number | null; address: string | null;
  lat: number | null; lng: number | null; price: number; price_negotiable: number; maintenance: number | null;
  deposit: number | null; bhk: number | null; bathrooms: number | null; balconies: number | null;
  carpet_area: number | null; builtup_area: number | null; super_area: number | null; plot_area: number | null;
  floor: number | null; total_floors: number | null; facing: string | null; age_years: number | null;
  furnishing: string | null; construction_status: string | null; possession_date: string | null; new_launch: number;
  rera_id: string | null; verified: number; tenant_types: string | null; available_from: string | null;
  pg_sharing: string | null; pg_meals: number | null; description: string | null; status: string;
  reject_reason: string | null; featured: number; premium: number; views: number; created_at: string;
  updated_at: string; published_at: string | null; expires_at: string | null;
  city_name: string; city_slug: string; state: string;
  locality_name: string | null; locality_slug: string | null; landmarks: string | null;
  project_name: string | null; project_slug: string | null; project_rera_state: string | null;
  poster_name: string | null; poster_phone: string | null; poster_role: string; poster_kyc: string;
  poster_since: string; poster_company: string | null; poster_rera: string | null; poster_logo: string | null;
  poster_rating: number | null; poster_rating_count: number | null; poster_experience: number | null;
};

export async function getListingDetail(id: number): Promise<ListingDetail | undefined> {
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) return undefined;
  return await db.prepare(`
    SELECT l.*, c.name city_name, c.slug city_slug, c.state,
      lo.name locality_name, lo.slug locality_slug, lo.landmarks,
      p.name project_name, p.slug project_slug, p.rera_state project_rera_state,
      u.name poster_name, u.phone poster_phone, u.role poster_role, u.kyc_status poster_kyc, u.created_at poster_since,
      pr.company_name poster_company, pr.rera_number poster_rera, pr.logo_url poster_logo,
      pr.rating poster_rating, pr.rating_count poster_rating_count, pr.experience_years poster_experience
    FROM listings l
    JOIN cities c ON c.id = l.city_id
    JOIN users u ON u.id = l.user_id
    LEFT JOIN profiles pr ON pr.user_id = l.user_id
    LEFT JOIN localities lo ON lo.id = l.locality_id
    LEFT JOIN projects p ON p.id = l.project_id
    WHERE l.id = ?`).get(id) as ListingDetail | undefined;
}

export type Media = { id: number; kind: string; url: string; caption: string | null };
export async function getMedia(id: number) {
  return await db.prepare("SELECT id, kind, url, caption FROM listing_media WHERE listing_id = ? ORDER BY sort, id").all(id) as Media[];
}

export async function getAmenities(id: number) {
  return (await db.prepare("SELECT amenity FROM listing_amenities WHERE listing_id = ?").all(id) as { amenity: string }[]).map((r) => r.amenity);
}

export async function getPriceTrend(localityId: number | null) {
  if (!localityId) return [];
  return await db.prepare("SELECT month, avg_price_sqft, avg_rent_2bhk FROM price_trends WHERE locality_id = ? ORDER BY month").all(localityId) as Array<{ month: string; avg_price_sqft: number; avg_rent_2bhk: number }>;
}

/** Same city, transaction and property type, price within ±35%, closest price first. */
export async function getSimilar(l: ListingDetail, limit = 4): Promise<ListingCard[]> {
  return await db.prepare(`SELECT ${CARD_SELECT} ${CARD_FROM}
    WHERE l.status = 'live' AND l.id <> ? AND l.city_id = ? AND l.transaction_type = ? AND l.property_type = ?
      AND l.price BETWEEN ? AND ?
    ORDER BY (l.locality_id = ?) DESC, ABS(l.price - ?) ASC LIMIT ?`).all(
      l.id, l.city_id, l.transaction_type, l.property_type, Math.round(l.price * 0.65), Math.round(l.price * 1.35), l.locality_id ?? -1, l.price, limit
    ) as ListingCard[];
}

export async function shortlistIds(userId: number | undefined | null): Promise<Set<number>> {
  if (!userId) return new Set();
  return new Set((await db.prepare("SELECT listing_id FROM shortlists WHERE user_id = ?").all(userId) as { listing_id: number }[]).map((r) => r.listing_id));
}

/** Records a detail page view: listings.views, daily stats and seen_listings for signed-in users. */
export async function trackView(listingId: number, userId: number | null) {
  await db.prepare("UPDATE listings SET views = views + 1 WHERE id = ?").run(listingId);
  await bumpStat(listingId, "views");
  if (userId) {
    await db.prepare("INSERT INTO seen_listings (user_id, listing_id, seen_at) VALUES (?,?,?) ON CONFLICT(user_id, listing_id) DO UPDATE SET seen_at = excluded.seen_at")
            .run(userId, listingId, new Date().toISOString());
  }
}

export async function activeBanner(placement: string) {
  const now = new Date().toISOString();
  return await db.prepare(`SELECT id, title, subtitle, link FROM banners WHERE placement = ? AND active = 1
    AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?) ORDER BY id DESC LIMIT 1`).get(placement, now, now) as
    | { id: number; title: string; subtitle: string | null; link: string | null }
    | undefined;
}
