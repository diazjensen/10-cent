"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LocateFixed, MapPin, Menu, X } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { cx } from "./ui";

type City = { slug: string; name: string; lat: number; lng: number };

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onOut(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [ref, onOut]);
}

export function setCityCookie(slug: string) {
  document.cookie = `tc_city=${slug}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** City selector with "detect my location" (PRD H2). */
export function CityPicker({ cities, current }: { cities: City[]; current: City | null }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useOutside(ref, () => setOpen(false));

  const choose = (slug: string) => {
    setCityCookie(slug);
    setOpen(false);
    router.refresh();
  };

  const detect = () => {
    if (!navigator.geolocation) { setStatus("Location is not available in this browser."); return; }
    setStatus("Detecting…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let best = cities[0], bestD = Infinity;
        for (const c of cities) {
          const d = (c.lat - latitude) ** 2 + (c.lng - longitude) ** 2;
          if (d < bestD) { bestD = d; best = c; }
        }
        if (bestD > 4) { setStatus("We're not in your city yet. Pick one below."); return; }
        setStatus(null);
        choose(best.slug);
      },
      () => setStatus("Location permission was denied."),
      { timeout: 8000 }
    );
  };

  return (
    <div ref={ref} className="relative hidden md:block">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" className="flex items-center gap-1.5 text-sm font-medium h-9 px-2 rounded-[var(--radius-xs)] hover:bg-paper-2">
        <MapPin size={15} className="text-accent" aria-hidden />
        {current?.name ?? "All cities"}
        <ChevronDown size={14} className="text-muted" aria-hidden />
      </button>
      {open && (
        <div role="dialog" aria-label="Choose city" className="absolute left-0 top-11 w-72 bg-card border border-line rounded-[var(--radius-md)] shadow-[var(--shadow-pop)] p-2">
          <button type="button" onClick={detect} className="w-full flex items-center gap-2 px-2.5 py-2 text-sm text-accent-ink font-medium hover:bg-paper-2 rounded-[var(--radius-xs)]">
            <LocateFixed size={15} /> Detect my location
          </button>
          {status && <p className="px-2.5 pb-1 text-xs text-muted">{status}</p>}
          <div className="px-2.5 pt-2 pb-1 text-[11px] uppercase tracking-wider text-muted font-semibold">Popular cities</div>
          <ul className="grid grid-cols-2">
            {cities.map((c) => (
              <li key={c.slug}>
                <button type="button" onClick={() => choose(c.slug)} className={cx("w-full text-left px-2.5 py-2 text-sm rounded-[var(--radius-xs)] hover:bg-paper-2", current?.slug === c.slug && "font-semibold")}>
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => { document.cookie = "tc_city=; path=/; max-age=0"; setOpen(false); router.refresh(); }} className="w-full text-left px-2.5 py-2 text-xs text-muted hover:text-ink">
            Show all cities
          </button>
        </div>
      )}
    </div>
  );
}

type MiniUser = { name: string | null; phone: string | null; email: string | null; role: string; admin_role: string | null };

export function UserMenu({ user }: { user: MiniUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const initials = (user.name || user.phone || user.email || "U").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const supply = ["owner", "agent", "builder"].includes(user.role);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Account menu" className="w-9 h-9 rounded-full bg-ink text-white text-xs font-semibold grid place-items-center">
        {initials}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 w-60 bg-card border border-line rounded-[var(--radius-md)] shadow-[var(--shadow-pop)] py-1.5 text-sm">
          <div className="px-3.5 py-2 border-b border-line mb-1">
            <div className="font-medium truncate">{user.name || "Your account"}</div>
            <div className="text-xs text-muted truncate">{user.phone ? `+91 ${user.phone}` : user.email}</div>
            <div className="text-[11px] mt-1 uppercase tracking-wider text-muted font-semibold">{user.role === "admin" ? `Admin · ${user.admin_role}` : user.role}</div>
          </div>
          {user.role === "admin" && <MenuLink href="/admin" onClick={() => setOpen(false)}>Admin panel</MenuLink>}
          {(supply || user.role === "admin") && <MenuLink href="/dashboard" onClick={() => setOpen(false)}>Dashboard</MenuLink>}
          {supply && <MenuLink href="/dashboard/responses" onClick={() => setOpen(false)}>Responses</MenuLink>}
          <MenuLink href="/account/shortlist" onClick={() => setOpen(false)}>Shortlisted</MenuLink>
          <MenuLink href="/account/contacted" onClick={() => setOpen(false)}>Contacted</MenuLink>
          <MenuLink href="/account/searches" onClick={() => setOpen(false)}>Saved searches</MenuLink>
          <MenuLink href="/account/profile" onClick={() => setOpen(false)}>Profile & settings</MenuLink>
          <form action={logoutAction} className="border-t border-line mt-1 pt-1">
            <button type="submit" role="menuitem" className="w-full text-left px-3.5 py-2 hover:bg-paper-2 text-ink-2">Log out</button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link role="menuitem" href={href} onClick={onClick} className="block px-3.5 py-2 hover:bg-paper-2">
      {children}
    </Link>
  );
}

export function MobileNav({ nav, signedIn }: { nav: Array<{ href: string; label: string }>; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  return (
    <>
      <button type="button" className="lg:hidden -ml-1 w-9 h-9 grid place-items-center rounded-[var(--radius-xs)] hover:bg-paper-2" aria-label="Open menu" onClick={() => setOpen(true)}>
        <Menu size={20} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[82%] max-w-xs bg-paper p-5 flex flex-col gap-1 overflow-y-auto">
            <button type="button" className="self-end w-9 h-9 grid place-items-center" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20} /></button>
            {nav.map((n) => (
              <Link key={n.label} href={n.href} onClick={() => setOpen(false)} className="py-3 text-lg font-display border-b border-line">{n.label}</Link>
            ))}
            <Link href="/post-property" onClick={() => setOpen(false)} className="py-3 text-lg font-display border-b border-line">Post property <span className="text-xs font-sans font-bold text-trust">FREE</span></Link>
            {signedIn ? (
              <>
                <Link href="/account/shortlist" onClick={() => setOpen(false)} className="py-3 text-ink-2">Shortlisted</Link>
                <Link href="/dashboard" onClick={() => setOpen(false)} className="py-3 text-ink-2">Dashboard</Link>
                <Link href="/account/profile" onClick={() => setOpen(false)} className="py-3 text-ink-2">Account</Link>
              </>
            ) : (
              <Link href="/login" onClick={() => setOpen(false)} className="mt-4 h-11 grid place-items-center bg-ink text-white rounded-[var(--radius-sm)] font-medium">Log in</Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
