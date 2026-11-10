import "server-only";
import { db } from "@/lib/db";
import { getCities } from "@/lib/listings";
import type { ProjectDraft } from "./project-schema";

export async function projectToDraft(id: number): Promise<(ProjectDraft & { _builder_id: number; _approved: number; _featured: number; _slug: string; _name: string }) | null> {
  const p = await db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!p) return null;
  const s = (v: unknown) => (v == null ? "" : String(v));
  const towers = await db.prepare("SELECT * FROM project_towers WHERE project_id = ? ORDER BY id").all(id) as Array<Record<string, unknown>>;
  const units = await db.prepare("SELECT * FROM project_unit_types WHERE project_id = ? ORDER BY price").all(id) as Array<Record<string, unknown>>;
  const media = await db.prepare("SELECT url FROM project_media WHERE project_id = ? AND kind = 'photo' ORDER BY sort").all(id) as { url: string }[];
  const json = <T,>(v: unknown, d: T): T => { try { return v ? (JSON.parse(String(v)) as T) : d; } catch { return d; } };
  const adv = json<Array<{ name: string; distance: string }>>(p.location_advantages, []);
  return {
    _builder_id: Number(p.builder_id), _approved: Number(p.approved), _featured: Number(p.featured), _slug: String(p.slug), _name: String(p.name),
    name: s(p.name), city_id: s(p.city_id), locality_id: s(p.locality_id), address: s(p.address), lat: (p.lat as number) ?? null, lng: (p.lng as number) ?? null,
    rera_id: s(p.rera_id), rera_state: s(p.rera_state), status: s(p.status), launch_date: s(p.launch_date).slice(0, 10), possession_date: s(p.possession_date).slice(0, 10),
    total_units: s(p.total_units), land_area_acres: s(p.land_area_acres), description: s(p.description), amenities: json<string[]>(p.amenities, []),
    location_advantages: adv.length ? adv : [{ name: "", distance: "" }],
    towers: towers.map((t) => ({ name: s(t.name), floors: s(t.floors), units: s(t.units), completion_pct: s(t.completion_pct) })),
    unit_types: units.map((u) => ({ label: s(u.label), bhk: s(u.bhk), carpet_area: s(u.carpet_area), super_area: s(u.super_area), price: s(u.price), available_units: s(u.available_units), floor_plan: u.floor_plan_url ? { url: String(u.floor_plan_url) } : null })),
    photos: media.map((m) => ({ url: m.url })),
    brochure: p.brochure_url ? { url: String(p.brochure_url) } : null,
    master_plan: p.master_plan_url ? { url: String(p.master_plan_url) } : null,
  };
}

export async function formData() {
  const cities = (await getCities()).map((c) => ({ id: c.id, name: c.name, state: c.state, lat: c.lat, lng: c.lng }));
  const localities = await db.prepare("SELECT id, city_id, name, lat, lng FROM localities ORDER BY name").all() as Array<{ id: number; city_id: number; name: string; lat: number; lng: number }>;
  return { cities, localities };
}
