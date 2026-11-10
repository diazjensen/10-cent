// Indian number formatting helpers. Safe on client and server.

/** ₹ 1.25 Cr, ₹ 85 L, ₹ 42,000 */
export function formatPrice(n: number | null | undefined, opts: { short?: boolean } = {}): string {
  if (n == null || Number.isNaN(n)) return "Price on request";
  if (n >= 1e7) return `₹${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5)} ${opts.short ? "L" : "Lac"}`;
  return `₹${formatINR(n)}`;
}

export function formatRent(n: number | null | undefined): string {
  if (n == null) return "—";
  return `₹${formatINR(n)}/mo`;
}

function trim(x: number) {
  return x >= 100 ? x.toFixed(0) : x.toFixed(2).replace(/\.?0+$/, "");
}

/** 12,34,567 (Indian digit grouping) */
export function formatINR(n: number | null | undefined, fractionDigits = 0): string {
  return (n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits });
}

export function formatPaise(p: number): string {
  return `₹${formatINR(p / 100, 2)}`;
}

export function formatArea(sqft: number | null | undefined): string {
  if (!sqft) return "—";
  return `${formatINR(sqft)} sq ft`;
}

export function pricePerSqft(price: number, area: number | null | undefined): number | null {
  if (!area) return null;
  return Math.round(price / area);
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  if (s < 86400 * 365) return `${Math.floor(s / 86400 / 30)} mo ago`;
  return `${Math.floor(s / 86400 / 365)} yr ago`;
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", opts);
}

export function maskPhone(p: string | null | undefined) {
  if (!p) return "";
  const d = p.replace(/\D/g, "").slice(-10);
  return `+91 ${d.slice(0, 2)}XXX XX${d.slice(-3)}`;
}

export function formatPhone(p: string | null | undefined) {
  if (!p) return "";
  const d = p.replace(/\D/g, "").slice(-10);
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Parse "50L", "1.2cr", "45000" style budget input into rupees. */
export function parseBudget(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = String(s).trim().toLowerCase().replace(/,/g, "").match(/^([\d.]+)\s*(cr|crore|l|lac|lakh|k)?$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const unit = m[2];
  if (unit === "cr" || unit === "crore") return Math.round(v * 1e7);
  if (unit === "l" || unit === "lac" || unit === "lakh") return Math.round(v * 1e5);
  if (unit === "k") return Math.round(v * 1e3);
  return Math.round(v);
}

export function listingHeadline(l: { bhk?: number | null; property_type: string; transaction_type: string; locality_name?: string | null; city_name?: string | null }) {
  const typeLabel: Record<string, string> = {
    apartment: "Apartment", house: "Independent House", villa: "Villa", plot: "Plot", office: "Office Space",
    shop: "Shop", warehouse: "Warehouse", pg: "PG",
  };
  const bhk = l.bhk && !["plot", "office", "shop", "warehouse", "pg"].includes(l.property_type) ? `${l.bhk} BHK ` : "";
  const tx = l.transaction_type === "sell" ? "for Sale" : l.transaction_type === "rent" ? "for Rent" : "";
  const where = l.locality_name ? ` in ${l.locality_name}` : l.city_name ? ` in ${l.city_name}` : "";
  return `${bhk}${typeLabel[l.property_type] ?? l.property_type} ${tx}${where}`.replace(/\s+/g, " ").trim();
}
