"use server";

import { formValues } from "@/lib/seeker/form-values";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { flattenParams, toQuery } from "@/lib/seeker/search-params";

export type SaveSearchState = { values?: Record<string, string>; ok?: boolean; needLogin?: boolean; error?: string; fieldErrors?: Record<string, string>; updated?: boolean };

const schema = z.object({
  name: z.string().trim().min(3, "Give it a name (3+ characters)").max(80, "Keep it under 80 characters"),
  query: z.string().max(1500),
  channels: z.array(z.enum(["email", "sms", "push", "whatsapp"])).min(1, "Pick at least one channel"),
  frequency: z.enum(["instant", "daily", "weekly"], { error: "Pick how often" }),
});

/** Save the current /search query with alert channels and frequency (PRD S8). */
export async function saveSearch(prev: SaveSearchState, form: FormData): Promise<SaveSearchState> {
  const r = await saveSearchInner(prev, form);
  // Echo submitted values so the form can keep them after React resets it.
  return r.ok ? r : { ...r, values: formValues(form) };
}

async function saveSearchInner(_prev: SaveSearchState, form: FormData): Promise<SaveSearchState> {
  const user = await getUser();
  if (!user) return { needLogin: true };
  const parsed = schema.safeParse({
    name: form.get("name"), query: form.get("query") ?? "", channels: form.getAll("channels"), frequency: form.get("frequency"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }
  const d = parsed.data;
  // Re-normalise so only known params are stored, without paging or view state.
  const query = toQuery(flattenParams(Object.fromEntries(new URLSearchParams(d.query).entries())), ["page", "view"]);
  if (!query) return { error: "Add at least one filter before saving a search." };
  if (!user.email && d.channels.includes("email") && d.channels.length === 1)
    return { fieldErrors: { channels: "Add an email to your profile, or pick SMS / WhatsApp / push" } };
  const existing = db.prepare("SELECT id FROM saved_searches WHERE user_id = ? AND query = ?").get(user.id, query) as { id: number } | undefined;
  if (existing) {
    db.prepare("UPDATE saved_searches SET name = ?, channels = ?, frequency = ? WHERE id = ?").run(d.name, d.channels.join(","), d.frequency, existing.id);
  } else {
    const n = (db.prepare("SELECT COUNT(*) n FROM saved_searches WHERE user_id = ?").get(user.id) as { n: number }).n;
    if (n >= 25) return { error: "You have 25 saved searches. Delete one from your account to add another." };
    db.prepare("INSERT INTO saved_searches (user_id, name, query, channels, frequency, last_checked_at) VALUES (?,?,?,?,?,?)")
      .run(user.id, d.name, query, d.channels.join(","), d.frequency, new Date().toISOString());
  }
  revalidatePath("/account/searches");
  return { ok: true, updated: !!existing };
}
