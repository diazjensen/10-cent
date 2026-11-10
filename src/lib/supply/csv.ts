// Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). Safe on client and server.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export const BULK_COLUMNS = [
  "transaction_type", "category", "property_type", "city", "locality", "address", "bhk", "bathrooms", "balconies",
  "carpet_area", "builtup_area", "super_area", "plot_area", "floor", "total_floors", "facing", "age_years", "furnishing",
  "construction_status", "possession_date", "rera_id", "tenant_types", "available_from", "deposit", "pg_sharing", "pg_meals",
  "price", "price_negotiable", "maintenance", "amenities", "description", "latitude", "longitude",
] as const;
