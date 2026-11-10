import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { BadgeCheck, Building2, CalendarDays, Eye, MapPin, ShieldCheck, ShieldAlert, Star, UserRound } from "lucide-react";
import { getUser, can } from "@/lib/auth";
import { AMENITY_LABEL, FURNISHING_LABEL, LISTING_STATUS_LABEL, PROPERTY_TYPE_LABEL, RERA_PORTALS, TENANT_TYPES } from "@/lib/constants";
import { formatArea, formatDate, formatINR, formatPrice, listingHeadline, pricePerSqft, timeAgo } from "@/lib/format";
import { getAmenities, getListingDetail, getMedia, getPriceTrend, getSimilar, shortlistIds, trackView, type ListingDetail } from "@/lib/seeker/detail";
import { distanceKm, LANDMARK_KIND_LABEL, parseLandmarks } from "@/lib/seeker/search-params";
import { Badge, Breadcrumbs, Card, Container, LineChart, Notice, cx } from "@/components/ui";
import { ListingCard } from "@/components/listing-card";
import { ShortlistButton } from "@/components/shortlist-button";
import { Gallery } from "@/components/property/gallery";
import { ContactPanel } from "@/components/property/contact-panel";
import { EmiCalculator } from "@/components/property/emi";
import { ReportListing, ShareButtons } from "@/components/property/share-report";
import { CompareToggle, CompareTray, TrackRecentView } from "@/components/property/compare-ui";
import { LocationMap } from "@/components/property/location-map";

const NON_RESI = ["plot", "office", "shop", "warehouse", "pg"];

function priceText(l: Pick<ListingDetail, "price" | "transaction_type">) {
  return l.transaction_type === "sell" ? formatPrice(l.price) : `₹${formatINR(l.price)}`;
}
function mainArea(l: ListingDetail) {
  return l.carpet_area ?? l.super_area ?? l.builtup_area ?? l.plot_area;
}

export async function generateMetadata({ params }: PageProps<"/property/[id]">): Promise<Metadata> {
  const { id } = await params;
  const l = getListingDetail(Number(id));
  if (!l) return { title: "Property not found" };
  const head = listingHeadline(l);
  const price = l.transaction_type === "sell" ? formatPrice(l.price) : `₹${formatINR(l.price)}/month`;
  const cover = getMedia(l.id).find((m) => m.kind === "photo")?.url;
  const description = `${head}, ${l.city_name}. ${price}${mainArea(l) ? `, ${formatArea(mainArea(l))}` : ""}. Posted by ${l.posted_by_type}${l.verified ? ", verified by 10cent" : ""}. ${(l.description ?? "").slice(0, 120)}`;
  return {
    title: `${head} · ${price}`,
    description,
    alternates: { canonical: `/property/${l.id}` },
    robots: l.status === "live" ? undefined : { index: false, follow: false },
    openGraph: { title: `${head} · ${price}`, description, url: `/property/${l.id}`, images: cover ? [{ url: cover }] : undefined },
  };
}

export default async function PropertyPage({ params, searchParams }: PageProps<"/property/[id]">) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, getUser()]);
  const l = getListingDetail(Number(id));
  if (!l) notFound();
  const isOwner = !!user && user.id === l.user_id;
  const isStaff = can(user, "moderation");
  if (l.status !== "live" && !isOwner && !isStaff) notFound();
  if (l.status === "live" && !isOwner) trackView(l.id, user?.id ?? null);

  const media = getMedia(l.id);
  const amenities = getAmenities(l.id);
  const trend = getPriceTrend(l.locality_id);
  const similar = l.status === "live" ? getSimilar(l) : [];
  const saved = shortlistIds(user?.id);
  const landmarks = parseLandmarks(l.landmarks);
  const near = l.lat != null && l.lng != null
    ? landmarks.map((m) => ({ ...m, km: distanceKm({ lat: l.lat!, lng: l.lng! }, m) })).sort((a, b) => a.km - b.km)
    : [];

  const h = await headers();
  const origin = process.env.SITE_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const url = `${origin}/property/${l.id}`;
  const head = listingHeadline(l);
  const area = mainArea(l);
  const psf = l.transaction_type === "sell" ? pricePerSqft(l.price, area) : null;
  const cover = media.find((m) => m.kind === "photo")?.url ?? null;
  const posterLabel = l.posted_by_type === "owner" ? "owner" : l.posted_by_type === "builder" ? "builder" : "agent";
  const posterDisplay = l.poster_company || l.poster_name || "10cent member";
  const reraState = l.project_rera_state || l.state;
  const reraUrl = RERA_PORTALS[reraState];
  const act = typeof sp.act === "string" && ["contact", "phone", "visit", "callback"].includes(sp.act) ? (sp.act as "contact") : null;
  const resi = !NON_RESI.includes(l.property_type);

  const facts: Array<[string, React.ReactNode]> = [];
  const add = (k: string, v: React.ReactNode | null | undefined | false) => { if (v != null && v !== false && v !== "") facts.push([k, v]); };
  if (l.transaction_type === "sell") {
    add("Price", <>{formatPrice(l.price)}{l.price_negotiable ? <span className="text-muted font-normal"> · negotiable</span> : null}</>);
    add("Price per sq ft", psf ? `₹${formatINR(psf)}` : null);
  } else {
    add(l.transaction_type === "pg" ? "Rent per bed" : "Monthly rent", <>₹{formatINR(l.price)}{l.price_negotiable ? <span className="text-muted font-normal"> · negotiable</span> : null}</>);
    add("Security deposit", l.deposit ? (l.deposit < 100 ? `${l.deposit} month${l.deposit > 1 ? "s" : ""} rent` : `₹${formatINR(l.deposit)}`) : null);
    add("Maintenance", l.maintenance ? `₹${formatINR(l.maintenance)}/month` : l.transaction_type === "rent" ? "Included" : null);
  }
  add("Configuration", resi && l.bhk ? `${l.bhk} BHK${l.bathrooms ? ` · ${l.bathrooms} bath` : ""}${l.balconies ? ` · ${l.balconies} balcony` : ""}` : PROPERTY_TYPE_LABEL[l.property_type]);
  add("Carpet area", l.carpet_area ? formatArea(l.carpet_area) : null);
  add("Built-up area", l.builtup_area ? formatArea(l.builtup_area) : null);
  add("Super built-up area", l.super_area ? formatArea(l.super_area) : null);
  add("Plot area", l.plot_area ? formatArea(l.plot_area) : null);
  add("Floor", l.floor != null ? `${l.floor === 0 ? "Ground" : ordinal(l.floor)}${l.total_floors ? ` of ${l.total_floors}` : ""}` : null);
  add("Facing", l.facing);
  add("Property age", l.age_years != null ? (l.age_years === 0 ? "New construction" : `${l.age_years} year${l.age_years > 1 ? "s" : ""}`) : null);
  add("Furnishing", l.furnishing ? FURNISHING_LABEL[l.furnishing] : null);
  if (l.transaction_type === "sell") {
    add("Status", l.construction_status === "ready" ? "Ready to move" : l.construction_status === "under_construction" ? "Under construction" : null);
    add("Possession", l.possession_date ? formatDate(l.possession_date, { month: "short", year: "numeric" }) : null);
    add("New launch", l.new_launch ? "Yes" : null);
  } else {
    add("Available from", l.available_from ? (new Date(l.available_from) <= new Date() ? "Immediately" : formatDate(l.available_from)) : "Immediately");
    add(l.transaction_type === "pg" ? "For" : "Preferred tenants", l.tenant_types ? l.tenant_types.split(",").map((t) => TENANT_TYPES.find((x) => x.value === t)?.label ?? t).join(", ") : "Anyone");
  }
  if (l.transaction_type === "pg") {
    add("Sharing", l.pg_sharing ? l.pg_sharing.split(",").map((s) => s[0].toUpperCase() + s.slice(1)).join(", ") : null);
    add("Meals", l.pg_meals ? "Included" : "Not included");
  }
  add("Project", l.project_name ? (l.project_slug ? <Link className="underline underline-offset-2" href={`/projects/${l.project_slug}`}>{l.project_name}</Link> : l.project_name) : null);

  const trendPts = trend.slice(-24).map((t) => ({
    x: new Date(`${t.month}-01`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    y: l.transaction_type === "sell" ? t.avg_price_sqft : t.avg_rent_2bhk,
  }));
  const tLast = trendPts.at(-1)?.y, tYearAgo = trendPts.at(-13)?.y;
  const yoy = tLast && tYearAgo ? ((tLast - tYearAgo) / tYearAgo) * 100 : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: l.title,
    description: l.description ?? head,
    url,
    datePosted: l.published_at ?? l.created_at,
    image: media.filter((m) => m.kind === "photo").slice(0, 6).map((m) => `${origin}${m.url}`),
    offers: {
      "@type": "Offer",
      price: l.price,
      priceCurrency: "INR",
      availability: l.status === "live" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      businessFunction: l.transaction_type === "sell" ? "https://purl.org/goodrelations/v1#Sell" : "https://purl.org/goodrelations/v1#LeaseOut",
      ...(l.transaction_type !== "sell" ? { priceSpecification: { "@type": "UnitPriceSpecification", price: l.price, priceCurrency: "INR", unitCode: "MON" } } : {}),
    },
    about: {
      "@type": resi ? (l.property_type === "apartment" ? "Apartment" : "SingleFamilyResidence") : "Place",
      ...(l.bhk && resi ? { numberOfRooms: l.bhk, numberOfBedrooms: l.bhk } : {}),
      ...(l.bathrooms ? { numberOfBathroomsTotal: l.bathrooms } : {}),
      ...(area ? { floorSize: { "@type": "QuantitativeValue", value: area, unitCode: "FTK" } } : {}),
      address: { "@type": "PostalAddress", streetAddress: l.address ?? undefined, addressLocality: l.locality_name ?? l.city_name, addressRegion: l.state, addressCountry: "IN" },
      ...(l.lat != null ? { geo: { "@type": "GeoCoordinates", latitude: l.lat, longitude: l.lng } } : {}),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {l.status === "live" && <TrackRecentView item={{ id: l.id, title: l.title, price: l.transaction_type === "sell" ? formatPrice(l.price) : `₹${formatINR(l.price)}/mo`, place: [l.locality_name, l.city_name].filter(Boolean).join(", "), cover }} />}
      <Container className="pt-5 pb-28">
        {l.status !== "live" && (
          <Notice tone="warn" className="mb-4">
            <strong>Preview · {LISTING_STATUS_LABEL[l.status] ?? l.status}.</strong>{" "}
            {isOwner ? "Only you can see this page until the listing is live." : "Staff preview. This listing is not visible to the public."}
            {l.reject_reason ? ` Reason: ${l.reject_reason}` : ""}
            {isOwner && <> <Link href="/dashboard" className="underline underline-offset-2">Go to your listings</Link></>}
          </Notice>
        )}
        <Breadcrumbs items={[
          { label: "Home", href: "/" },
          { label: l.city_name, href: `/property-in-${l.city_slug}` },
          ...(l.locality_name ? [{ label: l.locality_name, href: `/search?city=${l.city_slug}&loc=${l.locality_id}&tx=${l.transaction_type}` }] : []),
          { label: head },
        ]} />

        <header className="mt-3 mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {l.verified ? <Badge tone="trust" icon={<BadgeCheck size={12} aria-hidden />}>Verified</Badge> : null}
              {l.rera_id ? <Badge tone="neutral" icon={<ShieldCheck size={12} aria-hidden />}>RERA</Badge> : null}
              {l.premium ? <Badge tone="ink">Premium</Badge> : l.featured ? <Badge tone="accent">Featured</Badge> : null}
              {l.new_launch ? <Badge tone="accent">New launch</Badge> : null}
              <Badge tone={l.posted_by_type === "owner" ? "trust" : "neutral"}>{l.posted_by_type === "owner" ? "Owner · no brokerage" : `By ${l.posted_by_type}`}</Badge>
            </div>
            <h1 className="font-display text-[32px] md:text-[44px] leading-[1.02] tracking-[-0.01em]">{l.title}</h1>
            <p className="mt-2 text-sm text-ink-2 flex items-start gap-1.5"><MapPin size={15} className="mt-0.5 shrink-0 text-muted" aria-hidden />{[l.address, l.locality_name && !l.address?.includes(l.locality_name) ? l.locality_name : null, !l.address?.includes(l.city_name) ? l.city_name : null].filter(Boolean).join(", ")}</p>
          </div>
          <div className="md:text-right shrink-0">
            <div className="num text-[34px] font-semibold tracking-tight leading-none">
              {priceText(l)}{l.transaction_type !== "sell" && <span className="text-base font-normal text-muted">/month</span>}
            </div>
            <div className="num text-sm text-muted mt-1.5">
              {psf ? `₹${formatINR(psf)}/sq ft · ` : ""}{area ? formatArea(area) : ""}
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          <ShortlistButton listingId={l.id} initial={saved.has(l.id)} variant="full" />
          <CompareToggle variant="button" item={{ id: l.id, title: head, price: l.transaction_type === "sell" ? formatPrice(l.price) : `₹${formatINR(l.price)}/mo`, cover }} />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted num"><Eye size={13} aria-hidden /> {formatINR(l.views)} views · posted {timeAgo(l.published_at ?? l.created_at)}</span>
            <ShareButtons url={url} text={`${head} · ${priceText(l)}${l.transaction_type !== "sell" ? "/month" : ""} on 10cent`} />
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-x-8 gap-y-6">
          <div className="min-w-0 space-y-6">
            <Gallery media={media} title={l.title} />
            <Section title="Key facts">
              <dl className="grid grid-cols-2 sm:grid-cols-3 bg-card border border-line rounded-[var(--radius-md)] overflow-hidden">
                {facts.map(([k, v]) => (
                  <div key={k} className="px-3.5 py-3 -mr-px -mb-px border-r border-b border-line">
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd className="num text-[15px] font-medium mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
              {l.rera_id && (
                <p className="mt-3 text-sm text-ink-2 flex flex-wrap items-center gap-1.5">
                  <ShieldCheck size={15} className="text-trust" aria-hidden /> RERA registration <span className="num font-medium text-ink">{l.rera_id}</span>
                  {reraUrl && <> · <a href={reraUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Verify on {reraState} RERA portal</a></>}
                </p>
              )}
            </Section>
          </div>

          <aside className="lg:row-span-2 lg:col-start-2 lg:row-start-1" aria-label="Contact the poster">
            <div className="lg:sticky lg:top-20 space-y-3">
              <Card id="contact" className="scroll-mt-20">
                <div className="p-4 border-b border-line flex gap-3">
                  <div className="w-11 h-11 shrink-0 rounded-full bg-paper-2 grid place-items-center text-ink-2 overflow-hidden">
                    {l.poster_logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.poster_logo} alt="" className="w-full h-full object-cover" />
                    ) : l.posted_by_type === "owner" ? <UserRound size={20} aria-hidden /> : <Building2 size={20} aria-hidden />}
                  </div>
                  <div className="min-w-0">
                    <div className={cx("text-[10px] font-semibold uppercase tracking-[0.14em]", l.posted_by_type === "owner" ? "text-trust" : l.posted_by_type === "builder" ? "text-accent-ink" : "text-ink-2")}>{l.posted_by_type}</div>
                    <div className="font-medium truncate">
                      {l.posted_by_type === "agent" ? <Link href={`/agents/${l.user_id}`} className="hover:underline underline-offset-2">{posterDisplay}</Link>
                        : l.posted_by_type === "builder" ? <Link href={`/builders/${l.user_id}`} className="hover:underline underline-offset-2">{posterDisplay}</Link>
                          : posterDisplay}
                    </div>
                    {l.poster_company && l.poster_name && <div className="text-xs text-muted truncate">{l.poster_name}</div>}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted">
                      {l.poster_kyc === "verified" ? <span className="inline-flex items-center gap-1 text-trust font-semibold"><BadgeCheck size={13} aria-hidden /> KYC verified</span> : <span className="inline-flex items-center gap-1"><ShieldAlert size={12} aria-hidden /> KYC pending</span>}
                      <span className="inline-flex items-center gap-1"><CalendarDays size={12} aria-hidden /> Member since {formatDate(l.poster_since, { month: "short", year: "numeric" })}</span>
                      {l.poster_rating ? <span className="inline-flex items-center gap-1 num"><Star size={12} aria-hidden /> {l.poster_rating.toFixed(1)} ({l.poster_rating_count})</span> : null}
                      {l.poster_rera && <span className="num">RERA {l.poster_rera}</span>}
                    </div>
                  </div>
                </div>
                <ContactPanel
                  listingId={l.id}
                  posterLabel={posterLabel}
                  posterFirstName={(l.poster_name || posterDisplay).split(" ")[0]}
                  me={user ? { name: user.name, phone: user.phone, email: user.email } : null}
                  own={isOwner}
                  live={l.status === "live"}
                  initialMode={act}
                />
              </Card>
              <div className="px-1 text-xs text-muted leading-relaxed">
                <p><strong className="text-ink-2 font-medium">Stay safe.</strong> Visit before paying anything. 10cent never collects token money and posters should never ask for it before a visit.</p>
                <div className="mt-2"><ReportListing listingId={l.id} /></div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-8 lg:col-start-1">
            {l.description && (
              <Section title="About this property">
                <div className="text-[15px] leading-relaxed text-ink-2 space-y-3 max-w-[68ch]">
                  {l.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </Section>
            )}

            {amenities.length > 0 && (
              <Section title="Amenities">
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                  {amenities.map((a) => (
                    <li key={a} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-trust" aria-hidden />{AMENITY_LABEL[a] ?? a}</li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Location" eyebrow={[l.locality_name, l.city_name].filter(Boolean).join(", ")}>
              {l.lat != null && l.lng != null ? (
                <div className="grid md:grid-cols-[1fr_260px] gap-4">
                  <div className="h-72 rounded-[var(--radius-md)] overflow-hidden border border-line isolate">
                    <LocationMap lat={l.lat} lng={l.lng} landmarks={near.slice(0, 8)} approximate={l.posted_by_type === "owner"} />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-2">Nearby</div>
                    {near.length ? (
                      <ul className="divide-y divide-line text-sm">
                        {near.slice(0, 8).map((m) => (
                          <li key={`${m.name}-${m.lat}-${m.lng}`} className="py-2 flex justify-between gap-3">
                            <span className="min-w-0"><span className="block truncate">{m.name}</span><span className="text-xs text-muted">{LANDMARK_KIND_LABEL[m.kind] ?? m.kind}</span></span>
                            <span className="num text-ink-2 shrink-0">{m.km < 1 ? `${Math.round(m.km * 1000)} m` : `${m.km.toFixed(1)} km`}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-muted">No landmarks mapped for this locality yet.</p>}
                  </div>
                </div>
              ) : <p className="text-sm text-muted">The poster hasn&apos;t pinned this property on the map.</p>}
              {l.locality_slug && <p className="mt-3 text-sm"><Link className="underline underline-offset-2" href={`/localities/${l.city_slug}/${l.locality_slug}`}>Read about living in {l.locality_name}</Link></p>}
            </Section>

            {l.transaction_type === "sell" && (
              <Section title="EMI calculator" eyebrow="Home loan estimate">
                <Card className="p-4 md:p-5"><EmiCalculator price={l.price} /></Card>
              </Section>
            )}

            {trendPts.length > 1 && (
              <Section title={`Price trend in ${l.locality_name}`} eyebrow={l.transaction_type === "sell" ? "Average ₹ per sq ft" : "Average 2 BHK rent"}>
                <Card className="p-4 md:p-5">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3">
                    <span className="num text-2xl font-semibold tracking-tight">₹{formatINR(tLast!)}{l.transaction_type === "sell" ? "/sq ft" : "/month"}</span>
                    {yoy != null && <span className={cx("num text-sm font-medium", yoy >= 0 ? "text-trust" : "text-danger")}>{yoy >= 0 ? "+" : ""}{yoy.toFixed(1)}% in 12 months</span>}
                    {psf && l.transaction_type === "sell" && tLast ? <span className="text-sm text-muted">This property: <span className="num">₹{formatINR(psf)}</span>/sq ft ({psf > tLast ? `${Math.round(((psf - tLast) / tLast) * 100)}% above` : `${Math.round(((tLast - psf) / tLast) * 100)}% below`} locality average)</span> : null}
                  </div>
                  <LineChart points={trendPts} format={(n) => `₹${formatINR(n)}`} color="var(--color-accent)" />
                </Card>
              </Section>
            )}
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mt-12">
            <div className="flex items-end justify-between gap-4 mb-4">
              <h2 className="font-display text-3xl">Similar properties</h2>
              <Link className="text-sm underline underline-offset-2" href={`/search?city=${l.city_slug}&tx=${l.transaction_type}&type=${l.property_type}${l.bhk && resi ? `&bhk=${l.bhk}` : ""}`}>See more</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {similar.map((s) => <ListingCard key={s.id} l={s} saved={saved.has(s.id)} />)}
            </div>
          </section>
        )}
      </Container>
      <CompareTray />
    </>
  );
}

function Section({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section>
      {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-1">{eyebrow}</div>}
      <h2 className="font-display text-[28px] leading-tight mb-3">{title}</h2>
      {children}
    </section>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
