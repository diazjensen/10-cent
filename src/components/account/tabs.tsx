"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export function AccountTabs({ tabs }: { tabs: Array<{ href: string; label: string; count?: number }> }) {
  const path = usePathname();
  return (
    <nav aria-label="Account" className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-none -mx-4 px-4 lg:mx-0 lg:px-0 border-b lg:border-b-0 border-line">
      {tabs.map((t) => {
        const active = path === t.href || path.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={cx("shrink-0 flex items-center justify-between gap-3 text-sm h-10 px-3 lg:rounded-[var(--radius-sm)] border-b-2 lg:border-b-0 -mb-px lg:mb-0",
              active ? "border-accent text-ink font-medium lg:bg-card lg:shadow-[inset_2px_0_0_var(--color-accent)]" : "border-transparent text-ink-2 hover:text-ink lg:hover:bg-paper-2")}>
            {t.label}
            {t.count ? <span className={cx("num text-[11px] min-w-5 h-5 px-1.5 grid place-items-center rounded-full", active ? "bg-accent text-white" : "bg-paper-2 text-muted")}>{t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
