// Shared (client + server) shape for builder project data entry (PRD B2, B6).
import { z } from "zod";
import { AMENITIES, STATES } from "@/lib/constants";
import type { MediaRef } from "./listing-schema";

export type TowerDraft = { name: string; floors: string; units: string; completion_pct: string };
export type UnitDraft = { label: string; bhk: string; carpet_area: string; super_area: string; price: string; available_units: string; floor_plan: MediaRef | null };
export type ProjectDraft = {
  name: string; city_id: string; locality_id: string; address: string; lat: number | null; lng: number | null;
  rera_id: string; rera_state: string; status: string; launch_date: string; possession_date: string;
  total_units: string; land_area_acres: string; description: string; amenities: string[];
  location_advantages: Array<{ name: string; distance: string }>;
  towers: TowerDraft[]; unit_types: UnitDraft[];
  photos: MediaRef[]; brochure: MediaRef | null; master_plan: MediaRef | null;
};

export const EMPTY_PROJECT: ProjectDraft = {
  name: "", city_id: "", locality_id: "", address: "", lat: null, lng: null, rera_id: "", rera_state: "", status: "under_construction",
  launch_date: "", possession_date: "", total_units: "", land_area_acres: "", description: "", amenities: [], location_advantages: [{ name: "", distance: "" }],
  towers: [{ name: "Tower A", floors: "", units: "", completion_pct: "0" }],
  unit_types: [{ label: "2 BHK", bhk: "2", carpet_area: "", super_area: "", price: "", available_units: "", floor_plan: null }],
  photos: [], brochure: null, master_plan: null,
};

const pre = (v: unknown) => (v === "" || v == null ? null : Number(String(v).replace(/,/g, "")));
const num = (label: string, min: number, max: number) =>
  z.preprocess(pre, z.number({ error: `${label} must be a number` }).min(min, `${label} must be at least ${min}`).max(max, `${label} looks too large`).nullable());
const reqNum = (label: string, min: number, max: number) =>
  z.preprocess(pre, z.number({ error: `Enter ${label.toLowerCase()}` }).min(min, `${label} must be at least ${min}`).max(max, `${label} looks too large`));
const media = z.object({ url: z.string().regex(/^\/api\/(media\/[a-zA-Z0-9_-]+\.[a-z0-9]+|art\/[a-z]+\/\d+)$/), sha256: z.string().optional(), name: z.string().optional() });
const date = z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Use a valid date").nullable());

export const projectSchema = z
  .object({
    name: z.string().trim().min(3, "Enter the project name").max(80),
    city_id: z.coerce.number({ error: "Choose a city" }).int().positive("Choose a city"),
    locality_id: z.coerce.number({ error: "Choose a locality" }).int().positive("Choose a locality"),
    address: z.string().trim().min(5, "Enter the site address").max(250),
    lat: z.number().min(6).max(37.5).nullable(),
    lng: z.number().min(68).max(98).nullable(),
    rera_id: z.string().trim().max(60),
    rera_state: z.string(),
    status: z.enum(["new_launch", "under_construction", "ready"], { error: "Choose the project status" }),
    launch_date: date,
    possession_date: date,
    total_units: num("Total units", 1, 100000),
    land_area_acres: num("Land area", 0.05, 10000),
    description: z.string().trim().min(50, "Write at least 50 characters").max(5000),
    amenities: z.array(z.enum(AMENITIES.map((a) => a.value) as [string, ...string[]])),
    location_advantages: z.array(z.object({ name: z.string().trim().max(80), distance: z.string().trim().max(20) })).max(15),
    towers: z.array(z.object({
      name: z.string().trim().min(1, "Name each tower").max(40),
      floors: num("Floors", 1, 150),
      units: num("Units", 1, 5000),
      completion_pct: num("Completion", 0, 100),
    })).min(1, "Add at least one tower or block").max(40),
    unit_types: z.array(z.object({
      label: z.string().trim().min(1, "Label each unit type").max(40),
      bhk: num("BHK", 0, 10),
      carpet_area: reqNum("Carpet area", 100, 50000),
      super_area: num("Super area", 100, 60000),
      price: reqNum("Price", 100000, 1e11),
      available_units: num("Available units", 0, 10000),
      floor_plan: media.nullable(),
    })).min(1, "Add at least one unit type").max(20),
    photos: z.array(media).max(30),
    brochure: media.nullable(),
    master_plan: media.nullable(),
  })
  .superRefine((d, ctx) => {
    const add = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    if (d.status !== "ready") {
      if (!d.rera_id) add(["rera_id"], "RERA registration is mandatory for projects that aren't complete");
      if (!d.possession_date) add(["possession_date"], "Enter the RERA possession date");
    }
    if (d.rera_id && !/^[A-Za-z0-9/\-_. ]{6,60}$/.test(d.rera_id)) add(["rera_id"], "RERA ID has unexpected characters");
    if (d.rera_id && !(STATES as readonly string[]).includes(d.rera_state)) add(["rera_state"], "Choose the state where the project is RERA registered");
    if (d.launch_date && d.possession_date && d.possession_date < d.launch_date) add(["possession_date"], "Possession can't be before launch");
    d.unit_types.forEach((u, i) => {
      if (u.super_area != null && u.super_area < u.carpet_area) add(["unit_types", i, "super_area"], "Super area must be at least the carpet area");
    });
    if (d.lat == null || d.lng == null) add(["lat"], "Set the location pin");
  });

export type ProjectInput = z.infer<typeof projectSchema>;

/** Flattens issues to dotted paths, e.g. "unit_types.0.price". */
export function projectErrors(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = i.path.map(String).join(".") || "form";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
