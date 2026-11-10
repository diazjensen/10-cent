"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { db, nowIso } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export type ReviewState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

const schema = z.object({
  rating: z.coerce.number().int().min(1, "Pick a rating from 1 to 5").max(5, "Pick a rating from 1 to 5"),
  body: z.string().trim().min(20, "Write at least 20 characters so others learn something useful").max(1200, "Keep it under 1,200 characters"),
});

/** Create or update the signed-in user's single review for a locality or an agent. */
export async function submitReview(target: { kind: "locality" | "agent"; id: number; path: string }, _prev: ReviewState, form: FormData): Promise<ReviewState> {
  const u = await getUser();
  if (!u) return { error: "Log in to write a review." };
  const parsed = schema.safeParse({ rating: form.get("rating"), body: form.get("body") });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { fieldErrors: fe };
  }
  if (!(await rateLimit(`review:${u.id}`, 10, 3600)).ok) return { error: "You've posted a lot of reviews in the last hour. Try again later." };
  const col = target.kind === "locality" ? "locality_id" : "agent_id";
  if (target.kind === "locality") {
    if (!await db.prepare("SELECT 1 FROM localities WHERE id = ?").get(target.id)) return { error: "Locality not found." };
  } else {
    if (target.id === u.id) return { error: "You can't review your own profile." };
    if (!await db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'agent'").get(target.id)) return { error: "Agent not found." };
  }
  await db.transaction(async () => {
    // One review per user per target: serialise concurrent submits.
    await db.prepare("SELECT pg_advisory_xact_lock(hashtext(?))").get(`review:${u.id}:${col}:${target.id}`);
    const existing = await db.prepare(`SELECT id FROM reviews WHERE user_id = ? AND ${col} = ?`).get(u.id, target.id) as { id: number } | undefined;
    if (existing) {
      await db.prepare("UPDATE reviews SET rating = ?, body = ?, status = 'published', created_at = ? WHERE id = ?").run(parsed.data.rating, parsed.data.body, nowIso(), existing.id);
    } else {
      await db.prepare(`INSERT INTO reviews (${col}, user_id, rating, body, status) VALUES (?,?,?,?, 'published')`).run(target.id, u.id, parsed.data.rating, parsed.data.body);
    }
    if (target.kind === "agent") {
      const agg = await db.prepare("SELECT AVG(rating) a, COUNT(*) n FROM reviews WHERE agent_id = ? AND status = 'published'").get(target.id) as { a: number; n: number };
      await db.prepare("UPDATE profiles SET rating = ?, rating_count = ? WHERE user_id = ?").run(Math.round(agg.a * 10) / 10, agg.n, target.id);
    }
  })();
  revalidatePath(target.path);
  return { ok: true };
}
