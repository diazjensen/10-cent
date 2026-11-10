import "server-only";
import { db } from "./db";

export type ListingCard = {
  id: number;
  title: string;
  transaction_type: string;
  category: string;
  property_type: string;
  price: number;
  bhk: number | null;
  bathrooms: number | null;
  area: number | null;
  area_label: string;
  furnishing: string | null;
  construction_status: string | null;
  possession_date: string | null;
  verified: number;
  featured: number;
  premium: number;
  rera_id: string | null;
  posted_by_type: string;
  poster_name: string | null;
  poster_company: string | null;
  locality_name: string | null;
  locality_slug: string | null;
  city_name: string;
  city_slug: string;
  project_name: string | null;
  lat: number | null;
  lng: number | null;
  cover_url: string | null;
  photo_count: number;
  created_at: string;
  published_at: string | null;
  tenant_types: string | null;
  available_from: string | null;
  status: string;
  user_id: number;
};

export const CARD_SELECT = `
  l.id, l.title, l.transaction_type, l.category, l.property_type, l.price, l.bhk, l.bathrooms,
  COALESCE(l.carpet_area, l.super_area, l.builtup_area, l.plot_area) AS area,
  CASE WHEN l.carpet_area IS NOT NULL THEN 'carpet' WHEN l.super_area IS NOT NULL THEN 'super built-up' WHEN l.builtup_area IS NOT NULL THEN 'built-up' ELSE 'plot' END AS area_label,
  l.furnishing, l.construction_status, l.possession_date, l.verified, l.featured, l.premium, l.rera_id,
  l.posted_by_type, u.name AS poster_name, pr.company_name AS poster_company,
  lo.name AS locality_name, lo.slug AS locality_slug, c.name AS city_name, c.slug AS city_slug,
  p.name AS project_name, l.lat, l.lng,
  (SELECT url FROM listing_media m WHERE m.listing_id = l.id AND m.kind = 'photo' ORDER BY sort LIMIT 1) AS cover_url,
  (SELECT COUNT(*) FROM listing_media m WHERE m.listing_id = l.id AND m.kind = 'photo') AS photo_count,
  l.created_at, l.published_at, l.tenant_types, l.available_from, l.status, l.user_id
`;

export const CARD_FROM = `
  FROM listings l
  JOIN users u ON u.id = l.user_id
  LEFT JOIN profiles pr ON pr.user_id = l.user_id
  JOIN cities c ON c.id = l.city_id
  LEFT JOIN localities lo ON lo.id = l.locality_id
  LEFT JOIN projects p ON p.id = l.project_id
`;

export type SearchFilters = {
  city?: string;          // city slug
  q?: string;             // free text: locality, project, builder, landmark
  loc?: string;           // comma-separated locality ids
  tx?: string;            // sell | rent | pg
  cat?: string;           // residential | commercial
  type?: string;          // comma list of property types
  bhk?: string;           // comma list, 5 = 5+
  min?: string; max?: string;   // price
  amin?: string; amax?: string; // area
  by?: string;            // comma list owner,agent,builder
  furn?: string;          // comma list
  tenant?: string;        // comma list
  avail?: string;         // YYYY-MM-DD: available on or before
  cs?: string;            // ready | under_construction
  poss?: string;          // possession by year (YYYY)
  newlaunch?: string;     // "1"
  rera?: string;          // "1"
  verified?: string;      // "1"
  photos?: string;        // "1"
  am?: string;            // comma list of amenities (all required)
  project?: string;       // project id
  poster?: string;        // user id
  bounds?: string;        // south,west,north,east (map draw / viewport)
  near?: string;          // lat,lng,km
  sort?: string;
  page?: string;
};

const clean = (s: string) => s.replace(/\u0000/g, "");
const list = (s?: string) => (s ? clean(s).split(",").map((x) => x.trim()).filter(Boolean) : []);
/** Whole number within [0, max] (Postgres rejects fractions for int/bigint params and overflows past the column range). */
const num = (s?: string, max = 9e15) => {
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : null;
};
const AREA_MAX = 2e9;
/** Positive int4 id, or null. */
const idNum = (s?: string) => (s && /^\d{1,9}$/.test(s.trim()) && Number(s) > 0 ? Number(s) : null);

export function buildSearchWhere(f: SearchFilters) {
  const where: string[] = ["l.status = 'live'"];
  const args: (string | number)[] = [];

  if (f.city) { where.push("c.slug = ?"); args.push(clean(f.city)); }
  if (f.tx) { where.push("l.transaction_type = ?"); args.push(clean(f.tx)); }
  if (f.cat) { where.push("l.category = ?"); args.push(clean(f.cat)); }
  const types = list(f.type);
  if (types.length) { where.push(`l.property_type IN (${types.map(() => "?").join(",")})`); args.push(...types); }
  const bhks = list(f.bhk).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 100);
  if (bhks.length) {
    const parts = bhks.map((b) => (b >= 5 ? "l.bhk >= 5" : "l.bhk = ?"));
    where.push(`(${parts.join(" OR ")})`);
    args.push(...bhks.filter((b) => b < 5));
  }
  const min = num(f.min), max = num(f.max), amin = num(f.amin, AREA_MAX), amax = num(f.amax, AREA_MAX);
  if (min != null) { where.push("l.price >= ?"); args.push(min); }
  if (max != null) { where.push("l.price <= ?"); args.push(max); }
  if (amin != null) { where.push("COALESCE(l.carpet_area, l.super_area, l.builtup_area, l.plot_area) >= ?"); args.push(amin); }
  if (amax != null) { where.push("COALESCE(l.carpet_area, l.super_area, l.builtup_area, l.plot_area) <= ?"); args.push(amax); }
  const by = list(f.by);
  if (by.length) { where.push(`l.posted_by_type IN (${by.map(() => "?").join(",")})`); args.push(...by); }
  const furn = list(f.furn);
  if (furn.length) { where.push(`l.furnishing IN (${furn.map(() => "?").join(",")})`); args.push(...furn); }
  const tenants = list(f.tenant);
  if (tenants.length) {
    where.push(`(${tenants.map(() => "(',' || l.tenant_types || ',') LIKE ?").join(" OR ")})`);
    args.push(...tenants.map((t) => `%,${t},%`));
  }
  if (f.avail && /^\d{4}-\d{2}-\d{2}$/.test(f.avail)) { where.push("(l.available_from IS NULL OR l.available_from <= ?)"); args.push(f.avail); }
  if (f.cs) { where.push("l.construction_status = ?"); args.push(clean(f.cs)); }
  if (f.poss && /^\d{4}$/.test(f.poss)) { where.push("l.possession_date IS NOT NULL AND substr(l.possession_date,1,4) <= ?"); args.push(f.poss); }
  if (f.newlaunch === "1") where.push("l.new_launch = 1");
  if (f.rera === "1") where.push("l.rera_id IS NOT NULL AND l.rera_id <> ''");
  if (f.verified === "1") where.push("l.verified = 1");
  if (f.photos === "1") where.push("EXISTS (SELECT 1 FROM listing_media m WHERE m.listing_id = l.id AND m.kind='photo')");
  for (const a of list(f.am)) {
    where.push("EXISTS (SELECT 1 FROM listing_amenities la WHERE la.listing_id = l.id AND la.amenity = ?)");
    args.push(a);
  }
  const locs = list(f.loc).map(idNum).filter((n): n is number => n != null);
  if (locs.length) { where.push(`l.locality_id IN (${locs.map(() => "?").join(",")})`); args.push(...locs); }
  if (f.project) { where.push("l.project_id = ?"); args.push(idNum(f.project) ?? 0); }
  if (f.poster) { where.push("l.user_id = ?"); args.push(idNum(f.poster) ?? 0); }
  if (f.q && f.q.trim()) {
    const like = `%${clean(f.q.trim())}%`;
    where.push(`(l.title LIKE ? OR lo.name LIKE ? OR c.name LIKE ? OR p.name LIKE ? OR pr.company_name LIKE ? OR l.address LIKE ? OR lo.landmarks LIKE ?)`);
    args.push(like, like, like, like, like, like, like);
  }
  if (f.bounds) {
    const b = f.bounds.split(",").map(Number);
    if (b.length === 4 && b.every(Number.isFinite)) {
      where.push("l.lat BETWEEN ? AND ? AND l.lng BETWEEN ? AND ?");
      args.push(b[0], b[2], b[1], b[3]);
    }
  }
  if (f.near) {
    const [lat, lng, km] = f.near.split(",").map(Number);
    if ([lat, lng, km].every(Number.isFinite)) {
      // Equirectangular approximation; good enough for city-scale radius filters.
      const dLat = km / 111.0, dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
      where.push("l.lat BETWEEN ? AND ? AND l.lng BETWEEN ? AND ?");
      args.push(lat - dLat, lat + dLat, lng - dLng, lng + dLng);
      where.push("((l.lat - ?) * (l.lat - ?) * 12321.0 + (l.lng - ?) * (l.lng - ?) * ?) <= ?");
      const k = Math.pow(111.32 * Math.cos((lat * Math.PI) / 180), 2);
      args.push(lat, lat, lng, lng, k, km * km);
    }
  }
  return { where: where.join(" AND "), args };
}

const SORT_SQL: Record<string, string> = {
  relevance: "l.boost DESC, l.premium DESC, l.featured DESC, l.verified DESC, (SELECT COUNT(*) FROM listing_media pm WHERE pm.listing_id = l.id AND pm.kind = 'photo') > 0 DESC, l.published_at DESC",
  price_asc: "l.price ASC",
  price_desc: "l.price DESC",
  newest: "l.published_at DESC",
  area_desc: "area DESC",
};

export const PAGE_SIZE = 20;

export async function searchListings(f: SearchFilters, opts: { pageSize?: number; all?: boolean } = {}) {
  const { where, args } = buildSearchWhere(f);
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const page = Math.min(10000, Math.max(1, parseInt(f.page || "1", 10) || 1));
  const order = SORT_SQL[f.sort || "relevance"] ?? SORT_SQL.relevance;
  const total = (await db.prepare(`SELECT COUNT(*) AS n ${CARD_FROM} WHERE ${where}`).get(...args) as { n: number }).n;
  const limit = opts.all ? "LIMIT 500" : `LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
  const rows = await db.prepare(`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE ${where} ORDER BY ${order}, l.id DESC ${limit}`).all(...args) as ListingCard[];
  return { rows, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getCards(ids: number[]): Promise<ListingCard[]> {
  if (!ids.length) return [];
  const rows = await db.prepare(`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE l.id IN (${ids.map(() => "?").join(",")})`).all(...ids) as ListingCard[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as ListingCard[];
}

/** Records impressions for listings shown in a result list (PRD O5). */
export async function recordImpressions(ids: number[]) {
  if (!ids.length) return;
  const day = new Date().toISOString().slice(0, 10);
  const stmt = db.prepare(
    "INSERT INTO listing_stats (listing_id, day, impressions) VALUES (?, ?, 1) ON CONFLICT(listing_id, day) DO UPDATE SET impressions = listing_stats.impressions + 1"
  );
  // Lock rows in a consistent (ascending) order so concurrent searches can't deadlock each other.
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  await db.transaction(async () => { for (const id of sorted) await stmt.run(id, day); })();
}

export async function bumpStat(listingId: number, col: "views" | "contacts" | "shortlists", by = 1) {
  const day = new Date().toISOString().slice(0, 10);
  await db.prepare(
        `INSERT INTO listing_stats (listing_id, day, ${col}) VALUES (?, ?, ?) ON CONFLICT(listing_id, day) DO UPDATE SET ${col} = listing_stats.${col} + ?`
      ).run(listingId, day, by, by);
}

export async function getCities() {
  return await db.prepare("SELECT * FROM cities ORDER BY sort, name").all() as Array<{ id: number; slug: string; name: string; state: string; lat: number; lng: number; is_launch: number }>;
}

export async function getCity(slug: string) {
  return await db.prepare("SELECT * FROM cities WHERE slug = ?").get(slug) as { id: number; slug: string; name: string; state: string; lat: number; lng: number } | undefined;
}

export async function getLocalities(cityId: number) {
  return await db.prepare("SELECT id, slug, name, lat, lng, rating, trending FROM localities WHERE city_id = ? ORDER BY name").all(cityId) as Array<{ id: number; slug: string; name: string; lat: number; lng: number; rating: number | null; trending: number }>;
}
