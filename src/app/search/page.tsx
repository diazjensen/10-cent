import type { Metadata } from "next";
import Link from "next/link";
import { List, Map as MapIcon, SearchX, X } from "lucide-react";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCities, getCity, getLocalities, recordImpressions, searchListings, type ListingCard as Card } from "@/lib/listings";
import { formatINR } from "@/lib/format";
import { priceLabel } from "@/components/listing-card";
import { activeBanner, shortlistIds } from "@/lib/seeker/detail";
import {
  FILTER_KEYS, describeSearch, filterChips, flattenParams, parseLandmarks, removeChip, toQuery, type SearchParamsObj,
} from "@/lib/seeker/search-params";
import { Container, EmptyState, Pagination, btnClass, cx } from "@/components/ui";
import { FilterPanel, MobileFilters, type NearOption } from "@/components/search/filters";
import { SearchBar, SortSelect } from "@/components/search/toolbar";
import { SaveSearch } from "@/components/search/save-search";
import { RecentPanel, RecordRecentSearch } from "@/components/search/recent";
import { ResultCard } from "@/components/search/result-card";
import { SearchMap } from "@/components/search/map-view";
import { CompareTray } from "@/components/property/compare-ui";

const NEAR_KINDS = ["metro", "school", "hospital"];

async function context(p: SearchParamsObj) {
  const city = p.city ? await getCity(p.city) : undefined;
  const locIds = (p.loc || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 2e9);
  const locRows = locIds.length
    ? (await db.prepare(`SELECT id, name, landmarks, city_id FROM localities WHERE id IN (${locIds.map(() => "?").join(",")})`).all(...locIds) as Array<{ id: number; name: string; landmarks: string | null; city_id: number }>)
    : [];
  return { city, locRows };
}

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const p = flattenParams(await searchParams);
  const { city, locRows } = await context(p);
  const heading = describeSearch(p, { city: city?.name, localities: locRows.map((l) => l.name) });
  const canonical = toQuery(p, ["page", "view", "sort", "bounds", "near", "nearname"]);
  return {
    title: heading,
    description: `${heading}. Browse verified listings with photos, prices and RERA details on 10cent. Contact owners and agents directly.`,
    alternates: { canonical: `/search${canonical ? `?${canonical}` : ""}` },
    robots: p.bounds || p.near || (p.page && p.page !== "1") ? { index: false, follow: true } : undefined,
  };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = await searchParams;
  const p = flattenParams(raw);
  const user = await getUser();
  const { city, locRows } = await context(p);
  const view = p.view === "map" ? "map" : "list";

  const res = await searchListings(p);
  await recordImpressions(res.rows.map((r) => r.id));
  const pins = view === "map" ? (await searchListings({ ...p, page: "1" }, { all: true })).rows.filter((r) => r.lat != null && r.lng != null) : [];
  const saved = await shortlistIds(user?.id);

  const banner = await activeBanner("search_inline");
  if (banner) await db.prepare("UPDATE banners SET impressions = impressions + 1 WHERE id = ?").run(banner.id);

  const cities = (await getCities()).map((c) => ({ slug: c.slug, name: c.name }));
  const localities = city ? (await getLocalities(city.id)).map((l) => ({ id: l.id, name: l.name })) : [];

  // Nearby search options: landmarks of the selected localities, or of every locality in the city.
  const lmSource = locRows.length
    ? locRows
    : city
      ? (await db.prepare("SELECT id, name, landmarks, city_id FROM localities WHERE city_id = ? ORDER BY name").all(city.id) as typeof locRows)
      : [];
  const seenLm = new Set<string>();
  const nearOptions: NearOption[] = lmSource.flatMap((l) =>
    parseLandmarks(l.landmarks).filter((m) => NEAR_KINDS.includes(m.kind)).map((m) => ({ ...m, locality: l.name }))
  ).filter((o) => (seenLm.has(`${o.lat},${o.lng}`) ? false : (seenLm.add(`${o.lat},${o.lng}`), true)));

  const locNames = Object.fromEntries(locRows.map((l) => [String(l.id), l.name]));
  const heading = describeSearch(p, { city: city?.name, localities: locRows.map((l) => l.name) });
  const chips = filterChips(p, { city: city?.name, localities: locNames });
  const hasFilters = FILTER_KEYS.some((k) => p[k]);
  const activeCount = chips.filter((c) => c.key !== "city").length;
  const query = toQuery(p, ["page", "view"]);
  const href = (next: SearchParamsObj) => {
    const q = toQuery(next);
    return q ? `/search?${q}` : "/search";
  };
  const filterProps = { params: p, cities, localities, nearOptions };
  const mapCenter: [number, number] = city ? [city.lat, city.lng] : [20.6, 78.9];

  const cards = res.rows.map((l: Card) => <ResultCard key={l.id} l={l} saved={saved.has(l.id)} />);
  if (banner && cards.length > 6) {
    cards.splice(6, 0,
      <Link key="banner" href={`/api/banner/${banner.id}`} className="sm:col-span-2 xl:col-span-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 bg-ink text-white rounded-[var(--radius-md)] px-5 py-4 group">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">Sponsored</span>
        <span className="font-display text-2xl">{banner.title}</span>
        <span className="text-sm text-white/70 sm:flex-1">{banner.subtitle}</span>
        <span className="text-sm font-medium text-accent-soft group-hover:underline underline-offset-4">View project</span>
      </Link>
    );
  }

  return (
    <>
      <RecordRecentSearch q={hasFilters ? query : ""} label={heading} />
      <div className="border-b border-line bg-paper">
        <Container className="py-3 flex items-center gap-2">
          <SearchBar key={`${p.q}-${p.city}`} params={p} />
          <div className="lg:hidden"><MobileFilters key={query} {...filterProps} activeCount={activeCount} /></div>
        </Container>
      </div>
      <Container className="pt-5 pb-28">
        <div className="grid lg:grid-cols-[272px_minmax(0,1fr)] gap-8">
          <aside className="hidden lg:block" aria-label="Filters">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 -mr-2 pb-6 scrollbar-thin">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">Filters</span>
                {activeCount > 0 && <Link href={href({ city: p.city, tx: p.tx, cat: p.cat, view: p.view })} className="text-xs text-muted hover:text-ink underline-offset-2 hover:underline">Clear all</Link>}
              </div>
              <FilterPanel key={query} {...filterProps} autoApply />
            </div>
          </aside>

          <div className="min-w-0">
            <h1 className="font-display text-[30px] md:text-[40px] leading-[1.05] max-w-[28ch]">{heading}</h1>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted num" aria-live="polite">
                {res.total === 0 ? "No properties match" : `${formatINR(res.total)} ${res.total === 1 ? "property" : "properties"}`}
                {res.pages > 1 && ` · page ${res.page} of ${res.pages}`}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <SortSelect params={p} />
                <div className="inline-flex p-0.5 bg-paper-2 rounded-[var(--radius-sm)] border border-line" role="group" aria-label="View">
                  <Link href={href({ ...p, view: undefined })} aria-current={view === "list" ? "page" : undefined} className={cx("inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-xs)] text-[13px]", view === "list" ? "bg-card shadow-sm font-medium" : "text-ink-2")}><List size={14} aria-hidden /> List</Link>
                  <Link href={href({ ...p, view: "map", page: undefined })} aria-current={view === "map" ? "page" : undefined} className={cx("inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-xs)] text-[13px]", view === "map" ? "bg-card shadow-sm font-medium" : "text-ink-2")}><MapIcon size={14} aria-hidden /> Map</Link>
                </div>
                <SaveSearch query={query} defaultName={heading} signedIn={!!user} autoOpen={raw.save === "1"} hasEmail={!!user?.email} />
              </div>
            </div>

            {chips.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 mt-4" aria-label="Applied filters">
                {chips.map((c) => (
                  <li key={`${c.key}-${c.value ?? ""}`}>
                    <Link href={href(removeChip(p, c))} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full bg-card border border-line-2 text-[12.5px] hover:border-ink" aria-label={`Remove filter ${c.label}`}>
                      {c.label} <X size={13} className="text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
                {chips.length > 1 && (
                  <li><Link href={href({ view: p.view })} className="inline-flex items-center h-7 px-2 text-[12.5px] text-muted hover:text-ink underline underline-offset-2">Clear all</Link></li>
                )}
              </ul>
            )}

            <div className="mt-5">
              {!hasFilters && <RecentPanel />}

              {view === "map" && (
                <div className="h-[62vh] min-h-[380px] md:h-[560px] rounded-[var(--radius-md)] overflow-hidden border border-line mb-6 isolate">
                  <SearchMap
                    key={`${p.bounds}-${p.near}-${query}`}
                    params={p}
                    center={mapCenter}
                    total={res.total}
                    pins={pins.map((r) => ({ id: r.id, lat: r.lat!, lng: r.lng!, price: r.price, label: priceLabel(r).replace(" Lac", " L"), title: r.title, place: [r.locality_name, r.city_name].filter(Boolean).join(", "), cover: r.cover_url }))}
                  />
                </div>
              )}

              {res.total === 0 ? (
                <>
                  <EmptyState
                    icon={<SearchX size={18} aria-hidden />}
                    title="No properties match all of these filters"
                    body={chips.length ? "Try removing a filter, widening the budget, or searching the whole city." : "Try another city or locality."}
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        {chips.slice(-3).reverse().map((c) => (
                          <Link key={`${c.key}-${c.value}`} href={href(removeChip(p, c))} className={btnClass("secondary", "sm")}>Remove “{c.label}”</Link>
                        ))}
                        {p.city && <Link href={`/search?city=${p.city}${p.tx ? `&tx=${p.tx}` : ""}`} className={btnClass("primary", "sm")}>All in {city?.name}</Link>}
                      </div>
                    }
                  />
                  {hasFilters && <div className="mt-8"><RecentPanel /></div>}
                </>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{cards}</div>
              )}

              <Pagination page={res.page} pages={res.pages} hrefFor={(n) => href({ ...p, page: n > 1 ? String(n) : undefined })} />
            </div>
          </div>
        </div>
      </Container>
      <CompareTray />
    </>
  );
}
