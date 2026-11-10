"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export type NavItem = { href: string; label: string; badge?: number };

/** Dashboard section navigation: vertical on desktop, horizontal scroller on mobile. */
export function DashNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/dashboard" ? path === href : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label="Dashboard" className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto scrollbar-none">
      <ul className="flex md:flex-col gap-1 md:gap-0.5 min-w-max md:min-w-0">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={active(it.href) ? "page" : undefined}
              className={cx(
                "flex items-center justify-between gap-3 h-9 px-3 rounded-[var(--radius-sm)] text-sm whitespace-nowrap",
                active(it.href) ? "bg-ink text-white" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
              )}
            >
              {it.label}
              {it.badge ? <span className={cx("num text-[11px] font-semibold px-1.5 rounded-full", active(it.href) ? "bg-white/20" : "bg-accent text-white")}>{it.badge}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
