// Admin nav key -> permission area (see ADMIN_PERMISSIONS in src/lib/auth.ts). Client-safe.
// Areas not listed in ADMIN_PERMISSIONS (e.g. "jobs") fall back to super-only.
export const NAV_AREAS: Record<string, string> = {
  dashboard: "dashboard",
  moderation: "moderation",
  listings: "moderation",
  verification: "moderation",
  users: "users",
  reports: "reports",
  spam: "reports",
  billing: "billing",
  projects: "projects",
  banners: "banners",
  cms: "cms",
  locations: "cms",
  analytics: "analytics",
  outbox: "outbox",
  audit: "audit",
  staff: "staff",
  jobs: "jobs",
};

export const SLA_HOURS = 24;

export const REJECT_REASONS = [
  "Photos are not of the actual property or are taken from another listing",
  "Duplicate of an existing listing",
  "Price looks incorrect or misleading",
  "Phone number or email written in the description",
  "Incomplete or wrong address / locality",
  "Broker posting as owner",
  "Property type or BHK does not match the photos",
  "Violates the posting policy",
] as const;

export const TAKEDOWN_REASONS = [
  "Confirmed fraud report",
  "Property already sold or rented",
  "Duplicate listing",
  "Misleading price or details",
  "Poster requested removal",
  "Violates the posting policy",
] as const;
