import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

/** DPDP-style data portability: everything tied to the signed-in user, as JSON. */
export async function GET() {
  const u = await getUser();
  if (!u) return new Response(null, { status: 302, headers: { Location: "/login?next=/account/profile" } });
  if (!(await rateLimit(`export:${u.id}`, 10, 3600)).ok) return new Response("Too many export requests. Try again in an hour.", { status: 429 });
  const all = (sql: string, ...a: unknown[]) => db.prepare(sql).all(...a);
  const listingIds = "SELECT id FROM listings WHERE user_id = ?";
  const data = {
    exported_at: new Date().toISOString(),
    note: "Personal data held by 10cent for this account. Amounts are in rupees unless the field ends in _paise.",
    user: await db.prepare("SELECT id, phone, email, name, role, kyc_status, is_nri, preferred_cities, budget_min, budget_max, free_listing_limit, created_at, last_login_at FROM users WHERE id = ?").get(u.id),
    profile: await db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(u.id) ?? null,
    notification_prefs: await db.prepare("SELECT email, sms, whatsapp, push FROM notification_prefs WHERE user_id = ?").get(u.id) ?? null,
    listings: await all("SELECT * FROM listings WHERE user_id = ?", u.id),
    listing_media: await all(`SELECT * FROM listing_media WHERE listing_id IN (${listingIds})`, u.id),
    listing_amenities: await all(`SELECT * FROM listing_amenities WHERE listing_id IN (${listingIds})`, u.id),
    projects: await all("SELECT * FROM projects WHERE builder_id = ?", u.id),
    shortlists: await all("SELECT listing_id, created_at FROM shortlists WHERE user_id = ?", u.id),
    seen_listings: await all("SELECT listing_id, seen_at FROM seen_listings WHERE user_id = ?", u.id),
    saved_searches: await all("SELECT * FROM saved_searches WHERE user_id = ?", u.id),
    requirements: await all("SELECT * FROM requirements WHERE user_id = ?", u.id),
    enquiries_sent: await all("SELECT id, listing_id, project_id, poster_id, name, phone, email, message, channel, status, created_at FROM leads WHERE seeker_id = ?", u.id),
    enquiries_received: await all("SELECT id, listing_id, project_id, seeker_id, name, phone, email, message, channel, status, created_at FROM leads WHERE poster_id = ?", u.id),
    visits: await all("SELECT * FROM visits WHERE seeker_id = ?", u.id),
    notifications: await all("SELECT kind, title, body, link, read, created_at FROM notifications WHERE user_id = ?", u.id),
    reviews: await all("SELECT id, locality_id, project_id, agent_id, rating, body, status, created_at FROM reviews WHERE user_id = ?", u.id),
    reports_filed: await all("SELECT id, listing_id, reported_user_id, reason, details, status, created_at FROM reports WHERE reporter_id = ?", u.id),
    orders: await all("SELECT * FROM orders WHERE user_id = ?", u.id),
    invoices: await all("SELECT i.* FROM invoices i JOIN orders o ON o.id = i.order_id WHERE o.user_id = ?", u.id),
    subscriptions: await all("SELECT * FROM subscriptions WHERE user_id = ?", u.id),
    webhooks: await all("SELECT id, url, active, last_status, created_at FROM webhooks WHERE user_id = ?", u.id),
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="10cent-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
