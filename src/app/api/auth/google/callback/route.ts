import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const saved = JSON.parse(jar.get("tc_oauth")?.value || "{}") as { state?: string; next?: string };
  jar.delete("tc_oauth");
  const next = saved.next?.startsWith("/") ? saved.next : "/";
  if (!saved.state || saved.state !== url.searchParams.get("state")) return NextResponse.redirect(new URL("/login?error=google", url));
  const redirectUri = `${process.env.SITE_URL || url.origin}/api/auth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: url.searchParams.get("code") || "", client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!tokenRes.ok) return NextResponse.redirect(new URL("/login?error=google", url));
  const tok = (await tokenRes.json()) as { access_token: string };
  const info = (await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } })).json()) as { email?: string; email_verified?: boolean; name?: string };
  if (!info.email || !info.email_verified) return NextResponse.redirect(new URL("/login?error=google", url));
  const email = info.email.toLowerCase();
  let u = await db.prepare("SELECT id, blocked FROM users WHERE email = ? AND deleted_at IS NULL").get(email) as { id: number; blocked: number } | undefined;
  if (!u) {
    const r = await db.prepare("INSERT INTO users (email, name, role) VALUES (?,?, 'seeker')").run(email, info.name ?? null);
    await db.prepare("INSERT OR IGNORE INTO notification_prefs (user_id) VALUES (?)").run(r.lastInsertRowid);
    u = { id: Number(r.lastInsertRowid), blocked: 0 };
  }
  if (u.blocked) return NextResponse.redirect(new URL("/login?error=blocked", url));
  await createSession(u.id);
  return NextResponse.redirect(new URL(next, url));
}
