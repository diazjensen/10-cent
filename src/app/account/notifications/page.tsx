import type { Metadata } from "next";
import { Bell, BellRing, CalendarCheck, CreditCard, ShieldAlert, MessageSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { markRead, markAllRead, deleteReadNotifications, saveNotificationPrefs } from "../actions";
import { AccountHeading } from "@/components/account/heading";
import { PrefsForm } from "@/components/account/prefs-form";
import { EmptyState, btnClass, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

const ICON: Record<string, typeof Bell> = { lead: MessageSquare, alert: BellRing, moderation: ShieldAlert, billing: CreditCard, visit: CalendarCheck, system: Bell };

export default async function NotificationsPage() {
  const u = await requireUser("/account/notifications");
  const rows = await db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100").all(u.id) as Array<{ id: number; kind: string; title: string; body: string | null; link: string | null; read: number; created_at: string }>;
  const unread = rows.filter((r) => !r.read).length;
  const prefs = (await db.prepare("SELECT email, sms, whatsapp, push FROM notification_prefs WHERE user_id = ?").get(u.id) as Record<string, number> | undefined) ?? { email: 1, sms: 1, whatsapp: 0, push: 1 };
  return (
    <>
      <AccountHeading title="Notifications" sub={unread ? `${unread} unread` : "You're all caught up"}
        action={
          <div className="flex gap-2">
            {unread > 0 && <form action={markAllRead}><button className={btnClass("secondary", "sm")}>Mark all read</button></form>}
            {rows.length > unread && <form action={deleteReadNotifications}><button className={btnClass("ghost", "sm")}>Clear read</button></form>}
          </div>
        } />
      {rows.length ? (
        <ul className="bg-card border border-line rounded-[var(--radius-md)] divide-y divide-line overflow-hidden">
          {rows.map((n) => {
            const Icon = ICON[n.kind] ?? Bell;
            return (
              <li key={n.id} className={cx(!n.read && "bg-accent-soft/30")}>
                <form action={markRead}>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="link" value={n.link ?? ""} />
                  <button className="w-full text-left flex gap-3 px-4 py-3.5 hover:bg-paper-2/60">
                    <span className={cx("w-8 h-8 shrink-0 rounded-full grid place-items-center", n.read ? "bg-paper-2 text-muted" : "bg-accent text-white")}><Icon size={15} aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className={cx("block text-sm", !n.read && "font-semibold")}>{n.title}{!n.read && <span className="sr-only"> (unread)</span>}</span>
                      {n.body && <span className="block text-sm text-ink-2 mt-0.5 line-clamp-2">{n.body}</span>}
                      <span className="block text-xs text-muted mt-1">{timeAgo(n.created_at)}{n.link ? " · Open" : !n.read ? " · Mark as read" : ""}</span>
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<Bell size={18} />} title="No notifications yet" body="Replies to your enquiries, visit confirmations and new matches for saved searches will appear here." />
      )}
      <section id="prefs" className="mt-10 scroll-mt-24">
        <h2 className="font-display text-3xl mb-1">Preferences</h2>
        <p className="text-sm text-muted mb-4">Choose how 10cent may reach you. In-app notifications are always on. OTPs are sent regardless of these settings.</p>
        <PrefsForm prefs={prefs} action={saveNotificationPrefs} hasEmail={!!u.email} hasPhone={!!u.phone} />
      </section>
    </>
  );
}
