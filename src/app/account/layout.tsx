import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/format";
import { AccountTabs } from "@/components/account/tabs";
import { Container } from "@/components/ui";

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const u = await getUser();
  // Pages enforce login themselves (so they can redirect back to the right tab); signed-out views render bare.
  if (!u) return <>{children}</>;
  const c = db.prepare(`SELECT
      (SELECT COUNT(*) FROM shortlists WHERE user_id = @id) shortlist,
      (SELECT COUNT(*) FROM leads WHERE seeker_id = @id) contacted,
      (SELECT COUNT(*) FROM saved_searches WHERE user_id = @id) searches,
      (SELECT COUNT(*) FROM notifications WHERE user_id = @id AND read = 0) unread,
      (SELECT COUNT(*) FROM requirements WHERE user_id = @id AND active = 1) reqs`).get({ id: u.id }) as Record<string, number>;
  const tabs = [
    { href: "/account/shortlist", label: "Shortlist", count: c.shortlist },
    { href: "/account/contacted", label: "Contacted", count: c.contacted },
    { href: "/account/seen", label: "Recently seen" },
    { href: "/account/searches", label: "Saved searches", count: c.searches },
    { href: "/requirement", label: "Requirements", count: c.reqs },
    { href: "/account/notifications", label: "Notifications", count: c.unread },
    { href: "/account/profile", label: "Profile & privacy" },
  ];
  return (
    <Container className="py-8 md:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6 lg:gap-10">
        <aside>
          <div className="mb-4 hidden lg:block">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">My account</div>
            <div className="font-medium mt-1 truncate">{u.name || "Welcome"}</div>
            <div className="text-xs text-muted truncate">{u.phone ? formatPhone(u.phone) : u.email}</div>
          </div>
          <AccountTabs tabs={tabs} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
