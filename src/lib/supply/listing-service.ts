import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, nowIso, UPLOAD_DIR } from "@/lib/db";
import { normalizePhone, type User } from "@/lib/auth";
import { listingHeadline } from "@/lib/format";
import { activePlan, listingQuota } from "./account";
import { stripContactInfo, type ListingInput } from "./listing-schema";

export type AutoFlags = {
  duplicate: boolean;
  duplicateOf?: number;
  duplicateReason?: string;
  duplicateImages: boolean;
  duplicateImagesOf?: number[];
  imagesOk: boolean;
  phoneValid: boolean;
  priceOutlier: boolean;
  priceRatio?: number;
  localityAvg?: number;
  contactInDescription: boolean;
  checkedAt: string;
};

const area = (d: { carpet_area: number | null; super_area: number | null; builtup_area: number | null; plot_area: number | null }) =>
  d.carpet_area ?? d.super_area ?? d.builtup_area ?? d.plot_area ?? null;

/** Latest locality averages from price_trends. */
export function localityAverages(localityId: number) {
  return db.prepare("SELECT avg_price_sqft, avg_rent_2bhk, month FROM price_trends WHERE locality_id = ? ORDER BY month DESC LIMIT 1").get(localityId) as
    | { avg_price_sqft: number; avg_rent_2bhk: number; month: string }
    | undefined;
}

/** Re-hash an uploaded file from disk so clients can't spoof the image fingerprint. */
function fileSha(url: string): string | null {
  const name = url.replace(/^\/api\/media\//, "");
  if (!/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(name)) return null;
  const p = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(p)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

/** Automated checks run on every submission (PRD P3). Pure read; caller stores the result. */
export function runAutoChecks(d: ListingInput, opts: { userId: number; listingId?: number | null; phone: string | null; photoHashes: string[] }): AutoFlags {
  const self = opts.listingId ?? -1;
  const a = area(d);
  const flags: AutoFlags = {
    duplicate: false, duplicateImages: false, imagesOk: true, phoneValid: !!(opts.phone && normalizePhone(opts.phone)),
    priceOutlier: false, contactInDescription: false, checkedAt: nowIso(),
  };

  // 1. Duplicate listing: same locality + type + BHK with area and price within 5%.
  if (a) {
    const dup = db.prepare(
      `SELECT id FROM listings WHERE id <> ? AND status IN ('live','pending') AND locality_id = ? AND property_type = ? AND transaction_type = ?
         AND COALESCE(bhk, -1) = COALESCE(?, -1)
         AND COALESCE(carpet_area, super_area, builtup_area, plot_area) BETWEEN ? AND ?
         AND price BETWEEN ? AND ? LIMIT 1`
    ).get(self, d.locality_id, d.property_type, d.transaction_type, d.bhk, a * 0.95, a * 1.05, d.price * 0.95, d.price * 1.05) as { id: number } | undefined;
    if (dup) { flags.duplicate = true; flags.duplicateOf = dup.id; flags.duplicateReason = "Same locality, type, size and price as another listing"; }
  }
  if (!flags.duplicate && d.address.trim().length >= 3) {
    const same = db.prepare(
      `SELECT id FROM listings WHERE id <> ? AND user_id = ? AND status IN ('live','pending','paused') AND lower(trim(address)) = lower(trim(?))
         AND transaction_type = ? AND COALESCE(bhk,-1) = COALESCE(?,-1) LIMIT 1`
    ).get(self, opts.userId, d.address, d.transaction_type, d.bhk) as { id: number } | undefined;
    if (same) { flags.duplicate = true; flags.duplicateOf = same.id; flags.duplicateReason = "You already have an active listing at this address"; }
  }

  // 2. Duplicate images: any photo already used by another listing.
  if (opts.photoHashes.length) {
    const rows = db.prepare(
      `SELECT DISTINCT listing_id FROM listing_media WHERE sha256 IN (${opts.photoHashes.map(() => "?").join(",")}) AND listing_id <> ? LIMIT 5`
    ).all(...opts.photoHashes, self) as { listing_id: number }[];
    if (rows.length) { flags.duplicateImages = true; flags.duplicateImagesOf = rows.map((r) => r.listing_id); flags.imagesOk = false; }
  }

  // 3. Price outlier vs locality average.
  const avg = localityAverages(d.locality_id);
  if (avg) {
    if (d.transaction_type === "sell" && d.category === "residential" && d.property_type !== "plot" && a) {
      const psf = d.price / a;
      flags.localityAvg = avg.avg_price_sqft;
      flags.priceRatio = Math.round((psf / avg.avg_price_sqft) * 100) / 100;
    } else if (d.transaction_type === "rent" && d.category === "residential" && d.bhk) {
      const expected = avg.avg_rent_2bhk * Math.max(0.6, d.bhk / 2);
      flags.localityAvg = avg.avg_rent_2bhk;
      flags.priceRatio = Math.round((d.price / expected) * 100) / 100;
    }
    if (flags.priceRatio != null && (flags.priceRatio > 2 || flags.priceRatio < 0.4)) flags.priceOutlier = true;
  }
  return flags;
}

export function flagsSummary(f: AutoFlags): string {
  const issues: string[] = [];
  if (f.duplicate) issues.push(`possible duplicate of #${f.duplicateOf}`);
  if (f.duplicateImages) issues.push(`photos reused from #${f.duplicateImagesOf?.join(", #")}`);
  if (!f.phoneValid) issues.push("poster phone not verified");
  if (f.priceOutlier) issues.push(`price ${f.priceRatio}x locality average`);
  if (f.contactInDescription) issues.push("contact details removed from description");
  return issues.length ? `Flagged: ${issues.join("; ")}` : "Passed: phone valid, no duplicate found, images ok, price in range";
}

export type SaveResult =
  | { ok: true; id: number; flags: AutoFlags; status: string }
  | { ok: false; errors: Record<string, string>; limit?: { used: number; limit: number } };

/**
 * Creates or updates a listing from validated input. Enforces the listing quota on create,
 * runs auto checks, writes moderation logs and notifies the poster.
 */
export function saveListing(user: User, d: ListingInput, editId: number | null, source: "form" | "bulk" = "form"): SaveResult {
  const city = db.prepare("SELECT id, name FROM cities WHERE id = ?").get(d.city_id) as { id: number; name: string } | undefined;
  if (!city) return { ok: false, errors: { city_id: "Choose a city" } };
  const loc = db.prepare("SELECT id, name, lat, lng FROM localities WHERE id = ? AND city_id = ?").get(d.locality_id, d.city_id) as { id: number; name: string; lat: number; lng: number } | undefined;
  if (!loc) return { ok: false, errors: { locality_id: "Choose a locality in this city" } };

  let existing: { id: number; user_id: number; status: string; published_at: string | null } | undefined;
  if (editId) {
    existing = db.prepare("SELECT id, user_id, status, published_at FROM listings WHERE id = ?").get(editId) as typeof existing;
    if (!existing || (existing.user_id !== user.id && user.role !== "admin")) return { ok: false, errors: { form: "You can't edit this listing." } };
    if (["removed", "sold", "rented"].includes(existing.status)) return { ok: false, errors: { form: "This listing is closed and can't be edited. Post a new one instead." } };
  } else {
    const q = listingQuota(user.id);
    if (q.used >= q.limit) {
      return { ok: false, errors: { form: `You've used all ${q.limit} listings on your plan. Upgrade to post more, or pause/close an old listing.` }, limit: { used: q.used, limit: q.limit } };
    }
  }

  const posterId = existing?.user_id ?? user.id;
  const poster = existing && existing.user_id !== user.id ? (db.prepare("SELECT * FROM users WHERE id = ?").get(posterId) as User) : user;

  // A seeker who posts becomes an owner (PRD P1).
  let postedBy: "owner" | "agent" | "builder" = poster.role === "agent" ? "agent" : poster.role === "builder" ? "builder" : "owner";
  if (poster.role === "seeker") {
    db.prepare("UPDATE users SET role = 'owner' WHERE id = ? AND role = 'seeker'").run(poster.id);
    postedBy = "owner";
  }

  // Media hashes recomputed from disk.
  // Library illustrations (/api/art) are only kept if they already belonged to this listing.
  const keptArt = new Set(
    editId ? (db.prepare("SELECT url FROM listing_media WHERE listing_id = ? AND url LIKE '/api/art/%'").all(editId) as { url: string }[]).map((r) => r.url) : []
  );
  const photos = d.photos.map((p) => ({ url: p.url, sha256: p.url.startsWith("/api/art/") ? null : fileSha(p.url), art: p.url.startsWith("/api/art/") }));
  if (photos.some((p) => (p.art ? !keptArt.has(p.url) : !p.sha256))) return { ok: false, errors: { photos: "One of the photos is missing. Remove it and upload again." } };
  const one = (m: { url: string } | null) => (m ? { url: m.url, sha256: m.url.startsWith("/api/art/") ? null : fileSha(m.url), ok: m.url.startsWith("/api/art/") ? keptArt.has(m.url) : !!fileSha(m.url) } : null);
  const video = one(d.video);
  const floorplan = one(d.floorplan);
  if ((video && !video.ok) || (floorplan && !floorplan.ok)) return { ok: false, errors: { photos: "The video or floor plan file is missing. Upload it again." } };

  const cleaned = stripContactInfo(d.description);
  const flags = runAutoChecks(d, { userId: posterId, listingId: editId, phone: poster.phone, photoHashes: photos.filter((p) => p.sha256).map((p) => p.sha256!) });
  flags.contactInDescription = cleaned.found;

  const title = listingHeadline({ bhk: d.bhk, property_type: d.property_type, transaction_type: d.transaction_type, locality_name: loc.name, city_name: city.name }) +
    (d.transaction_type === "pg" ? ` (${d.tenant_types.includes("girls") && d.tenant_types.includes("boys") ? "Co-living" : d.tenant_types.includes("girls") ? "Girls" : "Boys"})` : "");
  const isPlot = d.property_type === "plot";
  const isPg = d.transaction_type === "pg";
  const plan = activePlan(posterId);
  const dupHash = crypto.createHash("sha1").update(`${d.locality_id}|${d.property_type}|${d.transaction_type}|${d.bhk ?? ""}`).digest("hex").slice(0, 16);
  const now = nowIso();

  const row = {
    title,
    transaction_type: d.transaction_type,
    category: d.category,
    property_type: d.property_type,
    city_id: d.city_id,
    locality_id: d.locality_id,
    address: d.address,
    lat: d.lat ?? loc.lat,
    lng: d.lng ?? loc.lng,
    price: d.price,
    price_negotiable: d.price_negotiable ? 1 : 0,
    maintenance: d.maintenance,
    deposit: d.transaction_type === "sell" ? null : d.deposit,
    bhk: isPlot || isPg || !["apartment", "house", "villa"].includes(d.property_type) ? null : d.bhk,
    bathrooms: isPlot ? null : d.bathrooms,
    balconies: isPlot || isPg ? null : d.balconies,
    carpet_area: isPlot ? null : d.carpet_area,
    builtup_area: isPlot ? null : d.builtup_area,
    super_area: isPlot ? null : d.super_area,
    plot_area: d.property_type === "villa" || d.property_type === "house" || isPlot ? d.plot_area : null,
    floor: isPlot ? null : d.floor,
    total_floors: isPlot ? null : d.total_floors,
    facing: d.facing,
    age_years: d.construction_status === "under_construction" ? null : d.age_years,
    furnishing: isPlot ? null : d.furnishing,
    construction_status: d.transaction_type === "sell" && !isPlot ? d.construction_status : "ready",
    possession_date: d.construction_status === "under_construction" ? d.possession_date : null,
    new_launch: 0,
    rera_id: d.rera_id,
    tenant_types: d.transaction_type === "sell" ? null : d.tenant_types.join(",") || null,
    available_from: d.transaction_type === "sell" ? null : d.available_from,
    pg_sharing: isPg ? d.pg_sharing.join(",") : null,
    pg_meals: isPg ? (d.pg_meals ? 1 : 0) : null,
    description: cleaned.text,
    auto_flags: JSON.stringify(flags),
    dup_hash: dupHash,
    updated_at: now,
  };

  let id: number;
  const tx = db.transaction(() => {
    if (existing) {
      const cols = Object.keys(row);
      db.prepare(`UPDATE listings SET ${cols.map((c) => `${c} = @${c}`).join(", ")}, status = 'pending', reject_reason = NULL WHERE id = @id`).run({ ...row, id: existing.id });
      id = existing.id;
      db.prepare("DELETE FROM listing_media WHERE listing_id = ?").run(id);
      db.prepare("DELETE FROM listing_amenities WHERE listing_id = ?").run(id);
      db.prepare("INSERT INTO moderation_logs (listing_id, actor_id, action, reason) VALUES (?,?,?,?)").run(id, user.id, "edited", existing.status === "live" ? "Edited while live; sent back for review" : `Edited (was ${existing.status})`);
    } else {
      const full = { ...row, user_id: posterId, posted_by_type: postedBy, status: "pending", boost: plan?.boost ?? 0, premium: (plan?.boost ?? 0) >= 2 ? 1 : 0, created_at: now };
      const cols = Object.keys(full);
      const info = db.prepare(`INSERT INTO listings (${cols.join(", ")}) VALUES (${cols.map((c) => `@${c}`).join(", ")})`).run(full);
      id = Number(info.lastInsertRowid);
      db.prepare("INSERT INTO moderation_logs (listing_id, actor_id, action, reason) VALUES (?,?,?,?)").run(id, user.id, "submitted", source === "bulk" ? "Bulk CSV upload" : null);
    }
    const insM = db.prepare("INSERT INTO listing_media (listing_id, kind, url, sha256, sort) VALUES (?,?,?,?,?)");
    photos.forEach((p, i) => insM.run(id, "photo", p.url, p.sha256, i));
    if (video) insM.run(id, "video", video.url, video.sha256, 0);
    if (floorplan) insM.run(id, "floorplan", floorplan.url, floorplan.sha256, 0);
    const insA = db.prepare("INSERT OR IGNORE INTO listing_amenities (listing_id, amenity) VALUES (?,?)");
    d.amenities.forEach((a) => insA.run(id, a));
    db.prepare("INSERT INTO moderation_logs (listing_id, actor_id, action, reason) VALUES (?,?,?,?)").run(id, null, "auto_check", flagsSummary(flags));
  });
  tx();
  return { ok: true, id: id!, flags, status: "pending" };
}

/** Loads a listing into the client form shape for editing. */
export function listingToDraft(id: number): (import("./listing-schema").ListingDraft & { _user_id: number; _status: string }) | null {
  const l = db.prepare("SELECT * FROM listings WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!l) return null;
  const media = db.prepare("SELECT kind, url, sha256 FROM listing_media WHERE listing_id = ? ORDER BY sort, id").all(id) as { kind: string; url: string; sha256: string | null }[];
  const amen = (db.prepare("SELECT amenity FROM listing_amenities WHERE listing_id = ?").all(id) as { amenity: string }[]).map((a) => a.amenity);
  const s = (v: unknown) => (v == null ? "" : String(v));
  const list = (v: unknown) => (v ? String(v).split(",").filter(Boolean) : []);
  const toRef = (m?: { url: string; sha256: string | null }) => (m ? { url: m.url, sha256: m.sha256 ?? undefined } : null);
  return {
    _user_id: Number(l.user_id),
    _status: String(l.status),
    transaction_type: l.transaction_type as "sell" | "rent" | "pg",
    category: l.category as "residential" | "commercial",
    property_type: String(l.property_type),
    city_id: s(l.city_id),
    locality_id: s(l.locality_id),
    address: s(l.address),
    lat: (l.lat as number) ?? null,
    lng: (l.lng as number) ?? null,
    bhk: s(l.bhk), bathrooms: s(l.bathrooms), balconies: s(l.balconies),
    carpet_area: s(l.carpet_area), builtup_area: s(l.builtup_area), super_area: s(l.super_area), plot_area: s(l.plot_area),
    floor: s(l.floor), total_floors: s(l.total_floors), facing: s(l.facing), age_years: s(l.age_years),
    furnishing: s(l.furnishing), construction_status: s(l.construction_status) || "ready", possession_date: s(l.possession_date).slice(0, 7),
    rera_id: s(l.rera_id), tenant_types: list(l.tenant_types), available_from: s(l.available_from).slice(0, 10), deposit: s(l.deposit),
    pg_sharing: list(l.pg_sharing), pg_meals: !!l.pg_meals,
    price: s(l.price), price_negotiable: !!l.price_negotiable, maintenance: s(l.maintenance),
    amenities: amen,
    photos: media.filter((m) => m.kind === "photo").map((m) => ({ url: m.url, sha256: m.sha256 ?? undefined })),
    video: toRef(media.find((m) => m.kind === "video")),
    floorplan: toRef(media.find((m) => m.kind === "floorplan")),
    description: s(l.description),
  };
}
