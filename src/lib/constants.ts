// Shared enums and option lists. Safe to import from client and server.

export const TRANSACTIONS = [
  { value: "sell", label: "Buy" },
  { value: "rent", label: "Rent" },
  { value: "pg", label: "PG / Co-living" },
] as const;

export const SEARCH_TABS = [
  { key: "buy", label: "Buy", query: { tx: "sell", cat: "residential" } },
  { key: "rent", label: "Rent", query: { tx: "rent", cat: "residential" } },
  { key: "commercial", label: "Commercial", query: { cat: "commercial" } },
  { key: "pg", label: "PG / Co-living", query: { tx: "pg" } },
  { key: "plots", label: "Plots", query: { tx: "sell", type: "plot" } },
  { key: "projects", label: "New Projects", query: {} },
] as const;

export const PROPERTY_TYPES = [
  { value: "apartment", label: "Apartment", category: "residential" },
  { value: "house", label: "Independent House", category: "residential" },
  { value: "villa", label: "Villa", category: "residential" },
  { value: "plot", label: "Plot / Land", category: "residential" },
  { value: "office", label: "Office Space", category: "commercial" },
  { value: "shop", label: "Shop / Showroom", category: "commercial" },
  { value: "warehouse", label: "Warehouse", category: "commercial" },
  { value: "pg", label: "PG / Hostel", category: "residential" },
] as const;

export const PROPERTY_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PROPERTY_TYPES.map((p) => [p.value, p.label])
);

export const FURNISHING = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi", label: "Semi-furnished" },
  { value: "furnished", label: "Fully furnished" },
] as const;
export const FURNISHING_LABEL: Record<string, string> = Object.fromEntries(FURNISHING.map((f) => [f.value, f.label]));

export const TENANT_TYPES = [
  { value: "family", label: "Family" },
  { value: "bachelor", label: "Bachelors" },
  { value: "company", label: "Company lease" },
  { value: "girls", label: "Girls (PG)" },
  { value: "boys", label: "Boys (PG)" },
] as const;

export const POSTED_BY = [
  { value: "owner", label: "Owner" },
  { value: "agent", label: "Agent" },
  { value: "builder", label: "Builder" },
] as const;

export const FACING = ["North", "South", "East", "West", "North-East", "North-West", "South-East", "South-West"] as const;

export const AMENITIES = [
  { value: "parking", label: "Parking", filter: true },
  { value: "lift", label: "Lift", filter: true },
  { value: "gym", label: "Gym", filter: true },
  { value: "pool", label: "Swimming pool", filter: true },
  { value: "power_backup", label: "Power backup", filter: true },
  { value: "security", label: "24x7 security", filter: true },
  { value: "clubhouse", label: "Clubhouse", filter: false },
  { value: "park", label: "Park / garden", filter: false },
  { value: "play_area", label: "Kids play area", filter: false },
  { value: "cctv", label: "CCTV", filter: false },
  { value: "gas_pipeline", label: "Piped gas", filter: false },
  { value: "rainwater", label: "Rainwater harvesting", filter: false },
  { value: "intercom", label: "Intercom", filter: false },
  { value: "wifi", label: "Wi-Fi", filter: false },
  { value: "ac", label: "Air conditioning", filter: false },
  { value: "meals", label: "Meals included", filter: false },
  { value: "housekeeping", label: "Housekeeping", filter: false },
] as const;
export const AMENITY_LABEL: Record<string, string> = Object.fromEntries(AMENITIES.map((a) => [a.value, a.label]));

export const SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest first" },
  { value: "area_desc", label: "Largest area" },
] as const;

export const LISTING_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending: "Under review",
  live: "Live",
  rejected: "Rejected",
  expired: "Expired",
  paused: "Paused",
  sold: "Sold",
  rented: "Rented",
  removed: "Taken down",
};

export const REPORT_REASONS = [
  { value: "fake", label: "Fake or non-existent property" },
  { value: "wrong_info", label: "Wrong price or details" },
  { value: "sold_out", label: "Already sold / rented" },
  { value: "broker_as_owner", label: "Broker posing as owner" },
  { value: "fraud", label: "Asked for money upfront / fraud" },
  { value: "duplicate", label: "Duplicate listing" },
  { value: "other", label: "Something else" },
] as const;

export const ADMIN_ROLES = ["super", "moderator", "support", "sales", "content"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ARTICLE_CATEGORIES = [
  { value: "news", label: "News" },
  { value: "buying-guide", label: "Buying guide" },
  { value: "renting-guide", label: "Renting guide" },
  { value: "legal", label: "Legal" },
  { value: "tax", label: "Tax" },
  { value: "city-guide", label: "City guide" },
] as const;

export const LISTING_VALIDITY_DAYS = 60;
export const MAX_PHOTOS = 20;
export const GST_RATE = 0.18;
export const HOME_STATE = "Karnataka"; // 10cent's registered GST state, used for CGST/SGST vs IGST split.
export const PHONE_REVEAL_DAILY_LIMIT = 25;

export const STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab", "Rajasthan",
  "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

/** State RERA portals (PRD B3). */
export const RERA_PORTALS: Record<string, string> = {
  Karnataka: "https://rera.karnataka.gov.in",
  Maharashtra: "https://maharera.maharashtra.gov.in",
  Telangana: "https://rerait.telangana.gov.in",
  Haryana: "https://haryanarera.gov.in",
  "Tamil Nadu": "https://rera.tn.gov.in",
  Delhi: "https://rera.delhi.gov.in",
  "Uttar Pradesh": "https://www.up-rera.in",
  Gujarat: "https://gujrera.gujarat.gov.in",
  Kerala: "https://rera.kerala.gov.in",
  "West Bengal": "https://rera.wb.gov.in",
};
