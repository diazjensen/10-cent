import "server-only";
import { deliverLeadWebhook } from "@/lib/supply/webhook";
import { db } from "@/lib/db";
import { bumpStat } from "@/lib/listings";
import { notify } from "@/lib/notify";
import { listingHeadline } from "@/lib/format";
import type { User } from "@/lib/auth";

export type LeadChannel = "contact" | "phone_reveal" | "visit" | "callback";

export type LeadListing = {
  id: number; user_id: number; title: string; status: string; bhk: number | null; property_type: string;
  transaction_type: string; locality_name: string | null; city_name: string; poster_phone: string | null; poster_name: string | null;
};

export function getLeadListing(id: number) {
  return db.prepare(`SELECT l.id, l.user_id, l.title, l.status, l.bhk, l.property_type, l.transaction_type,
      lo.name locality_name, c.name city_name, u.phone poster_phone, u.name poster_name
    FROM listings l JOIN cities c ON c.id = l.city_id JOIN users u ON u.id = l.user_id
    LEFT JOIN localities lo ON lo.id = l.locality_id WHERE l.id = ?`).get(id) as LeadListing | undefined;
}

/** Same seeker + listing + channel within the last 24h. */
export function recentLead(seekerId: number, listingId: number, channel: LeadChannel) {
  const since = new Date(Date.now() - 86400000).toISOString();
  return db.prepare("SELECT id FROM leads WHERE seeker_id = ? AND listing_id = ? AND channel = ? AND created_at >= ? ORDER BY id DESC LIMIT 1")
    .get(seekerId, listingId, channel, since) as { id: number } | undefined;
}

const CHANNEL_TITLE: Record<LeadChannel, string> = {
  contact: "New enquiry",
  phone_reveal: "Someone viewed your number",
  visit: "Site visit requested",
  callback: "Callback requested",
};

/**
 * Creates a lead linked to listing, seeker and poster (PRD §4.4), bumps contact stats and notifies the poster
 * by SMS, email and WhatsApp. Returns the existing lead id instead when a duplicate exists within a day.
 */
export function createLead(opts: {
  listing: LeadListing; seeker: User; channel: LeadChannel;
  name?: string | null; phone?: string | null; email?: string | null; message?: string | null; detail?: string;
}): { id: number; duplicate: boolean } {
  const { listing, seeker, channel } = opts;
  const dup = recentLead(seeker.id, listing.id, channel);
  if (dup) return { id: dup.id, duplicate: true };
  const name = opts.name?.trim() || seeker.name || null;
  const phone = opts.phone || seeker.phone || null;
  const email = opts.email || seeker.email || null;
  const info = db.prepare(
    "INSERT INTO leads (listing_id, seeker_id, poster_id, name, phone, email, message, channel, consent) VALUES (?,?,?,?,?,?,?,?,1)"
  ).run(listing.id, seeker.id, listing.user_id, name, phone, email, opts.message?.trim() || null, channel);
  bumpStat(listing.id, "contacts");
  const head = listingHeadline(listing);
  const who = [name || "A seeker", phone ? `(${phone})` : null].filter(Boolean).join(" ");
  notify(
    listing.user_id,
    {
      kind: "lead",
      title: `${CHANNEL_TITLE[channel]}: ${head}`,
      body: `${who}${opts.detail ? ` · ${opts.detail}` : ""}${opts.message ? ` · "${opts.message.trim().slice(0, 140)}"` : ""}`,
      link: "/dashboard/responses",
    },
    ["sms", "email", "whatsapp"]
  );
  const leadId = Number(info.lastInsertRowid);
  void deliverLeadWebhook(leadId);
  return { id: leadId, duplicate: false };
}
