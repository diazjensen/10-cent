import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Google OAuth start (PRD A1). Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}&error=google`, url));
  }
  const state = crypto.randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("tc_oauth", JSON.stringify({ state, next }), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  const redirectUri = `${process.env.SITE_URL || url.origin}/api/auth/google/callback`;
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, prompt: "select_account" }).toString();
  return NextResponse.redirect(auth);
}
