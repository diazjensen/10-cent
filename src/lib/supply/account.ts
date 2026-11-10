import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, nowIso } from "@/lib/db";
import { getUser, type User } from "@/lib/auth";

export type ActivePlan = {
  sub_id: number;
  plan_id: number;
  code: string;
  name: string;
  audience: string;
  listing_limit: number;
  boost: number;
  starts_at: string;
  ends_at: string;
};

/** Current active (not expired) subscription with plan details, if any. */
export async function activePlan(userId: number): Promise<ActivePlan | null> {
  return (
    (await db
            .prepare(
              `SELECT s.id sub_id, p.id plan_id, p.code, p.name, p.audience, p.listing_limit, p.boost, s.starts_at, s.ends_at
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id
         WHERE s.user_id = ? AND s.status = 'active' AND s.ends_at > ?
         ORDER BY p.listing_limit DESC, s.ends_at DESC LIMIT 1`
            )
            .get(userId, nowIso()) as ActivePlan | undefined) ?? null
  );
}

export const ACTIVE_STATUSES = ["pending", "live", "paused"] as const;

/** Listing quota (PRD P1): free limit or the active plan's limit, whichever is higher. */
export async function listingQuota(userId: number) {
  const u = await db.prepare("SELECT free_listing_limit FROM users WHERE id = ?").get(userId) as { free_listing_limit: number } | undefined;
  const plan = await activePlan(userId);
  const limit = Math.max(u?.free_listing_limit ?? 3, plan?.listing_limit ?? 0);
  const used = (await db.prepare("SELECT COUNT(*) n FROM listings WHERE user_id = ? AND status IN ('pending','live','paused')").get(userId) as { n: number }).n;
  return { used, limit, remaining: Math.max(0, limit - used), plan };
}

export const DASH_AS_COOKIE = "tc_dash_as";

/**
 * Who the dashboard is showing. Supply users see their own data.
 * Admins (support/sales/moderator/super) may view a poster's dashboard read-mostly via the "view as" cookie.
 */
export async function dashboardContext(next = "/dashboard"): Promise<{ viewer: User; subject: User; impersonating: boolean }> {
  const viewer = await getUser();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (viewer.role === "seeker") redirect("/post-property?from=dashboard");
  if (viewer.role === "admin") {
    const jar = await cookies();
    const asId = Number(jar.get(DASH_AS_COOKIE)?.value);
    if (asId) {
      const subject = await db.prepare("SELECT * FROM users WHERE id = ? AND role IN ('owner','agent','builder')").get(asId) as User | undefined;
      if (subject) return { viewer, subject, impersonating: true };
    }
  }
  return { viewer, subject: viewer, impersonating: false };
}

/** For actions: the user whose data is being changed, with admin override. */
export async function actingSubject(): Promise<{ viewer: User; subjectId: number } | null> {
  const viewer = await getUser();
  if (!viewer) return null;
  if (viewer.role === "admin") {
    const jar = await cookies();
    const asId = Number(jar.get(DASH_AS_COOKIE)?.value);
    if (asId) return { viewer, subjectId: asId };
  }
  return { viewer, subjectId: viewer.id };
}

/** Can this user act on a listing? Owner of the listing or an admin. */
export async function ownsListing(user: User, listingId: number) {
  const l = await db.prepare("SELECT user_id FROM listings WHERE id = ?").get(listingId) as { user_id: number } | undefined;
  if (!l) return false;
  return l.user_id === user.id || user.role === "admin";
}

export async function ownsProject(user: User, projectId: number) {
  const p = await db.prepare("SELECT builder_id FROM projects WHERE id = ?").get(projectId) as { builder_id: number } | undefined;
  if (!p) return false;
  return p.builder_id === user.id || user.role === "admin";
}

export async function getProfile(userId: number) {
  return await db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId) as
    | { user_id: number; company_name: string | null; rera_number: string | null; experience_years: number | null; established_year: number | null; about: string | null; city_id: number | null; website: string | null; gstin: string | null; logo_url: string | null }
    | undefined;
}
