"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { audit, db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { BULK_COLUMNS, parseCsv } from "@/lib/supply/csv";
import { EMPTY_DRAFT, issuesToErrors, listingSchema, type ListingDraft } from "@/lib/supply/listing-schema";
import { saveListing } from "@/lib/supply/listing-service";

export type BulkResult = {
  ok: boolean;
  message?: string;
  created: Array<{ row: number; id: number; title: string; flagged: boolean }>;
  errors: Array<{ row: number; messages: string[] }>;
  total: number;
} | null;

const MAX_ROWS = 200;
const yes = (v: string) => ["yes", "y", "true", "1"].includes(v.trim().toLowerCase());
const list = (v: string) => v.split(/[|;]/).map((x) => x.trim().toLowerCase()).filter(Boolean);

/** Bulk CSV upload for agents and builders (PRD P7): validates each row and creates pending listings for valid rows. */
export async function bulkUploadAction(_prev: BulkResult, fd: FormData): Promise<BulkResult> {
  const user = await getUser();
  const empty = { created: [], errors: [], total: 0 };
  if (!user) return { ok: false, message: "Log in again.", ...empty };
  if (!["agent", "builder", "admin"].includes(user.role)) return { ok: false, message: "Bulk upload is available to agents and builders.", ...empty };
  if (!rateLimit(`bulk:${user.id}`, 10, 3600).ok) return { ok: false, message: "Too many bulk uploads this hour. Try again later.", ...empty };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a CSV file to upload.", ...empty };
  if (file.size > 2 * 1024 * 1024) return { ok: false, message: "The file is larger than 2 MB. Split it into smaller files.", ...empty };
  const text = await file.text();
  if (text.includes("\u0000")) return { ok: false, message: "That doesn't look like a CSV file. Save the sheet as CSV (UTF-8) and try again.", ...empty };
  const rows = parseCsv(text);
  if (rows.length < 2) return { ok: false, message: "The file has no data rows. Use the template and add one listing per row.", ...empty };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = ["transaction_type", "property_type", "city", "locality", "price", "description"].filter((c) => !header.includes(c));
  if (missing.length) return { ok: false, message: `Missing required columns: ${missing.join(", ")}. Download the template for the exact headers.`, ...empty };
  const unknown = header.filter((h) => h && !(BULK_COLUMNS as readonly string[]).includes(h));
  const data = rows.slice(1);
  if (data.length > MAX_ROWS) return { ok: false, message: `Up to ${MAX_ROWS} rows per upload. This file has ${data.length}.`, ...empty };

  const cities = db.prepare("SELECT id, name, slug FROM cities").all() as { id: number; name: string; slug: string }[];
  const locs = db.prepare("SELECT id, city_id, name, slug, lat, lng FROM localities").all() as { id: number; city_id: number; name: string; slug: string; lat: number; lng: number }[];
  const created: NonNullable<BulkResult>["created"] = [];
  const errors: NonNullable<BulkResult>["errors"] = [];

  data.forEach((cells, idx) => {
    const rowNo = idx + 2; // spreadsheet row number (header is row 1)
    const get = (k: string) => (cells[header.indexOf(k)] ?? "").trim();
    const msgs: string[] = [];
    const cityRaw = get("city").toLowerCase();
    const city = cities.find((c) => c.name.toLowerCase() === cityRaw || c.slug === cityRaw);
    if (!city) msgs.push(`city: "${get("city")}" isn't a city we cover (${cities.map((c) => c.name).join(", ")})`);
    const locRaw = get("locality").toLowerCase();
    const loc = city ? locs.find((l) => l.city_id === city.id && (l.name.toLowerCase() === locRaw || l.slug === locRaw)) : undefined;
    if (city && !loc) msgs.push(`locality: "${get("locality")}" not found in ${city.name}`);
    const tx = get("transaction_type").toLowerCase();
    const type = get("property_type").toLowerCase();
    const lat = get("latitude") ? Number(get("latitude")) : loc?.lat ?? null;
    const lng = get("longitude") ? Number(get("longitude")) : loc?.lng ?? null;
    const draft: ListingDraft = {
      ...EMPTY_DRAFT,
      transaction_type: (tx === "sale" ? "sell" : tx) as ListingDraft["transaction_type"],
      category: ((get("category") || (["office", "shop", "warehouse"].includes(type) ? "commercial" : "residential")).toLowerCase()) as ListingDraft["category"],
      property_type: type,
      city_id: city ? String(city.id) : "",
      locality_id: loc ? String(loc.id) : "",
      address: get("address"),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      bhk: get("bhk"), bathrooms: get("bathrooms"), balconies: get("balconies"),
      carpet_area: get("carpet_area"), builtup_area: get("builtup_area"), super_area: get("super_area"), plot_area: get("plot_area"),
      floor: get("floor"), total_floors: get("total_floors"), facing: get("facing"), age_years: get("age_years"),
      furnishing: get("furnishing").toLowerCase().replace(/^semi.*/, "semi").replace(/^fully.*/, "furnished"),
      construction_status: get("construction_status").toLowerCase().replace(/\s+/g, "_") || (tx === "sell" ? "ready" : ""),
      possession_date: get("possession_date"), rera_id: get("rera_id").toUpperCase(),
      tenant_types: list(get("tenant_types")), available_from: get("available_from"), deposit: get("deposit"),
      pg_sharing: list(get("pg_sharing")), pg_meals: yes(get("pg_meals")),
      price: get("price").replace(/[₹,\s]/g, ""), price_negotiable: yes(get("price_negotiable")), maintenance: get("maintenance"),
      amenities: list(get("amenities")), photos: [], video: null, floorplan: null,
      description: get("description"),
    };
    if (!msgs.length) {
      const r = listingSchema.safeParse(draft);
      if (!r.success) {
        const errs = issuesToErrors(r.error.issues);
        // Cross-field rules only run once the base shape parses; probe with placeholders to report them in the same pass.
        const probe = listingSchema.safeParse({ ...draft, price: errs.price ? "1000000" : draft.price, description: errs.description ? "Placeholder description for validation only." : draft.description });
        if (!probe.success) for (const [k, v] of Object.entries(issuesToErrors(probe.error.issues))) if (!errs[k] && k !== "price" && k !== "description") errs[k] = v;
        for (const [k, v] of Object.entries(errs)) msgs.push(`${k === "lat" ? "latitude/longitude" : k}: ${v}`);
      } else {
        const s = saveListing(user, r.data, null, "bulk");
        if (!s.ok) msgs.push(...Object.values(s.errors));
        else {
          const f = s.flags;
          const title = (db.prepare("SELECT title FROM listings WHERE id = ?").get(s.id) as { title: string }).title;
          created.push({ row: rowNo, id: s.id, title, flagged: f.duplicate || f.priceOutlier || f.duplicateImages });
        }
      }
    }
    if (msgs.length) errors.push({ row: rowNo, messages: msgs });
  });

  audit(user.id, "listing.bulk_upload", "user", user.id, { file: file.name, rows: data.length, created: created.length, failed: errors.length });
  if (created.length) {
    notify(user.id, { kind: "moderation", title: `${created.length} listings submitted for review`, body: `From ${file.name}. They usually go live within 24 hours.`, link: "/dashboard/listings?tab=pending" }, ["email"]);
    revalidatePath("/dashboard", "layout");
  }
  return {
    ok: true,
    message: unknown.length ? `Ignored unknown columns: ${unknown.join(", ")}` : undefined,
    created, errors, total: data.length,
  };
}
