// Client-safe helpers for /search URL params: parsing, labels, headings and presets.
import { AMENITY_LABEL, FURNISHING_LABEL, POSTED_BY, PROPERTY_TYPE_LABEL, TENANT_TYPES } from "@/lib/constants";
import { formatPrice, formatINR } from "@/lib/format";

/** All params understood by searchListings (plus `view`). Order is used for stable query strings. */
export const SEARCH_KEYS = [
  "city", "q", "loc", "tx", "cat", "type", "bhk", "min", "max", "amin", "amax", "by", "furn", "tenant", "avail",
  "cs", "poss", "newlaunch", "rera", "verified", "photos", "am", "near", "bounds", "project", "poster", "sort", "page",
] as const;
export type SearchKey = (typeof SEARCH_KEYS)[number];
export type SearchParamsObj = Partial<Record<SearchKey | "view" | "nearname", string>>;

/** Normalises Next's searchParams record into flat strings. */
export function flattenParams(sp: Record<string, string | string[] | undefined>): SearchParamsObj {
  const out: SearchParamsObj = {};
  for (const k of [...SEARCH_KEYS, "view", "nearname"] as const) {
    const v = sp[k];
    const s = Array.isArray(v) ? v.join(",") : v;
    if (s != null && String(s).trim() !== "") out[k] = String(s).trim().slice(0, 300);
  }
  // The home hero's landmark suggestions use `near_label`.
  const nl = sp.near_label;
  if (!out.nearname && typeof nl === "string" && nl.trim()) out.nearname = nl.trim().slice(0, 120);
  if (!out.near) delete out.nearname;
  return out;
}

export function toQuery(p: SearchParamsObj, omit: string[] = []): string {
  const u = new URLSearchParams();
  for (const k of [...SEARCH_KEYS, "nearname", "view"] as const) {
    const v = p[k];
    if (v && !omit.includes(k)) u.set(k, v);
  }
  return u.toString();
}

/** Params that count as "a filter" for showing chips / recent searches (excludes sort, page, view). */
export const FILTER_KEYS: SearchKey[] = SEARCH_KEYS.filter((k) => !["sort", "page"].includes(k));

export const isRentLike = (tx?: string) => tx === "rent" || tx === "pg";

export const BUDGET_PRESETS_SALE: Array<{ label: string; min?: number; max?: number }> = [
  { label: "Under ₹40 L", max: 4000000 },
  { label: "₹40 L – 75 L", min: 4000000, max: 7500000 },
  { label: "₹75 L – 1.5 Cr", min: 7500000, max: 15000000 },
  { label: "₹1.5 – 3 Cr", min: 15000000, max: 30000000 },
  { label: "₹3 – 5 Cr", min: 30000000, max: 50000000 },
  { label: "Above ₹5 Cr", min: 50000000 },
];
export const BUDGET_PRESETS_RENT: Array<{ label: string; min?: number; max?: number }> = [
  { label: "Under ₹10,000", max: 10000 },
  { label: "₹10k – 20k", min: 10000, max: 20000 },
  { label: "₹20k – 35k", min: 20000, max: 35000 },
  { label: "₹35k – 60k", min: 35000, max: 60000 },
  { label: "₹60k – 1 L", min: 60000, max: 100000 },
  { label: "Above ₹1 L", min: 100000 },
];

export function moneyShort(n: number, rent: boolean) {
  if (rent) return n >= 100000 ? formatPrice(n, { short: true }) : `₹${formatINR(n)}`;
  return formatPrice(n, { short: true });
}

const TYPE_PLURAL: Record<string, string> = {
  apartment: "flats", house: "independent houses", villa: "villas", plot: "plots", office: "office spaces",
  shop: "shops", warehouse: "warehouses", pg: "PGs",
};

/**
 * Human heading for a search, e.g. "2 BHK flats for rent in Edappally, Kochi".
 * `names` resolves locality ids / city slug to display names.
 */
export function describeSearch(p: SearchParamsObj, names: { city?: string | null; localities?: string[] }) {
  const types = (p.type || "").split(",").filter(Boolean);
  const bhks = (p.bhk || "").split(",").filter(Boolean).map(Number).sort((a, b) => a - b);
  let what: string;
  if (types.length === 1) what = TYPE_PLURAL[types[0]] ?? "properties";
  else if (p.tx === "pg") what = "PGs and co-living";
  else if (p.cat === "commercial") what = "commercial properties";
  else what = "properties";
  if (bhks.length && !["plot", "office", "shop", "warehouse", "pg"].includes(types[0] ?? "")) {
    const b = bhks.map((n) => (n >= 5 ? "5+" : String(n)));
    what = `${b.length > 2 ? `${b.slice(0, -1).join(", ")} & ${b.at(-1)}` : b.join(" & ")} BHK ${what}`;
  }
  const tx = p.tx === "sell" ? " for sale" : p.tx === "rent" ? " for rent" : "";
  const places = [names.localities?.length ? names.localities.slice(0, 2).join(" & ") + (names.localities.length > 2 ? ` +${names.localities.length - 2}` : "") : null, names.city].filter(Boolean);
  let where = places.length ? ` in ${places.join(", ")}` : " across India";
  if (p.near && p.nearname) where = ` near ${p.nearname}${names.city ? `, ${names.city}` : ""}`;
  if (p.q && !names.localities?.length && !p.nearname) where = ` matching “${p.q}”${names.city ? ` in ${names.city}` : ""}`;
  const s = `${what}${tx}${where}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type Chip = { key: SearchKey; value?: string; label: string };

/** Applied-filter chips; removing a chip drops `value` from a list param, or the whole key. */
export function filterChips(p: SearchParamsObj, names: { city?: string | null; localities?: Record<string, string> }): Chip[] {
  const chips: Chip[] = [];
  const rent = isRentLike(p.tx);
  const listChips = (key: SearchKey, label: (v: string) => string) =>
    (p[key] || "").split(",").filter(Boolean).forEach((v) => chips.push({ key, value: v, label: label(v) }));
  if (p.city && names.city) chips.push({ key: "city", label: names.city });
  if (p.q) chips.push({ key: "q", label: `“${p.q}”` });
  listChips("loc", (v) => names.localities?.[v] ?? `Locality ${v}`);
  if (p.cat === "commercial") chips.push({ key: "cat", label: "Commercial" });
  listChips("type", (v) => PROPERTY_TYPE_LABEL[v] ?? v);
  listChips("bhk", (v) => (Number(v) >= 5 ? "5+ BHK" : `${v} BHK`));
  if (p.min || p.max) {
    const lo = p.min ? moneyShort(Number(p.min), rent) : null, hi = p.max ? moneyShort(Number(p.max), rent) : null;
    chips.push({ key: "min", label: lo && hi ? `${lo} – ${hi}` : lo ? `Above ${lo}` : `Under ${hi}` });
  }
  if (p.amin || p.amax) chips.push({ key: "amin", label: `${p.amin ? formatINR(Number(p.amin)) : "0"} – ${p.amax ? formatINR(Number(p.amax)) : "any"} sq ft` });
  listChips("by", (v) => `By ${POSTED_BY.find((x) => x.value === v)?.label.toLowerCase() ?? v}`);
  listChips("furn", (v) => FURNISHING_LABEL[v] ?? v);
  listChips("tenant", (v) => TENANT_TYPES.find((x) => x.value === v)?.label ?? v);
  if (p.avail) chips.push({ key: "avail", label: `Available by ${new Date(p.avail).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` });
  if (p.cs) chips.push({ key: "cs", label: p.cs === "ready" ? "Ready to move" : "Under construction" });
  if (p.poss) chips.push({ key: "poss", label: `Possession by ${p.poss}` });
  if (p.newlaunch === "1") chips.push({ key: "newlaunch", label: "New launch" });
  if (p.rera === "1") chips.push({ key: "rera", label: "RERA approved" });
  if (p.verified === "1") chips.push({ key: "verified", label: "Verified only" });
  if (p.photos === "1") chips.push({ key: "photos", label: "With photos" });
  listChips("am", (v) => AMENITY_LABEL[v] ?? v);
  if (p.near) chips.push({ key: "near", label: `Within ${p.near.split(",")[2]} km${p.nearname ? ` of ${p.nearname}` : ""}` });
  if (p.bounds) chips.push({ key: "bounds", label: "Map area" });
  return chips;
}

/** Returns params with a chip removed. */
export function removeChip(p: SearchParamsObj, c: Chip): SearchParamsObj {
  const next: SearchParamsObj = { ...p };
  delete next.page;
  if (c.key === "min") { delete next.min; delete next.max; return next; }
  if (c.key === "amin") { delete next.amin; delete next.amax; return next; }
  if (c.key === "near") { delete next.near; delete next.nearname; return next; }
  if (c.value != null) {
    const rest = (p[c.key] || "").split(",").filter((v) => v && v !== c.value);
    if (rest.length) next[c.key] = rest.join(",");
    else delete next[c.key];
    return next;
  }
  delete next[c.key];
  return next;
}

export const LANDMARK_KIND_LABEL: Record<string, string> = {
  metro: "Metro", school: "School", hospital: "Hospital", mall: "Mall", it_park: "IT park", railway: "Railway", airport: "Airport",
};

export type Landmark = { name: string; kind: string; lat: number; lng: number };

export function parseLandmarks(json: string | null | undefined): Landmark[] {
  try {
    const v = JSON.parse(json || "[]");
    if (!Array.isArray(v)) return [];
    const seen = new Set<string>();
    return v.filter((m) => {
      if (!m || typeof m.lat !== "number" || typeof m.lng !== "number") return false;
      const k = `${m.name}|${m.lat}|${m.lng}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  } catch {
    return [];
  }
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
