import Link from "next/link";
import { db } from "@/lib/db";
import { Logo } from "./logo";

/** Footer with city and locality link directories for SEO (PRD H5). */
export async function Footer() {
  const cities = await db.prepare("SELECT id, slug, name FROM cities ORDER BY sort").all() as Array<{ id: number; slug: string; name: string }>;
  const locs = await db.prepare("SELECT l.slug, l.name, c.slug AS city_slug, l.city_id FROM localities l JOIN cities c ON c.id = l.city_id ORDER BY l.trending DESC, l.name").all() as Array<{ slug: string; name: string; city_slug: string; city_id: number }>;
  return (
    <footer className="mt-24 border-t border-line bg-paper-2/60">
      <div className="mx-auto max-w-[1240px] px-4 md:px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-ink-2 max-w-xs leading-relaxed">
              Verified homes, honest prices, and a straight line from search to site visit. Free for seekers, always.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-ink-2 max-w-xs">
              <Link href="/about" className="hover:text-ink">About</Link>
              <Link href="/plans" className="hover:text-ink">Plans & pricing</Link>
              <Link href="/post-property" className="hover:text-ink">Post property</Link>
              <Link href="/requirement" className="hover:text-ink">Post a requirement</Link>
              <Link href="/news" className="hover:text-ink">News & guides</Link>
              <Link href="/tools" className="hover:text-ink">Calculators</Link>
              <Link href="/posting-policy" className="hover:text-ink">Posting policy</Link>
              <Link href="/terms" className="hover:text-ink">Terms</Link>
              <Link href="/privacy" className="hover:text-ink">Privacy</Link>
              <Link href="/report" className="hover:text-ink">Report fraud</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            {cities.map((c) => (
              <div key={c.slug}>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-2.5">
                  <Link href={`/property-in-${c.slug}`} className="hover:text-ink">Property in {c.name}</Link>
                </h3>
                <ul className="space-y-1.5 text-[13px] text-ink-2">
                  <li><Link className="hover:text-ink" href={`/search?city=${c.slug}&tx=sell&type=apartment`}>Flats for sale in {c.name}</Link></li>
                  <li><Link className="hover:text-ink" href={`/search?city=${c.slug}&tx=rent`}>Houses for rent in {c.name}</Link></li>
                  {locs.filter((l) => l.city_id === c.id).slice(0, 4).map((l) => (
                    <li key={l.slug}><Link className="hover:text-ink" href={`/localities/${c.slug}/${l.slug}`}>Flats in {l.name}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-line flex flex-col sm:flex-row gap-2 justify-between text-xs text-muted">
          <span>© {new Date().getFullYear()} 10cent Realty Technologies Pvt. Ltd. Listings are posted by owners, agents and builders; verify details before you pay anything.</span>
          <span>Made in India</span>
        </div>
      </div>
    </footer>
  );
}
