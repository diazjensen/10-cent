import "server-only";
import { db } from "@/lib/db";

export type LocalityRow = {
  id: number; slug: string; name: string; city_id: number; city_slug: string; city_name: string;
  rating: number | null; connectivity: number | null; safety: number | null; lifestyle: number | null;
  description: string | null; landmarks: string | null; lat: number; lng: number; trending: number;
};

export type LocalityStat = {
  id: number; slug: string; name: string; rating: number | null; trending: number;
  psf: number | null; psf_ly: number | null; rent: number | null; rent_ly: number | null; live: number;
};

/** Latest price per sq ft and 2 BHK rent with the value 12 months earlier, for every locality in a city. */
export async function localityStats(cityId: number): Promise<LocalityStat[]> {
  return await db.prepare(`
    SELECT lo.id, lo.slug, lo.name, lo.rating, lo.trending,
      (SELECT avg_price_sqft FROM price_trends t WHERE t.locality_id = lo.id ORDER BY month DESC LIMIT 1) psf,
      (SELECT avg_price_sqft FROM price_trends t WHERE t.locality_id = lo.id ORDER BY month DESC LIMIT 1 OFFSET 12) psf_ly,
      (SELECT avg_rent_2bhk FROM price_trends t WHERE t.locality_id = lo.id ORDER BY month DESC LIMIT 1) rent,
      (SELECT avg_rent_2bhk FROM price_trends t WHERE t.locality_id = lo.id ORDER BY month DESC LIMIT 1 OFFSET 12) rent_ly,
      (SELECT COUNT(*) FROM listings l WHERE l.locality_id = lo.id AND l.status = 'live') live
    FROM localities lo WHERE lo.city_id = ? ORDER BY lo.name`).all(cityId) as LocalityStat[];
}

export async function getLocality(citySlug: string, slug: string) {
  return await db.prepare(`
    SELECT lo.*, c.slug city_slug, c.name city_name FROM localities lo JOIN cities c ON c.id = lo.city_id
    WHERE c.slug = ? AND lo.slug = ?`).get(citySlug, slug) as LocalityRow | undefined;
}

export async function getLocalityById(id: number) {
  return await db.prepare(`
    SELECT lo.*, c.slug city_slug, c.name city_name FROM localities lo JOIN cities c ON c.id = lo.city_id WHERE lo.id = ?`).get(id) as LocalityRow | undefined;
}

export async function priceTrend(localityId: number, months = 36) {
  const rows = await db.prepare("SELECT month, avg_price_sqft psf, avg_rent_2bhk rent FROM price_trends WHERE locality_id = ? ORDER BY month DESC LIMIT ?").all(localityId, months) as Array<{ month: string; psf: number; rent: number }>;
  return rows.reverse();
}

export const pctChange = (now: number | null, then: number | null) => (now && then ? ((now - then) / then) * 100 : null);

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export type Landmark = { name: string; kind: string; lat?: number; lng?: number };
export function parseLandmarks(s: string | null): Landmark[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => x && typeof x.name === "string") : [];
  } catch {
    return [];
  }
}

export const LANDMARK_KINDS: Record<string, string> = {
  school: "Schools", hospital: "Hospitals", metro: "Metro & transit", mall: "Malls & markets", it_park: "IT parks & offices",
};
