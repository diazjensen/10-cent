import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, ArrowUpRight, BadgeCheck, Calculator, Ruler, ShieldCheck, TrendingUp, Landmark, Percent, Scale } from "lucide-react";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { CARD_FROM, CARD_SELECT, type ListingCard as Card } from "@/lib/listings";
import { formatINR, formatPrice } from "@/lib/format";
import { HeroSearch } from "@/components/search-box";
import { ListingCard } from "@/components/listing-card";
import { Container, SectionHeading, btnClass } from "@/components/ui";

export default async function Home() {
  const jar = await cookies();
  const user = await getUser();
  const citySlug = jar.get("tc_city")?.value ?? null;
  const city = citySlug ? (await db.prepare("SELECT id, slug, name FROM cities WHERE slug = ?").get(citySlug) as { id: number; slug: string; name: string } | undefined) : undefined;
  const cityWhere = city ? "AND l.city_id = ?" : "";
  const cityArgs = city ? [city.id] : [];

  const featured = await db.prepare(`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE l.status = 'live' AND (l.featured = 1 OR l.premium = 1) ${cityWhere} ORDER BY l.premium DESC, l.published_at DESC LIMIT 8`).all(...cityArgs) as Card[];
  const fresh = await db.prepare(`SELECT ${CARD_SELECT} ${CARD_FROM} WHERE l.status = 'live' AND l.verified = 1 ${cityWhere} ORDER BY l.published_at DESC LIMIT 4`).all(...cityArgs) as Card[];
  const savedIds = new Set(user ? (await db.prepare("SELECT listing_id FROM shortlists WHERE user_id = ?").all(user.id) as { listing_id: number }[]).map((r) => r.listing_id) : []);

  const trending = await db.prepare(`
    SELECT lo.id, lo.name, lo.slug, c.slug city_slug, c.name city,
      (SELECT avg_price_sqft FROM price_trends t WHERE t.locality_id = lo.id ORDER BY month DESC LIMIT 1) psf,
      (SELECT avg_price_sqft FROM price_trends t WHERE t.locality_id = lo.id ORDER BY month DESC LIMIT 1 OFFSET 12) psf_ly,
      (SELECT COUNT(*) FROM listings l WHERE l.locality_id = lo.id AND l.status = 'live') n
    FROM localities lo JOIN cities c ON c.id = lo.city_id
    WHERE ${city ? "lo.city_id = ?" : "lo.trending = 1"} ORDER BY n DESC LIMIT 8`).all(...cityArgs) as Array<{ id: number; name: string; slug: string; city_slug: string; city: string; psf: number; psf_ly: number; n: number }>;

  const projects = await db.prepare(`
    SELECT p.*, lo.name loc, c.name city, pr.company_name builder,
      (SELECT url FROM project_media m WHERE m.project_id = p.id ORDER BY sort LIMIT 1) cover,
      (SELECT GROUP_CONCAT(DISTINCT bhk) FROM project_unit_types u WHERE u.project_id = p.id) bhks
    FROM projects p JOIN cities c ON c.id = p.city_id LEFT JOIN localities lo ON lo.id = p.locality_id LEFT JOIN profiles pr ON pr.user_id = p.builder_id
    WHERE p.approved = 1 ${city ? "AND p.city_id = ?" : ""} ORDER BY p.featured DESC, p.sponsored DESC, p.created_at DESC LIMIT 3`).all(...cityArgs) as Array<Record<string, string | number | null>>;

  const builders = await db.prepare(`
    SELECT u.id, pr.company_name, pr.established_year, (SELECT COUNT(*) FROM projects p WHERE p.builder_id = u.id) projects
    FROM users u JOIN profiles pr ON pr.user_id = u.id WHERE u.role = 'builder' ORDER BY projects DESC, pr.rating DESC LIMIT 6`).all() as Array<{ id: number; company_name: string; established_year: number; projects: number }>;

  const banner = await db.prepare(`SELECT * FROM banners WHERE placement = 'home_top' AND active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?) ORDER BY id DESC LIMIT 1`).get(new Date().toISOString(), new Date().toISOString()) as { id: number; title: string; subtitle: string; link: string } | undefined;
  if (banner) await db.prepare("UPDATE banners SET impressions = impressions + 1 WHERE id = ?").run(banner.id);

  const articles = await db.prepare("SELECT slug, title, category, excerpt, cover_url, published_at FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 3").all() as Array<{ slug: string; title: string; category: string; excerpt: string; cover_url: string; published_at: string }>;
  const stats = await db.prepare("SELECT COUNT(*) live, COALESCE(SUM(verified), 0) verified, COUNT(DISTINCT city_id) cities FROM listings WHERE status = 'live'").get() as { live: number; verified: number; cities: number };
  const ownerCount = (await db.prepare("SELECT COUNT(*) n FROM listings WHERE status = 'live' AND posted_by_type = 'owner'").get() as { n: number }).n;

  return (
    <>
      {/* Hero */}
      <section className="relative border-b border-line overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.5] [background-image:linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" aria-hidden />
        <Container className="relative pt-12 pb-14 md:pt-20 md:pb-20">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              {city ? `Homes in ${city.name}` : "Property across India"} · <span className="num">{formatINR(stats.live)}</span> live listings
            </p>
            <h1 className="font-display text-[44px] leading-[0.98] md:text-[76px] mt-4 tracking-[-0.02em]">
              Homes, honestly listed. <em className="text-accent">Visited</em> before they&apos;re verified.
            </h1>
            <p className="mt-5 text-ink-2 text-base md:text-lg max-w-xl leading-relaxed">
              Search flats, houses, plots, PGs and offices with real photos, RERA numbers and price history. Talk to owners directly. Pay nothing.
            </p>
          </div>
          <div className="mt-9 max-w-4xl">
            <HeroSearch city={city?.slug ?? null} />
          </div>
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 text-sm">
            <div className="flex items-center gap-2"><BadgeCheck size={16} className="text-trust" aria-hidden /><dt className="text-muted">Verified on site</dt><dd className="num font-semibold">{formatINR(stats.verified)}</dd></div>
            <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-ink-2" aria-hidden /><dt className="text-muted">Direct from owners</dt><dd className="num font-semibold">{formatINR(ownerCount)}</dd></div>
            <div className="flex items-center gap-2"><Landmark size={16} className="text-ink-2" aria-hidden /><dt className="text-muted">Cities</dt><dd className="num font-semibold">{stats.cities}</dd></div>
          </dl>
        </Container>
      </section>

      {banner && (
        <Container className="mt-10">
          <Link href={`/api/banner/${banner.id}`} className="group flex flex-col md:flex-row md:items-center gap-3 md:gap-6 bg-ink text-white rounded-[var(--radius-md)] px-5 py-4 md:px-7 md:py-5">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Sponsored</span>
            <span className="font-display text-2xl md:text-3xl">{banner.title}</span>
            <span className="text-sm text-white/70 md:flex-1">{banner.subtitle}</span>
            <span className="inline-flex items-center gap-1 text-sm font-medium group-hover:gap-2 transition-all">View project <ArrowRight size={15} /></span>
          </Link>
        </Container>
      )}

      {/* Featured */}
      {featured.length > 0 && (
        <Container className="mt-16">
          <SectionHeading eyebrow="Featured & premium" title={<>Hand-picked {city ? <>in {city.name}</> : "this week"}</>} action={<Link href={`/search?${city ? `city=${city.slug}&` : ""}sort=relevance`} className="text-sm font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">See all <ArrowRight size={15} /></Link>} />
          <div className="flex gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 pb-2">
            {featured.map((l) => (
              <div key={l.id} className="snap-start shrink-0 w-[78%] sm:w-[46%] lg:w-[calc(25%-12px)]">
                <ListingCard l={l} saved={savedIds.has(l.id)} />
              </div>
            ))}
          </div>
        </Container>
      )}

      {/* Trending localities */}
      <Container className="mt-20">
        <SectionHeading eyebrow="Trending localities" title="Where people are looking" action={<Link href="/tools/price-trends" className="text-sm font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">Price trends <ArrowRight size={15} /></Link>} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-line">
          {trending.map((t) => {
            const yoy = t.psf_ly ? ((t.psf - t.psf_ly) / t.psf_ly) * 100 : 0;
            return (
              <Link key={t.id} href={`/localities/${t.city_slug}/${t.slug}`} className="group border-r border-b border-line p-5 bg-card hover:bg-paper-2 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted">{t.city}</div>
                  </div>
                  <ArrowUpRight size={16} className="text-muted group-hover:text-ink" aria-hidden />
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <div className="num text-xl font-semibold tracking-tight">₹{formatINR(t.psf)}</div>
                    <div className="text-[11px] text-muted">avg per sq ft</div>
                  </div>
                  <div className="text-right">
                    <div className={`num text-sm font-semibold ${yoy >= 0 ? "text-trust" : "text-danger"}`}>{yoy >= 0 ? "+" : ""}{yoy.toFixed(1)}%</div>
                    <div className="text-[11px] text-muted">vs last year · {t.n} live</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Container>

      {/* New projects */}
      <section className="mt-20 bg-paper-2/70 border-y border-line py-16">
        <Container>
          <SectionHeading eyebrow="New projects" title="RERA-registered launches" action={<Link href={`/projects${city ? `?city=${city.slug}` : ""}`} className="text-sm font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">All projects <ArrowRight size={15} /></Link>} />
          <div className="grid md:grid-cols-3 gap-5">
            {projects.map((p) => (
              <Link key={String(p.id)} href={`/projects/${p.slug}`} className="group bg-card border border-line rounded-[var(--radius-md)] overflow-hidden hover:shadow-[var(--shadow-pop)] transition-shadow">
                <div className="aspect-[16/10] overflow-hidden bg-paper-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={String(p.cover)} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold">
                    <span className={p.status === "ready" ? "text-trust" : p.status === "new_launch" ? "text-accent-ink" : "text-warn"}>
                      {p.status === "ready" ? "Ready to move" : p.status === "new_launch" ? "New launch" : "Under construction"}
                    </span>
                    {p.featured ? <span className="text-muted">Featured</span> : null}
                  </div>
                  <h3 className="font-display text-2xl mt-1.5">{p.name}</h3>
                  <p className="text-xs text-muted">by {p.builder} · {p.loc}, {p.city}</p>
                  <div className="mt-3 flex items-end justify-between">
                    <div className="num font-semibold">{formatPrice(Number(p.price_min))} – {formatPrice(Number(p.price_max))}</div>
                    <div className="text-xs text-ink-2">{String(p.bhks ?? "").split(",").sort().join(", ")} BHK</div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-line text-[11px] text-muted truncate"><ShieldCheck size={12} className="inline -mt-0.5 mr-1" aria-hidden />RERA {p.rera_id}</div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-12">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-4">Popular builders</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {builders.map((b) => (
                <Link key={b.id} href={`/builders/${b.id}`} className="bg-card border border-line rounded-[var(--radius-sm)] p-3.5 hover:border-ink transition-colors">
                  <div className="w-9 h-9 rounded-full bg-ink text-white grid place-items-center font-display text-lg">{b.company_name[0]}</div>
                  <div className="mt-2.5 text-sm font-medium leading-tight">{b.company_name}</div>
                  <div className="text-[11px] text-muted mt-0.5">Since {b.established_year} · {b.projects} project{b.projects === 1 ? "" : "s"}</div>
                </Link>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* Fresh verified */}
      {fresh.length > 0 && (
        <Container className="mt-20">
          <SectionHeading eyebrow="Just verified" title="Our field team visited these" action={<Link href={`/search?${city ? `city=${city.slug}&` : ""}verified=1&sort=newest`} className="text-sm font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">More verified <ArrowRight size={15} /></Link>} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {fresh.map((l) => <ListingCard key={l.id} l={l} saved={savedIds.has(l.id)} />)}
          </div>
        </Container>
      )}

      {/* Tools */}
      <Container className="mt-20">
        <SectionHeading eyebrow="Tools" title="Do the maths before the visit" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { href: "/tools/emi", icon: Calculator, t: "EMI calculator", d: "With amortisation and prepayment" },
            { href: "/tools/eligibility", icon: Percent, t: "Loan eligibility", d: "How much can you borrow?" },
            { href: "/tools/stamp-duty", icon: Scale, t: "Stamp duty", d: "By state, for men and women" },
            { href: "/tools/area-converter", icon: Ruler, t: "Area converter", d: "Sq ft, gaj, cent, bigha…" },
            { href: "/tools/price-trends", icon: TrendingUp, t: "Price trends", d: "36 months, by locality" },
          ].map(({ href, icon: Icon, t, d }) => (
            <Link key={href} href={href} className="group bg-card border border-line rounded-[var(--radius-md)] p-4 hover:border-ink transition-colors">
              <Icon size={20} className="text-accent" aria-hidden />
              <div className="mt-6 font-medium">{t}</div>
              <div className="text-xs text-muted mt-0.5">{d}</div>
            </Link>
          ))}
        </div>
      </Container>

      {/* Owner CTA */}
      <Container className="mt-20">
        <div className="grid md:grid-cols-[1.3fr_1fr] gap-8 items-center bg-card border border-line rounded-[var(--radius-lg)] p-7 md:p-12">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-trust">For owners</p>
            <h2 className="font-display text-4xl md:text-5xl leading-[1] mt-3">List your home free.<br />Meet genuine buyers.</h2>
            <p className="mt-4 text-ink-2 max-w-md">Post up to 3 properties at no cost. Every enquiry lands in your dashboard and by SMS, from people who signed in with a verified phone number.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/post-property" className={btnClass("accent", "lg")}>Post property, free</Link>
              <Link href="/plans" className={btnClass("secondary", "lg")}>See paid plans</Link>
            </div>
          </div>
          <ol className="space-y-5">
            {["Add details and photos in about 5 minutes", "We check it and publish within 24 hours", "Reply to enquiries from your dashboard"].map((s, i) => (
              <li key={s} className="flex gap-4 items-baseline">
                <span className="font-display text-4xl text-accent leading-none w-8">{i + 1}</span>
                <span className="text-ink-2">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </Container>

      {/* News */}
      <Container className="mt-20">
        <SectionHeading eyebrow="News & guides" title="Read before you sign" action={<Link href="/news" className="text-sm font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">All articles <ArrowRight size={15} /></Link>} />
        <div className="grid md:grid-cols-3 gap-6">
          {articles.map((a) => (
            <Link key={a.slug} href={`/news/${a.slug}`} className="group">
              <div className="aspect-[16/9] rounded-[var(--radius-md)] overflow-hidden bg-paper-2 border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.cover_url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-wider font-semibold text-accent-ink">{a.category.replace("-", " ")}</div>
              <h3 className="font-display text-2xl leading-tight mt-1 group-hover:underline underline-offset-4 decoration-1">{a.title}</h3>
              <p className="text-sm text-muted mt-1.5 line-clamp-2">{a.excerpt}</p>
            </Link>
          ))}
        </div>
      </Container>
    </>
  );
}
