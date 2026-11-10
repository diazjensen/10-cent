import type { Metadata } from "next";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { Card } from "@/components/ui";
import { dashboardContext } from "@/lib/supply/account";
import { PageTitle } from "@/components/supply/bits";
import { PrefsForm } from "@/components/supply/profile-form";

export const metadata: Metadata = { title: "Enquiry alerts", robots: { index: false } };

export default async function SettingsPage() {
  const { subject } = await dashboardContext("/dashboard/settings");
  const prefs = (db.prepare("SELECT email, sms, whatsapp, push FROM notification_prefs WHERE user_id = ?").get(subject.id) as { email: number; sms: number; whatsapp: number; push: number } | undefined) ?? { email: 1, sms: 1, whatsapp: 0, push: 1 };
  const recipients = [subject.phone, subject.email].filter(Boolean) as string[];
  const recent = recipients.length
    ? (db.prepare(`SELECT channel, recipient, subject, body, status, created_at FROM outbox WHERE recipient IN (${recipients.map(() => "?").join(",")}) AND body NOT LIKE '%verification code%' ORDER BY id DESC LIMIT 8`).all(...recipients) as Array<{ channel: string; recipient: string; subject: string | null; body: string; status: string; created_at: string }>)
    : [];
  return (
    <div className="max-w-3xl">
      <PageTitle eyebrow="Notifications" title="Enquiry alerts" sub="Every new enquiry, site-visit request and moderation decision is sent on the channels you choose." />
      <PrefsForm initial={prefs} contact={{ phone: subject.phone, email: subject.email }} />
      <h2 className="font-display text-2xl mt-10 mb-3">Recently sent to you</h2>
      {recent.length === 0 ? (
        <p className="text-sm text-muted">Nothing sent yet.</p>
      ) : (
        <Card className="divide-y divide-line">
          {recent.map((r, i) => (
            <div key={i} className="px-4 py-3 text-sm grid grid-cols-[72px_1fr] gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted pt-0.5">{r.channel}</span>
              <div className="min-w-0">
                <p className="text-ink-2 line-clamp-2">{r.body}</p>
                <p className="text-xs text-muted mt-0.5">{timeAgo(r.created_at)} · {r.status === "queued" ? "queued for provider" : r.status}</p>
              </div>
            </div>
          ))}
        </Card>
      )}
      <p className="text-xs text-muted mt-3">SMS, email and WhatsApp are delivered through our messaging providers. Messages show as queued until the provider confirms delivery.</p>
    </div>
  );
}
