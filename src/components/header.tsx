import Link from "next/link";
import { cookies } from "next/headers";
import { Bell, Plus } from "lucide-react";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCities } from "@/lib/listings";
import { Logo } from "./logo";
import { CityPicker, UserMenu, MobileNav } from "./header-client";
import { btnClass } from "./ui";

export const NAV = [
  { href: "/search?tx=sell", label: "Buy" },
  { href: "/search?tx=rent", label: "Rent" },
  { href: "/post-property", label: "Sell" },
  { href: "/projects", label: "Projects" },
  { href: "/tools", label: "Tools" },
  { href: "/news", label: "News & Guides" },
];

export async function Header() {
  const [user, jar] = await Promise.all([getUser(), cookies()]);
  const cities = getCities().map((c) => ({ slug: c.slug, name: c.name, lat: c.lat, lng: c.lng }));
  const citySlug = jar.get("tc_city")?.value;
  const city = cities.find((c) => c.slug === citySlug) ?? null;
  const unread = user ? (db.prepare("SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read = 0").get(user.id) as { n: number }).n : 0;
  const withCity = (href: string) => (city && href.startsWith("/search") ? `${href}&city=${city.slug}` : href);

  return (
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-[1240px] px-4 md:px-6 h-16 flex items-center gap-2 sm:gap-4 min-w-0">
        <MobileNav nav={NAV.map((n) => ({ ...n, href: withCity(n.href) }))} signedIn={!!user} />
        <Logo />
        <div className="hidden md:block h-6 w-px bg-line-2 mx-1" />
        <CityPicker cities={cities} current={city} />
        <nav aria-label="Main" className="hidden lg:flex items-center gap-1 ml-2">
          {NAV.map((n) => (
            <Link key={n.label} href={withCity(n.href)} className="px-2.5 py-1.5 text-sm text-ink-2 hover:text-ink rounded-[var(--radius-xs)] hover:bg-paper-2">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
          <Link href="/post-property" className={btnClass("secondary", "sm", "hidden sm:inline-flex h-9")}>
            <Plus size={15} aria-hidden /> Post property
            <span className="ml-0.5 text-[10px] font-bold uppercase tracking-wider text-trust bg-trust-soft px-1.5 py-0.5 rounded-full">Free</span>
          </Link>
          {user ? (
            <>
              <Link href="/account/notifications" className="relative w-9 h-9 grid place-items-center rounded-full hover:bg-paper-2" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
                <Bell size={18} />
                {unread > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold grid place-items-center num">{unread > 9 ? "9+" : unread}</span>}
              </Link>
              <UserMenu user={{ name: user.name, phone: user.phone, email: user.email, role: user.role, admin_role: user.admin_role }} />
            </>
          ) : (
            <Link href="/login" className={btnClass("primary", "sm", "h-9")}>Log in</Link>
          )}
        </div>
      </div>
    </header>
  );
}
