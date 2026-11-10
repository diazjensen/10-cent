"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { bumpStat } from "@/lib/listings";

export async function toggleShortlist(listingId: number): Promise<{ ok: boolean; saved?: boolean; needLogin?: boolean }> {
  const u = await getUser();
  if (!u) return { ok: false, needLogin: true };
  // Atomic toggle: concurrent double-clicks must not hit the primary key (or double-count stats).
  const del = await db.prepare("DELETE FROM shortlists WHERE user_id = ? AND listing_id = ?").run(u.id, listingId);
  let saved = false;
  if (!del.changes) {
    const l = await db.prepare("SELECT id FROM listings WHERE id = ?").get(listingId);
    if (!l) return { ok: false };
    const ins = await db.prepare("INSERT INTO shortlists (user_id, listing_id) VALUES (?, ?) ON CONFLICT DO NOTHING").run(u.id, listingId);
    saved = true;
    if (ins.changes) await bumpStat(listingId, "shortlists");
  }
  revalidatePath("/account/shortlist");
  return { ok: true, saved };
}

export async function myShortlistIds(): Promise<number[]> {
  const u = await getUser();
  if (!u) return [];
  return (await db.prepare("SELECT listing_id FROM shortlists WHERE user_id = ?").all(u.id) as { listing_id: number }[]).map((r) => r.listing_id);
}
