import "server-only";
import { db } from "@/lib/db";

export type ProjectFull = {
  id: number; builder_id: number; name: string; slug: string; city_id: number; locality_id: number | null; address: string | null;
  lat: number | null; lng: number | null; rera_id: string | null; rera_state: string | null; status: string;
  launch_date: string | null; possession_date: string | null; total_units: number | null; land_area_acres: number | null;
  description: string | null; price_min: number | null; price_max: number | null; amenities: string | null; location_advantages: string | null;
  featured: number; sponsored: number; approved: number; brochure_url: string | null; master_plan_url: string | null; created_at: string;
  city_name: string; city_slug: string; city_state: string; loc_name: string | null; loc_slug: string | null;
  builder_name: string | null; builder_company: string | null; builder_about: string | null; builder_est: number | null;
  builder_exp: number | null; builder_logo: string | null; builder_rating: number | null; builder_phone: string | null;
};

export function getProjectBySlug(slug: string) {
  return db.prepare(`
    SELECT p.*, c.name city_name, c.slug city_slug, c.state city_state, lo.name loc_name, lo.slug loc_slug,
      u.name builder_name, u.phone builder_phone, pr.company_name builder_company, pr.about builder_about, pr.established_year builder_est,
      pr.experience_years builder_exp, pr.logo_url builder_logo, pr.rating builder_rating
    FROM projects p JOIN cities c ON c.id = p.city_id LEFT JOIN localities lo ON lo.id = p.locality_id
    JOIN users u ON u.id = p.builder_id LEFT JOIN profiles pr ON pr.user_id = p.builder_id
    WHERE p.slug = ?`).get(slug) as ProjectFull | undefined;
}

export function projectParts(id: number) {
  return {
    units: db.prepare("SELECT * FROM project_unit_types WHERE project_id = ? ORDER BY bhk, price").all(id) as Array<{ id: number; label: string; bhk: number | null; carpet_area: number | null; super_area: number | null; price: number | null; floor_plan_url: string | null; available_units: number | null }>,
    towers: db.prepare("SELECT * FROM project_towers WHERE project_id = ? ORDER BY name").all(id) as Array<{ id: number; name: string; floors: number | null; units: number | null; completion_pct: number | null }>,
    media: db.prepare("SELECT * FROM project_media WHERE project_id = ? ORDER BY sort, id").all(id) as Array<{ id: number; kind: string; url: string }>,
  };
}

export function parseJsonArray<T>(s: string | null): T[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function yearsInBusiness(est: number | null, exp: number | null) {
  if (est) return new Date().getFullYear() - est;
  return exp ?? null;
}
