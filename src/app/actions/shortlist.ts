"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { bumpStat } from "@/lib/listings";

export async function toggleShortlist(listingId: number): Promise<{ ok: boolean; saved?: boolean; needLogin?: boolean }> {
  const u = await getUser();
  if (!u) return { ok: false, needLogin: true };
  const exists = db.prepare("SELECT 1 FROM shortlists WHERE user_id = ? AND listing_id = ?").get(u.id, listingId);
  if (exists) {
    db.prepare("DELETE FROM shortlists WHERE user_id = ? AND listing_id = ?").run(u.id, listingId);
  } else {
    const l = db.prepare("SELECT id FROM listings WHERE id = ?").get(listingId);
    if (!l) return { ok: false };
    db.prepare("INSERT INTO shortlists (user_id, listing_id) VALUES (?, ?)").run(u.id, listingId);
    bumpStat(listingId, "shortlists");
  }
  revalidatePath("/account/shortlist");
  return { ok: true, saved: !exists };
}

export async function myShortlistIds(): Promise<number[]> {
  const u = await getUser();
  if (!u) return [];
  return (db.prepare("SELECT listing_id FROM shortlists WHERE user_id = ?").all(u.id) as { listing_id: number }[]).map((r) => r.listing_id);
}
