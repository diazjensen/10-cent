import type { Metadata } from "next";
import { requireAdmin, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { NAV_AREAS } from "@/lib/admin/areas";
import { AdminNav } from "@/components/admin/nav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · 10cent" },
  robots: { index: false, follow: false },
};

const n = async (sql: string) => (await db.prepare(sql).get() as { n: number }).n;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin("dashboard");
  const allowed = Object.entries(NAV_AREAS).filter(([, area]) => can(user, area)).map(([k]) => k);
  const counts: Record<string, number> = {};
  if (allowed.includes("moderation")) counts.moderation = await n("SELECT COUNT(*) n FROM listings WHERE status = 'pending'");
  if (allowed.includes("verification")) counts.verification = await n("SELECT COUNT(*) n FROM listings WHERE verification_requested_at IS NOT NULL AND verified = 0 AND status IN ('live','pending')");
  if (allowed.includes("reports")) counts.reports = await n("SELECT COUNT(*) n FROM reports WHERE status = 'open'");
  if (allowed.includes("outbox")) counts.outbox = await n("SELECT COUNT(*) n FROM outbox WHERE status = 'queued'");

  return (
    <div className="lg:flex mx-auto max-w-[1480px] w-full">
      <AdminNav allowed={allowed} counts={counts} who={{ name: user.name || user.phone || "Staff", role: user.admin_role ?? "" }} />
      <div className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8 pb-16">{children}</div>
    </div>
  );
}
