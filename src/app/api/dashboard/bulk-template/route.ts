import { getUser } from "@/lib/auth";
import { BULK_COLUMNS } from "@/lib/supply/csv";
import { toCsv } from "@/lib/supply/leads";

/** GET /api/dashboard/bulk-template → CSV template with two example rows (PRD P7). */
export async function GET() {
  const user = await getUser();
  if (!user) return new Response("Log in to download the template.", { status: 401 });
  const ex1: Record<string, string> = {
    transaction_type: "rent", category: "residential", property_type: "apartment", city: "Bengaluru", locality: "Whitefield", address: "Prestige Shantiniketan, Tower 4",
    bhk: "2", bathrooms: "2", balconies: "1", carpet_area: "1050", super_area: "1320", floor: "7", total_floors: "18", facing: "East", age_years: "6", furnishing: "semi",
    tenant_types: "family|company", available_from: "2026-12-01", deposit: "150000", price: "38000", price_negotiable: "yes", maintenance: "3500",
    amenities: "parking|lift|gym|power_backup|security", description: "Well-kept 2 BHK with east-facing balcony, covered parking and 24x7 power backup. Walking distance to ITPL.",
  };
  const ex2: Record<string, string> = {
    transaction_type: "sell", category: "residential", property_type: "apartment", city: "Bengaluru", locality: "Whitefield", address: "Brigade Lakefront, Block B",
    bhk: "3", bathrooms: "3", balconies: "2", carpet_area: "1480", super_area: "1890", floor: "11", total_floors: "22", facing: "North-East", furnishing: "unfurnished",
    construction_status: "under_construction", possession_date: "2027-09", rera_id: "PRM/KA/RERA/1251/446/PR/171015/000712", price: "16500000", price_negotiable: "no",
    amenities: "parking|lift|pool|clubhouse|security", description: "Corner 3 BHK in an under-construction tower with lake views, two covered parkings and a large clubhouse.",
  };
  const csv = toCsv([...BULK_COLUMNS], [ex1, ex2].map((r) => BULK_COLUMNS.map((c) => r[c] ?? "")));
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="10cent-bulk-listings-template.csv"', "Cache-Control": "no-store" },
  });
}
