import "server-only";
import { db } from "@/lib/db";

export type AdminListing = {
  id: number; user_id: number; posted_by_type: string; title: string; transaction_type: string; category: string; property_type: string;
  city_id: number; locality_id: number | null; project_id: number | null; address: string | null; price: number; price_negotiable: number;
  maintenance: number | null; deposit: number | null; bhk: number | null; bathrooms: number | null; carpet_area: number | null;
  builtup_area: number | null; super_area: number | null; plot_area: number | null; floor: number | null; total_floors: number | null;
  furnishing: string | null; construction_status: string | null; rera_id: string | null; verified: number; verification_requested_at: string | null;
  description: string | null; status: string; reject_reason: string | null; auto_flags: string | null; featured: number; premium: number;
  dup_hash: string | null; created_at: string; updated_at: string; published_at: string | null; expires_at: string | null;
  city_name: string; locality_name: string | null; project_name: string | null;
  poster_name: string | null; poster_phone: string | null; poster_email: string | null; poster_role: string; poster_kyc: string;
  poster_blocked: number; poster_created: string; poster_company: string | null;
};

export const ADMIN_LISTING_SELECT = `
  SELECT l.*, c.name city_name, lo.name locality_name, p.name project_name,
    u.name poster_name, u.phone poster_phone, u.email poster_email, u.role poster_role, u.kyc_status poster_kyc,
    u.blocked poster_blocked, u.created_at poster_created, pr.company_name poster_company
  FROM listings l
  JOIN users u ON u.id = l.user_id
  LEFT JOIN profiles pr ON pr.user_id = l.user_id
  JOIN cities c ON c.id = l.city_id
  LEFT JOIN localities lo ON lo.id = l.locality_id
  LEFT JOIN projects p ON p.id = l.project_id
`;

export async function getAdminListing(id: number) {
  return await db.prepare(`${ADMIN_LISTING_SELECT} WHERE l.id = ?`).get(id) as AdminListing | undefined;
}

export const areaOf = (l: Pick<AdminListing, "carpet_area" | "super_area" | "builtup_area" | "plot_area">) =>
  l.carpet_area ?? l.super_area ?? l.builtup_area ?? l.plot_area ?? null;

export type Flag = { key: string; tone: "danger" | "warn" | "neutral"; label: string; detail?: string; link?: { href: string; label: string }[] };

const PHONE_RE = /(?:\+?91[\s-]?)?(?<!\d)[6-9](?:[\s-]?\d){9}(?!\d)/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const CONTACT_WORDS = /\b(whats\s?app|call me|contact me on|ping me)\b/i;

/** Combines stored auto-check results (P3) with checks computed now against the live catalogue. */
export async function computeFlags(l: AdminListing): Promise<{ flags: Flag[]; ppsf: number | null; localityAvg: number | null; deviation: number | null }> {
  const flags: Flag[] = [];
  let stored: Record<string, unknown> = {};
  try { stored = l.auto_flags ? JSON.parse(l.auto_flags) : {}; } catch { /* ignore malformed */ }

  // Duplicates: explicit duplicateOf from the posting checks + same dup_hash elsewhere.
  const dupIds = new Set<number>();
  if (typeof stored.duplicateOf === "number") dupIds.add(stored.duplicateOf);
  if (l.dup_hash) {
    for (const r of await db.prepare("SELECT id FROM listings WHERE dup_hash = ? AND id <> ? AND status IN ('live','pending','paused') LIMIT 5").all(l.dup_hash, l.id) as { id: number }[]) dupIds.add(r.id);
  }
  if (stored.duplicate || dupIds.size) {
    flags.push({
      key: "duplicate", tone: "danger", label: "Possible duplicate",
      detail: "Same locality, type, BHK and price as an existing listing.",
      link: [...dupIds].map((id) => ({ href: `/admin/listings/${id}`, label: `Original #${id}` })),
    });
  }

  // Image reuse: identical photo bytes used on another listing.
  const reused = await db.prepare(`
    SELECT DISTINCT m2.listing_id id FROM listing_media m1
    JOIN listing_media m2 ON m2.sha256 = m1.sha256 AND m2.listing_id <> m1.listing_id
    WHERE m1.listing_id = ? AND m1.sha256 IS NOT NULL LIMIT 5`).all(l.id) as { id: number }[];
  if (reused.length || stored.imagesOk === false) {
    flags.push({
      key: "images", tone: "danger", label: "Image reuse",
      detail: reused.length ? `${reused.length} photo match${reused.length > 1 ? "es" : ""} on other listings.` : "Automated image check failed (low resolution or seen before).",
      link: reused.map((r) => ({ href: `/admin/listings/${r.id}`, label: `#${r.id}` })),
    });
  }

  // Price outlier vs locality average price per sq ft for the same transaction type.
  const area = areaOf(l);
  const ppsf = area ? l.price / area : null;
  let localityAvg: number | null = null, deviation: number | null = null;
  if (l.locality_id && ppsf) {
    const r = await db.prepare(`
      SELECT AVG(price * 1.0 / COALESCE(carpet_area, super_area, builtup_area, plot_area)) a, COUNT(*) n FROM listings
      WHERE locality_id = ? AND transaction_type = ? AND status = 'live' AND id <> ? AND COALESCE(carpet_area, super_area, builtup_area, plot_area) > 0`).get(l.locality_id, l.transaction_type, l.id) as { a: number | null; n: number };
    if (r.a && r.n >= 2) {
      localityAvg = r.a;
      deviation = (ppsf - r.a) / r.a;
    }
  }
  if (stored.priceOutlier || (deviation != null && Math.abs(deviation) > 0.4)) {
    flags.push({
      key: "price", tone: "warn", label: "Price outlier",
      detail: deviation != null
        ? `₹${Math.round(ppsf!).toLocaleString("en-IN")}/sq ft is ${Math.abs(Math.round(deviation * 100))}% ${deviation > 0 ? "above" : "below"} the ${l.locality_name ?? "locality"} average of ₹${Math.round(localityAvg!).toLocaleString("en-IN")}/sq ft.`
        : "Flagged by the posting checks as far from the locality average.",
    });
  }

  // Contact details in the description (policy: contact goes through 10cent's lead flow).
  const d = l.description ?? "";
  const phone = d.match(PHONE_RE)?.[0], email = d.match(EMAIL_RE)?.[0], words = d.match(CONTACT_WORDS)?.[0];
  if (phone || email || words) {
    flags.push({ key: "contact", tone: "warn", label: "Contact info in description", detail: [phone && `phone “${phone.trim()}”`, email && `email “${email}”`, words && `“${words}”`].filter(Boolean).join(", ") });
  }

  if (stored.phoneValid === false) flags.push({ key: "phone", tone: "warn", label: "Phone not verified" });
  if (l.poster_blocked) flags.push({ key: "blocked", tone: "danger", label: "Poster is blocked" });
  return { flags, ppsf, localityAvg, deviation };
}

export async function posterHistory(userId: number) {
  const byStatus = await db.prepare("SELECT status, COUNT(*) n FROM listings WHERE user_id = ? GROUP BY status").all(userId) as { status: string; n: number }[];
  const reports = await db.prepare("SELECT COUNT(*) n, SUM(status = 'actioned') actioned FROM reports WHERE reported_user_id = ?").get(userId) as { n: number; actioned: number | null };
  const last = await db.prepare("SELECT ml.action, ml.reason, ml.created_at, ml.listing_id FROM moderation_logs ml JOIN listings l ON l.id = ml.listing_id WHERE l.user_id = ? AND ml.action IN ('rejected','takedown') ORDER BY ml.id DESC LIMIT 3").all(userId) as { action: string; reason: string | null; created_at: string; listing_id: number }[];
  const sub = await db.prepare("SELECT p.name FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = ? AND s.status = 'active' AND s.ends_at > ? ORDER BY s.ends_at DESC LIMIT 1").get(userId, new Date().toISOString()) as { name: string } | undefined;
  const total = byStatus.reduce((a, b) => a + b.n, 0);
  return { byStatus, total, reports: reports.n, actioned: reports.actioned ?? 0, last, plan: sub?.name ?? null };
}

export async function photos(listingId: number) {
  return await db.prepare("SELECT id, url, kind, caption FROM listing_media WHERE listing_id = ? ORDER BY kind = 'photo' DESC, sort").all(listingId) as { id: number; url: string; kind: string; caption: string | null }[];
}

export async function modLog(listingId: number) {
  return await db.prepare("SELECT ml.*, u.name actor_name FROM moderation_logs ml LEFT JOIN users u ON u.id = ml.actor_id WHERE ml.listing_id = ? ORDER BY ml.id DESC").all(listingId) as { id: number; action: string; reason: string | null; created_at: string; actor_name: string | null }[];
}
