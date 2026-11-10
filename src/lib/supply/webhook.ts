import "server-only";
import crypto from "node:crypto";
import { after } from "next/server";
import { db, nowIso } from "@/lib/db";

/**
 * CRM webhooks for agents and builders (PRD B7).
 * Each delivery is a JSON POST signed with HMAC-SHA256 of the raw body using the webhook secret,
 * sent as `X-10cent-Signature: sha256=<hex>`. Receivers should recompute and compare in constant time.
 *
 * Any code that creates a lead should call `deliverLeadWebhook(leadId)` after inserting it
 * (fire-and-forget; it never throws).
 */

export type WebhookRow = { id: number; user_id: number; url: string; secret: string; active: number; last_status: string | null; created_at: string };

export const newSecret = () => `whsec_${crypto.randomBytes(24).toString("hex")}`;

export function sign(secret: string, body: string) {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

export async function getWebhook(userId: number): Promise<WebhookRow | undefined> {
  return await db.prepare("SELECT * FROM webhooks WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(userId) as WebhookRow | undefined;
}

export function isValidWebhookUrl(u: string) {
  try {
    const url = new URL(u);
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRIVATE_WEBHOOKS !== "1") {
      // Block obvious internal targets in production (SSRF). DNS-rebinding needs an egress proxy on top of this.
      if (url.protocol !== "https:") return false;
      const h = url.hostname.toLowerCase();
      if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h) || h.startsWith("[")) return false;
    }
    return (url.protocol === "https:" || url.protocol === "http:") && !!url.hostname && u.length <= 500;
  } catch {
    return false;
  }
}

async function post(hook: WebhookRow, event: string, data: unknown): Promise<{ ok: boolean; status: string }> {
  const body = JSON.stringify({ event, id: `evt_${crypto.randomBytes(8).toString("hex")}`, created_at: nowIso(), data });
  let status: string;
  let ok = false;
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "10cent-Webhooks/1.0",
        "X-10cent-Event": event,
        "X-10cent-Signature": sign(hook.secret, body),
      },
      body,
      signal: AbortSignal.timeout(5000),
      redirect: "manual",
    });
    ok = res.ok;
    status = `${res.status} ${res.statusText || (ok ? "OK" : "")}`.trim();
  } catch (e) {
    status = `error: ${(e as Error).name === "TimeoutError" ? "timed out after 5s" : (e as Error).message}`.slice(0, 200);
  }
  await db.prepare("UPDATE webhooks SET last_status = ? WHERE id = ?").run(`${status} · ${event} · ${nowIso()}`, hook.id);
  return { ok, status };
}

export async function leadPayload(leadId: number) {
  return await db.prepare(
      `SELECT ld.id, ld.channel, ld.status, ld.name, ld.phone, ld.email, ld.message, ld.created_at,
            ld.listing_id, l.title AS listing_title, ld.project_id, p.name AS project_name
     FROM leads ld LEFT JOIN listings l ON l.id = ld.listing_id LEFT JOIN projects p ON p.id = ld.project_id
     WHERE ld.id = ?`
    ).get(leadId) as Record<string, unknown> | undefined;
}

/** POSTs a real lead to the poster's active webhook, if any. Never throws. */
export async function deliverLeadWebhook(leadId: number): Promise<void> {
  try {
    const lead = await db.prepare("SELECT poster_id, consent FROM leads WHERE id = ?").get(leadId) as { poster_id: number; consent: number } | undefined;
    if (!lead || !lead.consent) return;
    const hook = await getWebhook(lead.poster_id);
    if (!hook || !hook.active) return;
    const data = await leadPayload(leadId);
    if (!data) return;
    const r = await post(hook, "lead.created", data);
    if (r.ok) await db.prepare("INSERT INTO audit_logs (actor_id, action, entity, entity_id, details) VALUES (NULL, 'webhook.delivered', 'lead', ?, ?)").run(leadId, JSON.stringify({ webhook_id: hook.id }));
  } catch {
    /* delivery problems are recorded in last_status; never block lead creation */
  }
}

/** Sends a signed sample payload so the integrator can verify their endpoint. */
export async function sendTestWebhook(userId: number) {
  const hook = await getWebhook(userId);
  if (!hook) return { ok: false, status: "No webhook configured" };
  return post(hook, "lead.test", {
    id: 0, channel: "enquiry", status: "new", name: "Test Seeker", phone: "9999999999", email: "test@example.com",
    message: "This is a test lead from 10cent. No action needed.", created_at: nowIso(),
    listing_id: null, listing_title: null, project_id: null, project_name: "Sample project",
  });
}

/**
 * Catch-up delivery: sends leads created after the webhook was set up that haven't been delivered yet
 * (e.g. leads created by code paths that don't call deliverLeadWebhook, or while the endpoint was down).
 */
export async function syncPendingLeads(userId: number, max = 25): Promise<number> {
  const hook = await getWebhook(userId);
  if (!hook || !hook.active) return 0;
  const rows = await db.prepare(
      `SELECT ld.id FROM leads ld WHERE ld.poster_id = ? AND ld.created_at >= ? AND ld.consent = 1
       AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.action = 'webhook.delivered' AND a.entity = 'lead' AND a.entity_id = ld.id)
     ORDER BY ld.id LIMIT ?`
    ).all(userId, hook.created_at, max) as { id: number }[];
  for (const r of rows) await deliverLeadWebhook(r.id);
  return rows.length;
}

/**
 * Delivers a lead webhook after the response is sent (safe on serverless hosts, where un-awaited work can be cut off).
 * Falls back to fire-and-forget when called outside a request (scripts, jobs).
 */
export function scheduleLeadWebhook(leadId: number): void {
  try {
    after(() => deliverLeadWebhook(leadId));
  } catch {
    void deliverLeadWebhook(leadId);
  }
}
