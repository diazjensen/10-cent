import "server-only";
import { db } from "./db";

/**
 * Notification fan-out (PRD A3, O3).
 * In-app notifications are written directly. SMS / email / WhatsApp / push are written to the
 * `outbox` table; a provider worker (MSG91, SES, WhatsApp Cloud API, FCM) would drain it.
 * Until real provider keys are configured, the outbox is visible to admins at /admin/outbox.
 */
export function notify(userId: number, n: { kind: string; title: string; body?: string; link?: string }, channels: Array<"sms" | "email" | "whatsapp" | "push"> = []) {
  db.prepare("INSERT INTO notifications (user_id, kind, title, body, link) VALUES (?,?,?,?,?)").run(
    userId, n.kind, n.title, n.body ?? null, n.link ?? null
  );
  if (!channels.length) return;
  const user = db.prepare("SELECT phone, email FROM users WHERE id = ?").get(userId) as { phone: string | null; email: string | null } | undefined;
  if (!user) return;
  const prefs = (db.prepare("SELECT * FROM notification_prefs WHERE user_id = ?").get(userId) as
    | { email: number; sms: number; whatsapp: number; push: number }
    | undefined) ?? { email: 1, sms: 1, whatsapp: 0, push: 1 };
  const text = n.body ? `${n.title}. ${n.body}` : n.title;
  for (const ch of channels) {
    if (!prefs[ch]) continue;
    const recipient = ch === "email" ? user.email : user.phone;
    if (!recipient) continue;
    queueMessage(ch, recipient, text, n.title);
  }
}

export function queueMessage(channel: string, recipient: string, body: string, subject?: string) {
  db.prepare("INSERT INTO outbox (channel, recipient, subject, body) VALUES (?,?,?,?)").run(channel, recipient, subject ?? null, body);
}
