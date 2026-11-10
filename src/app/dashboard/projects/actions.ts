"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { audit, db } from "@/lib/db";
import { slugify } from "@/lib/format";
import { notify } from "@/lib/notify";
import { activePlan, ownsProject } from "@/lib/supply/account";
import { projectErrors, projectSchema, type ProjectDraft } from "@/lib/supply/project-schema";

export type ProjectSaveResult = { ok: true; id: number; created: boolean } | { ok: false; errors: Record<string, string> };

function uniqueSlug(base: string, selfId: number | null) {
  let slug = base;
  for (let i = 2; db.prepare("SELECT 1 FROM projects WHERE slug = ? AND id <> ?").get(slug, selfId ?? -1); i++) slug = `${base}-${i}`;
  return slug;
}

/** Create or update a builder project (PRD B2). New projects wait for admin approval. */
export async function saveProjectAction(draft: ProjectDraft, id: number | null): Promise<ProjectSaveResult> {
  const user = await getUser();
  if (!user) return { ok: false, errors: { form: "Log in again to continue." } };
  if (user.role !== "builder" && user.role !== "admin") return { ok: false, errors: { form: "Only builder accounts can add projects." } };
  if (id && !ownsProject(user, id)) return { ok: false, errors: { form: "You can't edit this project." } };

  // Drop empty rows the form keeps for convenience.
  const cleaned = { ...draft, location_advantages: draft.location_advantages.filter((a) => a.name.trim()) };
  const r = projectSchema.safeParse(cleaned);
  if (!r.success) return { ok: false, errors: projectErrors(r.error.issues) };
  const d = r.data;
  const city = db.prepare("SELECT slug FROM cities WHERE id = ?").get(d.city_id) as { slug: string } | undefined;
  const loc = db.prepare("SELECT id, lat, lng FROM localities WHERE id = ? AND city_id = ?").get(d.locality_id, d.city_id) as { id: number; lat: number; lng: number } | undefined;
  if (!city || !loc) return { ok: false, errors: { locality_id: "Choose a locality in this city" } };

  const prices = d.unit_types.map((u) => u.price);
  const towerUnits = d.towers.reduce((a, t) => a + (t.units ?? 0), 0);
  const row = {
    name: d.name, city_id: d.city_id, locality_id: d.locality_id, address: d.address, lat: d.lat ?? loc.lat, lng: d.lng ?? loc.lng,
    rera_id: d.rera_id || null, rera_state: d.rera_id ? d.rera_state : null, status: d.status, launch_date: d.launch_date, possession_date: d.possession_date,
    total_units: d.total_units ?? (towerUnits || null), land_area_acres: d.land_area_acres, description: d.description,
    price_min: Math.min(...prices), price_max: Math.max(...prices),
    amenities: JSON.stringify(d.amenities), location_advantages: JSON.stringify(d.location_advantages),
    brochure_url: d.brochure?.url ?? null, master_plan_url: d.master_plan?.url ?? null,
  };

  let pid = id ?? 0;
  db.transaction(() => {
    if (id) {
      const cols = Object.keys(row);
      db.prepare(`UPDATE projects SET ${cols.map((c) => `${c} = @${c}`).join(", ")} WHERE id = @id`).run({ ...row, id });
      db.prepare("DELETE FROM project_towers WHERE project_id = ?").run(id);
      db.prepare("DELETE FROM project_unit_types WHERE project_id = ?").run(id);
      db.prepare("DELETE FROM project_media WHERE project_id = ?").run(id);
    } else {
      const full = { ...row, builder_id: user.id, slug: uniqueSlug(slugify(`${d.name}-${city.slug}`), null), approved: 0, featured: 0 };
      const cols = Object.keys(full);
      pid = Number(db.prepare(`INSERT INTO projects (${cols.join(", ")}) VALUES (${cols.map((c) => `@${c}`).join(", ")})`).run(full).lastInsertRowid);
    }
    const insT = db.prepare("INSERT INTO project_towers (project_id, name, floors, units, completion_pct) VALUES (?,?,?,?,?)");
    d.towers.forEach((t) => insT.run(pid, t.name, t.floors, t.units, t.completion_pct ?? 0));
    const insU = db.prepare("INSERT INTO project_unit_types (project_id, label, bhk, carpet_area, super_area, price, floor_plan_url, available_units) VALUES (?,?,?,?,?,?,?,?)");
    d.unit_types.forEach((u) => insU.run(pid, u.label, u.bhk, u.carpet_area, u.super_area, u.price, u.floor_plan?.url ?? null, u.available_units));
    const insM = db.prepare("INSERT INTO project_media (project_id, kind, url, sort) VALUES (?, 'photo', ?, ?)");
    d.photos.forEach((p, i) => insM.run(pid, p.url, i));
  })();
  audit(user.id, id ? "project.update" : "project.create", "project", pid, { name: d.name });
  if (!id) notify(user.id, { kind: "moderation", title: "Project submitted for approval", body: `${d.name} will be reviewed by our team, usually within 2 working days. We verify the RERA registration before it goes live.`, link: `/dashboard/projects/${pid}` }, ["email"]);
  revalidatePath("/dashboard/projects");
  revalidatePath("/projects");
  return { ok: true, id: pid, created: !id };
}

/** Featured project slot (PRD B6): requires an active builder plan and an approved project. */
export async function toggleFeaturedAction(projectId: number): Promise<{ ok: boolean; message: string }> {
  const user = await getUser();
  if (!user || !ownsProject(user, projectId)) return { ok: false, message: "Not allowed." };
  const p = db.prepare("SELECT id, builder_id, approved, featured, name FROM projects WHERE id = ?").get(projectId) as { id: number; builder_id: number; approved: number; featured: number; name: string };
  if (p.featured) {
    db.prepare("UPDATE projects SET featured = 0 WHERE id = ?").run(projectId);
    revalidatePath("/dashboard/projects");
    return { ok: true, message: "Removed from the featured slot." };
  }
  const plan = activePlan(p.builder_id);
  if (!plan || plan.audience !== "builder") return { ok: false, message: "Featuring a project needs an active builder plan." };
  if (!p.approved) return { ok: false, message: "The project must be approved before it can be featured." };
  db.prepare("UPDATE projects SET featured = 1 WHERE id = ?").run(projectId);
  audit(user.id, "project.feature", "project", projectId, { plan: plan.code });
  revalidatePath("/dashboard/projects");
  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true, message: `${p.name} is now featured on the city home page and project search.` };
}
