"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseBudget } from "@/lib/format";
import { rateLimit } from "@/lib/rate-limit";

export type ReqState = { error?: string; fieldErrors?: Record<string, string> };

const TYPES = ["apartment", "house", "villa", "plot", "office", "shop", "warehouse", "pg"] as const;

const schema = z.object({
  tx: z.enum(["sell", "rent", "pg"], { message: "Choose buy, rent or PG" }),
  city: z.string().min(1, "Choose a city"),
  type: z.union([z.enum(TYPES), z.literal("")]),
  bhk: z.union([z.coerce.number().int().min(1).max(5), z.literal("")]),
  notes: z.string().trim().max(600, "Keep notes under 600 characters"),
});

export async function createRequirement(_prev: ReqState, form: FormData): Promise<ReqState> {
  const u = await getUser();
  if (!u) redirect("/login?next=/requirement");
  const parsed = schema.safeParse({ tx: form.get("tx"), city: form.get("city"), type: form.get("type") ?? "", bhk: form.get("bhk") ?? "", notes: form.get("notes") ?? "" });
  const fe: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
  const city = await db.prepare("SELECT id FROM cities WHERE slug = ?").get(String(form.get("city") ?? "")) as { id: number } | undefined;
  if (!city) fe.city ??= "Choose a city";
  const locIds: number[] = [];
  if (city) for (const id of form.getAll("loc").map(Number)) if (await db.prepare("SELECT 1 FROM localities WHERE id = ? AND city_id = ?").get(id, city.id)) locIds.push(id);
  if (locIds.length > 8) fe.loc = "Pick up to 8 localities";
  const bminRaw = String(form.get("budget_min") ?? "").trim(), bmaxRaw = String(form.get("budget_max") ?? "").trim();
  const bmin = bminRaw ? parseBudget(bminRaw) : null, bmax = bmaxRaw ? parseBudget(bmaxRaw) : null;
  if (bminRaw && bmin == null) fe.budget_min = "Use a number like 50L, 1.2Cr or 25000";
  if (bmaxRaw && bmax == null) fe.budget_max = "Use a number like 50L, 1.2Cr or 25000";
  if (!bmaxRaw) fe.budget_max ??= "Set a maximum budget so we can match listings";
  if (bmin != null && bmax != null && bmin > bmax) fe.budget_max = "Maximum must be more than minimum";
  if (Object.keys(fe).length || !parsed.success || !city) return { fieldErrors: fe };
  if (!(await rateLimit(`req:${u.id}`, 10, 86400)).ok) return { error: "You can post up to 10 requirements a day." };
  const active = (await db.prepare("SELECT COUNT(*) n FROM requirements WHERE user_id = ? AND active = 1").get(u.id) as { n: number }).n;
  if (active >= 10) return { error: "You have 10 active requirements. Pause one before adding another." };
  const d = parsed.data;
  const info = await db.prepare("INSERT INTO requirements (user_id, transaction_type, city_id, locality_ids, property_type, bhk, budget_min, budget_max, notes) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(u.id, d.tx, city.id, locIds.join(",") || null, d.type || null, d.bhk === "" ? null : d.bhk, bmin, bmax, d.notes || null);
  revalidatePath("/requirement");
  redirect(`/requirement?posted=${info.lastInsertRowid}#req-${info.lastInsertRowid}`);
}

export async function toggleRequirement(form: FormData) {
  const u = await getUser();
  if (!u) redirect("/login?next=/requirement");
  await db.prepare("UPDATE requirements SET active = 1 - active WHERE id = ? AND user_id = ?").run(Number(form.get("id")), u.id);
  revalidatePath("/requirement");
}

export async function deleteRequirement(form: FormData) {
  const u = await getUser();
  if (!u) redirect("/login?next=/requirement");
  await db.prepare("DELETE FROM requirements WHERE id = ? AND user_id = ?").run(Number(form.get("id")), u.id);
  revalidatePath("/requirement");
}
