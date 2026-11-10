// Shared (client + server) shape and validation for the post-property form (PRD P1, P2).
import { z } from "zod";
import { AMENITIES, FACING, FURNISHING, MAX_PHOTOS, TENANT_TYPES } from "@/lib/constants";

export type MediaRef = { url: string; sha256?: string; name?: string };

/** Client-side form state. Numbers are kept as strings so inputs stay controlled. */
export type ListingDraft = {
  transaction_type: "sell" | "rent" | "pg";
  category: "residential" | "commercial";
  property_type: string;
  city_id: string;
  locality_id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  bhk: string;
  bathrooms: string;
  balconies: string;
  carpet_area: string;
  builtup_area: string;
  super_area: string;
  plot_area: string;
  floor: string;
  total_floors: string;
  facing: string;
  age_years: string;
  furnishing: string;
  construction_status: string;
  possession_date: string;
  rera_id: string;
  tenant_types: string[];
  available_from: string;
  deposit: string;
  pg_sharing: string[];
  pg_meals: boolean;
  price: string;
  price_negotiable: boolean;
  maintenance: string;
  amenities: string[];
  photos: MediaRef[];
  video: MediaRef | null;
  floorplan: MediaRef | null;
  description: string;
};

export const EMPTY_DRAFT: ListingDraft = {
  transaction_type: "sell",
  category: "residential",
  property_type: "apartment",
  city_id: "",
  locality_id: "",
  address: "",
  lat: null,
  lng: null,
  bhk: "",
  bathrooms: "",
  balconies: "",
  carpet_area: "",
  builtup_area: "",
  super_area: "",
  plot_area: "",
  floor: "",
  total_floors: "",
  facing: "",
  age_years: "",
  furnishing: "",
  construction_status: "ready",
  possession_date: "",
  rera_id: "",
  tenant_types: [],
  available_from: "",
  deposit: "",
  pg_sharing: [],
  pg_meals: false,
  price: "",
  price_negotiable: false,
  maintenance: "",
  amenities: [],
  photos: [],
  video: null,
  floorplan: null,
  description: "",
};

export const TYPES_FOR: Record<string, Record<string, string[]>> = {
  sell: { residential: ["apartment", "house", "villa", "plot"], commercial: ["office", "shop", "warehouse", "plot"] },
  rent: { residential: ["apartment", "house", "villa"], commercial: ["office", "shop", "warehouse"] },
  pg: { residential: ["pg"], commercial: [] },
};

export const isHome = (t: string) => ["apartment", "house", "villa"].includes(t);
export const isCommercialBuilt = (t: string) => ["office", "shop", "warehouse"].includes(t);
export const PG_SHARING = [
  { value: "single", label: "Single room" },
  { value: "double", label: "Twin sharing" },
  { value: "triple", label: "Triple sharing" },
] as const;

/** Which form step each field lives on (1-based), for jumping to server errors. */
export const FIELD_STEP: Record<string, number> = {
  transaction_type: 1, category: 1, property_type: 1, city_id: 1,
  locality_id: 2, address: 2, lat: 2, lng: 2,
  bhk: 3, bathrooms: 3, balconies: 3, carpet_area: 3, builtup_area: 3, super_area: 3, plot_area: 3, area: 3,
  floor: 3, total_floors: 3, facing: 3, age_years: 3, furnishing: 3, construction_status: 3, possession_date: 3,
  rera_id: 3, tenant_types: 3, available_from: 3, deposit: 3, pg_sharing: 3, pg_meals: 3,
  price: 4, price_negotiable: 4, maintenance: 4,
  amenities: 5,
  photos: 6, video: 6, floorplan: 6,
  description: 7,
};

const optInt = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : typeof v === "string" ? Number(v.replace(/,/g, "")) : v),
    z.number({ error: `${label} must be a number` }).int(`${label} must be a whole number`).min(min, `${label} must be at least ${min}`).max(max, `${label} looks too large`).nullable()
  );

const optStr = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v ?? null), z.string().max(max).nullable());

const media = z.object({ url: z.string().regex(/^\/api\/(media\/[a-zA-Z0-9_-]+\.[a-z0-9]+|art\/[a-z]+\/\d+)$/, "Upload files through the form"), sha256: z.string().optional(), name: z.string().optional() });

export const listingSchema = z
  .object({
    transaction_type: z.enum(["sell", "rent", "pg"], { error: "Choose sell, rent or PG" }),
    category: z.enum(["residential", "commercial"]),
    property_type: z.string(),
    city_id: z.coerce.number({ error: "Choose a city" }).int().positive("Choose a city"),
    locality_id: z.coerce.number({ error: "Choose a locality" }).int().positive("Choose a locality"),
    address: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(3, "Enter the society / building name or street").max(200)),
    lat: z.number().min(6).max(37.5).nullable(),
    lng: z.number().min(68).max(98).nullable(),
    bhk: optInt(1, 10, "BHK"),
    bathrooms: optInt(0, 10, "Bathrooms"),
    balconies: optInt(0, 10, "Balconies"),
    carpet_area: optInt(50, 500000, "Carpet area"),
    builtup_area: optInt(50, 500000, "Built-up area"),
    super_area: optInt(50, 500000, "Super built-up area"),
    plot_area: optInt(100, 5000000, "Plot area"),
    floor: optInt(-2, 120, "Floor"),
    total_floors: optInt(1, 120, "Total floors"),
    facing: z.preprocess((v) => (v === "" ? null : v), z.enum(FACING).nullable()),
    age_years: optInt(0, 100, "Age"),
    furnishing: z.preprocess((v) => (v === "" ? null : v), z.enum(FURNISHING.map((f) => f.value) as [string, ...string[]]).nullable()),
    construction_status: z.preprocess((v) => (v === "" ? null : v), z.enum(["ready", "under_construction"]).nullable()),
    possession_date: optStr(10),
    rera_id: optStr(60),
    tenant_types: z.array(z.enum(TENANT_TYPES.map((t) => t.value) as [string, ...string[]])).default([]),
    available_from: optStr(10),
    deposit: optInt(0, 100000000, "Deposit"),
    pg_sharing: z.array(z.enum(["single", "double", "triple"])).default([]),
    pg_meals: z.boolean().default(false),
    price: z.preprocess(
      (v) => (v === "" || v == null ? undefined : typeof v === "string" ? Number(v.replace(/,/g, "")) : v),
      z.number({ error: "Enter the price" }).int("Enter the price in whole rupees").positive("Enter the price")
    ),
    price_negotiable: z.boolean().default(false),
    maintenance: optInt(0, 1000000, "Maintenance"),
    amenities: z.array(z.enum(AMENITIES.map((a) => a.value) as [string, ...string[]])).default([]),
    photos: z.array(media).max(MAX_PHOTOS, `Up to ${MAX_PHOTOS} photos`).default([]),
    video: media.nullable().default(null),
    floorplan: media.nullable().default(null),
    description: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(30, "Write at least 30 characters about the property").max(4000, "Keep it under 4,000 characters")),
  })
  .superRefine((d, ctx) => {
    const add = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const allowed = TYPES_FOR[d.transaction_type]?.[d.category] ?? [];
    if (!allowed.includes(d.property_type)) add("property_type", "Choose a property type that fits this listing");
    const t = d.property_type;
    if (isHome(t)) {
      if (d.bhk == null) add("bhk", "Select the number of bedrooms");
      if (d.bathrooms == null) add("bathrooms", "Select the number of bathrooms");
    }
    if (t !== "pg") {
      if (t === "plot") {
        if (d.plot_area == null) add("plot_area", "Enter the plot area");
      } else if (d.carpet_area == null && d.builtup_area == null && d.super_area == null) {
        add("carpet_area", "Enter at least one area (carpet, built-up or super built-up)");
      }
    }
    if (d.carpet_area && d.super_area && d.carpet_area > d.super_area) add("carpet_area", "Carpet area can't be more than super built-up area");
    if (d.floor != null && d.total_floors != null && d.floor > d.total_floors) add("floor", "Floor can't be above the total floors");
    if (t === "apartment" && d.floor == null) add("floor", "Enter the floor number");
    if (d.transaction_type === "sell" && t !== "plot") {
      if (!d.construction_status) add("construction_status", "Is it ready to move or under construction?");
      if (d.construction_status === "under_construction") {
        if (!d.possession_date || !/^\d{4}-\d{2}(-\d{2})?$/.test(d.possession_date)) add("possession_date", "Enter the expected possession month");
        if (d.category === "residential" && !d.rera_id) add("rera_id", "RERA registration is mandatory for under-construction projects");
      }
    }
    if (d.rera_id && !/^[A-Za-z0-9/\-_. ]{6,60}$/.test(d.rera_id)) add("rera_id", "RERA ID has unexpected characters");
    if (d.transaction_type === "rent") {
      if (isHome(t) && d.tenant_types.length === 0) add("tenant_types", "Choose who can rent");
      if (!d.available_from) add("available_from", "When can the tenant move in?");
      if (d.deposit != null && d.deposit > d.price * 24) add("deposit", "Deposit looks too high (more than 24 months' rent)");
    }
    if (d.transaction_type === "pg") {
      if (d.pg_sharing.length === 0) add("pg_sharing", "Choose at least one room type");
      if (!d.tenant_types.some((x) => x === "girls" || x === "boys")) add("tenant_types", "Is the PG for girls, boys or both?");
      if (!d.available_from) add("available_from", "When can a resident move in?");
    }
    if (d.available_from && !/^\d{4}-\d{2}-\d{2}$/.test(d.available_from)) add("available_from", "Use a valid date");
    if (d.transaction_type === "sell") {
      if (d.price < 100000) add("price", "Sale price must be at least ₹1 lakh");
      if (d.price > 1e11) add("price", "Sale price looks too high");
    } else {
      if (d.price < 1000) add("price", "Rent must be at least ₹1,000 a month");
      if (d.price > 5000000) add("price", "Rent looks too high");
    }
    if (d.lat == null || d.lng == null) add("lat", "Set the location pin on the map");
  });

export type ListingInput = z.infer<typeof listingSchema>;

/** Flattens zod issues into { field: message } (first message per field). */
export function issuesToErrors(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Validate only the fields that belong to a given step (used client side before "Next"). */
export function validateStep(step: number, d: ListingDraft): Record<string, string> {
  // Later steps get valid placeholders so the cross-field rules (which only run once the base shape parses) apply now.
  const probe: ListingDraft = { ...d };
  if (step < 4) { probe.price = "1000000"; probe.maintenance = ""; }
  if (step < 7) probe.description = "Placeholder description used for step validation only.";
  const r = listingSchema.safeParse(probe);
  if (r.success) return {};
  const all = issuesToErrors(r.error.issues);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(all)) if ((FIELD_STEP[k] ?? 7) === step) out[k] = v;
  if (step === 6 && d.photos.length > MAX_PHOTOS) out.photos = `Up to ${MAX_PHOTOS} photos`;
  return out;
}

/** Strips phone numbers and emails from free text (PRD P3). */
export const PHONE_RE = /(?:\+?91[\s-]*)?(?<!\d)[6-9](?:[\s-]*\d){9}(?!\d)/g;
export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
export function stripContactInfo(text: string): { text: string; found: boolean } {
  let found = false;
  const out = text
    .replace(PHONE_RE, () => { found = true; return "[number removed]"; })
    .replace(EMAIL_RE, () => { found = true; return "[email removed]"; });
  return { text: out, found };
}
