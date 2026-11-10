import { db } from "@/lib/db";

export type Suggestion = { kind: "city" | "locality" | "project" | "builder" | "landmark"; label: string; sub: string; href?: string; params?: Record<string, string> };

/** Type-ahead suggestions for city, locality, project, builder and landmark (PRD S1). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").replace(/\u0000/g, "").trim();
  const city = (url.searchParams.get("city") || "").replace(/\u0000/g, "");
  if (q.length < 2) return Response.json({ items: [] });
  const like = `%${q}%`, prefix = `${q}%`;
  const items: Suggestion[] = [];

  const cities = await db.prepare("SELECT slug, name, state FROM cities WHERE name LIKE ? LIMIT 3").all(like) as Array<{ slug: string; name: string; state: string }>;
  cities.forEach((c) => items.push({ kind: "city", label: c.name, sub: c.state, params: { city: c.slug } }));

  const locs = await db.prepare(
      `SELECT l.id, l.name, c.name city, c.slug city_slug FROM localities l JOIN cities c ON c.id = l.city_id
     WHERE l.name LIKE ? ORDER BY (c.slug = ?) DESC, (l.name LIKE ?) DESC, l.trending DESC LIMIT 6`
    ).all(like, city, prefix) as Array<{ id: number; name: string; city: string; city_slug: string }>;
  locs.forEach((l) => items.push({ kind: "locality", label: l.name, sub: l.city, params: { city: l.city_slug, loc: String(l.id) } }));

  const projects = await db.prepare(
      `SELECT p.slug, p.name, lo.name loc, c.name city FROM projects p JOIN cities c ON c.id = p.city_id LEFT JOIN localities lo ON lo.id = p.locality_id
     WHERE p.name LIKE ? AND p.approved = 1 ORDER BY (c.slug = ?) DESC LIMIT 4`
    ).all(like, city) as Array<{ slug: string; name: string; loc: string; city: string }>;
  projects.forEach((p) => items.push({ kind: "project", label: p.name, sub: `${p.loc}, ${p.city}`, href: `/projects/${p.slug}` }));

  const builders = await db.prepare(
      `SELECT u.id, pr.company_name FROM users u JOIN profiles pr ON pr.user_id = u.id WHERE u.role = 'builder' AND pr.company_name LIKE ? LIMIT 3`
    ).all(like) as Array<{ id: number; company_name: string }>;
  builders.forEach((b) => items.push({ kind: "builder", label: b.company_name, sub: "Builder", href: `/builders/${b.id}` }));

  const lm = await db.prepare(
      `SELECT l.id, l.landmarks, c.slug city_slug, c.name city FROM localities l JOIN cities c ON c.id = l.city_id WHERE l.landmarks LIKE ? LIMIT 20`
    ).all(like) as Array<{ id: number; landmarks: string; city_slug: string; city: string }>;
  const seen = new Set<string>();
  for (const row of lm) {
    for (const m of JSON.parse(row.landmarks || "[]") as Array<{ name: string; kind: string; lat: number; lng: number }>) {
      if (!m.name.toLowerCase().includes(q.toLowerCase()) || seen.has(m.name)) continue;
      seen.add(m.name);
      items.push({ kind: "landmark", label: m.name, sub: `Near · ${row.city}`, params: { city: row.city_slug, near: `${m.lat},${m.lng},3`, near_label: m.name } });
      if (seen.size >= 3) break;
    }
    if (seen.size >= 3) break;
  }
  return Response.json({ items: items.slice(0, 14) });
}
