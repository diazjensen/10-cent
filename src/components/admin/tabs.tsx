import Link from "next/link";
import { cx } from "@/components/ui";

export function Tabs({ items, current }: { items: Array<{ href: string; label: string; count?: number }>; current: string }) {
  return (
    <nav aria-label="Sections" className="flex gap-1 border-b border-line mb-5 overflow-x-auto scrollbar-none">
      {items.map((t) => {
        const active = t.href === current;
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={cx("h-10 px-3 inline-flex items-center gap-1.5 text-[13.5px] whitespace-nowrap border-b-2 -mb-px", active ? "border-ink text-ink font-medium" : "border-transparent text-muted hover:text-ink")}>
            {t.label}{t.count != null && <span className="num text-xs text-muted">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export const BILLING_TABS = [
  { href: "/admin/billing", label: "Orders" },
  { href: "/admin/billing/plans", label: "Plans & pricing" },
  { href: "/admin/billing/coupons", label: "Coupons" },
  { href: "/admin/billing/invoices", label: "Invoices" },
];

export const CMS_TABS = [
  { href: "/admin/cms", label: "Articles" },
  { href: "/admin/cms/pages", label: "Static pages" },
];
