"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, ShieldCheck, ListChecks, BadgeCheck, Users, Flag, Copy, CreditCard, Building2, Image as ImageIcon,
  FileText, MapPin, BarChart3, ScrollText, Send, UserCog, Timer, Menu, X,
} from "lucide-react";
import { cx } from "@/components/ui";
import type { LucideIcon } from "lucide-react";

type NavItem = { key: string; area: string; href: string; label: string; icon: LucideIcon };

export const ADMIN_NAV: Array<{ group: string; items: NavItem[] }> = [
  { group: "Overview", items: [
    { key: "dashboard", area: "dashboard", href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  ] },
  { group: "Listings", items: [
    { key: "moderation", area: "moderation", href: "/admin/moderation", label: "Moderation queue", icon: ShieldCheck },
    { key: "listings", area: "moderation", href: "/admin/listings", label: "All listings", icon: ListChecks },
    { key: "verification", area: "moderation", href: "/admin/verification", label: "Verification visits", icon: BadgeCheck },
  ] },
  { group: "Trust & users", items: [
    { key: "users", area: "users", href: "/admin/users", label: "Users", icon: Users },
    { key: "reports", area: "reports", href: "/admin/reports", label: "Fraud reports", icon: Flag },
    { key: "spam", area: "reports", href: "/admin/reports/spam", label: "Duplicates & spam", icon: Copy },
  ] },
  { group: "Revenue", items: [
    { key: "billing", area: "billing", href: "/admin/billing", label: "Billing", icon: CreditCard },
    { key: "projects", area: "projects", href: "/admin/projects", label: "Projects", icon: Building2 },
    { key: "banners", area: "banners", href: "/admin/banners", label: "Banners", icon: ImageIcon },
  ] },
  { group: "Content", items: [
    { key: "cms", area: "cms", href: "/admin/cms", label: "Articles & pages", icon: FileText },
    { key: "locations", area: "cms", href: "/admin/locations", label: "Cities & localities", icon: MapPin },
    { key: "analytics", area: "analytics", href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  ] },
  { group: "System", items: [
    { key: "outbox", area: "outbox", href: "/admin/outbox", label: "Message outbox", icon: Send },
    { key: "audit", area: "audit", href: "/admin/audit", label: "Audit log", icon: ScrollText },
    { key: "staff", area: "staff", href: "/admin/staff", label: "Staff & roles", icon: UserCog },
    { key: "jobs", area: "jobs", href: "/admin/jobs", label: "Background jobs", icon: Timer },
  ] },
];

export function AdminNav({ allowed, counts, who }: { allowed: string[]; counts: Record<string, number>; who: { name: string; role: string } }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/admin") return path === "/admin";
    if (href === "/admin/reports") return path === "/admin/reports";
    return path === href || path.startsWith(href + "/");
  };
  const current = ADMIN_NAV.flatMap((g) => g.items).find((i) => isActive(i.href));

  const list = (
    <nav aria-label="Admin sections" className="space-y-4">
      {ADMIN_NAV.map((g) => {
        const items = g.items.filter((i) => allowed.includes(i.key));
        if (!items.length) return null;
        return (
          <div key={g.group}>
            <div className="px-2.5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">{g.group}</div>
            <ul className="space-y-0.5">
              {items.map((i) => {
                const Icon = i.icon;
                const active = isActive(i.href);
                const n = counts[i.key];
                return (
                  <li key={i.key}>
                    <Link
                      href={i.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex items-center gap-2.5 h-8 px-2.5 rounded-[var(--radius-sm)] text-[13.5px] transition-colors",
                        active ? "bg-ink text-white" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
                      )}
                    >
                      <Icon size={16} strokeWidth={1.75} aria-hidden className={active ? "text-white" : "text-muted"} />
                      <span className="flex-1 truncate">{i.label}</span>
                      {n ? (
                        <span className={cx("num min-w-5 h-5 px-1.5 rounded-full text-[11px] font-semibold grid place-items-center", active ? "bg-white/15 text-white" : "bg-accent-soft text-accent-ink")}>{n}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile: compact bar with a drawer */}
      <div className="lg:hidden sticky top-16 z-30 bg-paper border-b border-line px-4 h-12 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="admin-drawer"
          className="h-9 px-2.5 -ml-2 inline-flex items-center gap-2 rounded-[var(--radius-sm)] hover:bg-paper-2 text-sm font-medium"
        >
          {open ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
          Admin
        </button>
        <span className="text-muted text-sm truncate">/ {current?.label ?? "Admin"}</span>
      </div>
      {open && (
        <div id="admin-drawer" className="lg:hidden fixed inset-x-0 top-28 bottom-0 z-30 bg-paper overflow-y-auto px-4 py-5 border-t border-line">
          <WhoAmI who={who} />
          {list}
        </div>
      )}

      {/* Desktop: sticky sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 border-r border-line">
        <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto py-6 px-3">
          <WhoAmI who={who} />
          {list}
        </div>
      </aside>
    </>
  );
}

function WhoAmI({ who }: { who: { name: string; role: string } }) {
  return (
    <div className="px-2.5 mb-6">
      <div className="font-display text-2xl leading-none">Back office</div>
      <div className="text-xs text-muted mt-1.5 truncate">
        {who.name} · <span className="uppercase tracking-wider font-semibold text-[10.5px] text-ink-2">{who.role}</span>
      </div>
    </div>
  );
}
