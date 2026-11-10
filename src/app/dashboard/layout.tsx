import Link from "next/link";
import { db } from "@/lib/db";
import { Container } from "@/components/ui";
import { DashNav, type NavItem } from "@/components/supply/dash-nav";
import { dashboardContext } from "@/lib/supply/account";
import { stopViewAsAction } from "./actions";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { viewer, subject, impersonating } = await dashboardContext();
  const role = subject.role;
  const newLeads = (db.prepare("SELECT COUNT(*) n FROM leads WHERE poster_id = ? AND status = 'new'").get(subject.id) as { n: number }).n;
  const items: NavItem[] = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/listings", label: "My listings" },
    { href: "/dashboard/responses", label: "Responses", badge: newLeads },
    { href: "/dashboard/insights", label: "Insights" },
    ...(role === "builder" ? [{ href: "/dashboard/projects", label: "Projects" }] : []),
    ...(role === "builder" || role === "agent" ? [{ href: "/dashboard/leads", label: "Leads & CRM" }, { href: "/dashboard/bulk", label: "Bulk upload" }] : []),
    { href: "/dashboard/billing", label: "Plan & billing" },
    { href: "/dashboard/profile", label: role === "owner" || role === "admin" ? "Profile" : "Business profile" },
    { href: "/dashboard/settings", label: "Alerts" },
  ];
  return (
    <div className="border-t border-transparent">
      {impersonating && (
        <div className="bg-warn-soft border-b border-warn/20">
          <Container className="py-2 flex items-center justify-between gap-3 text-sm text-warn">
            <span>Admin view: you&apos;re seeing <b>{subject.name || subject.phone}</b>&apos;s dashboard ({subject.role}, user #{subject.id}) as {viewer.name}.</span>
            <form action={stopViewAsAction}><button className="underline underline-offset-2 font-medium">Stop viewing</button></form>
          </Container>
        </div>
      )}
      <Container className="py-6 md:py-8 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 md:gap-10">
        <aside className="min-w-0 md:sticky md:top-24 self-start">
          <div className="hidden md:block mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{subject.role === "admin" ? "Admin" : subject.role} dashboard</p>
            <p className="font-medium mt-1 truncate">{subject.name || subject.phone}</p>
          </div>
          <DashNav items={items} />
          <Link href="/post-property" className="hidden md:flex mt-5 items-center justify-center h-10 rounded-[var(--radius-sm)] bg-accent text-white text-sm font-medium hover:bg-accent-ink">Post property</Link>
        </aside>
        <div className="min-w-0">{children}</div>
      </Container>
    </div>
  );
}
