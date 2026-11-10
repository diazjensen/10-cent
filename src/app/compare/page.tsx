import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, GitCompareArrows, ShieldCheck } from "lucide-react";
import { AMENITIES, AMENITY_LABEL, FURNISHING_LABEL, PROPERTY_TYPE_LABEL } from "@/lib/constants";
import { formatArea, formatDate, formatINR, formatPrice, listingHeadline, pricePerSqft } from "@/lib/format";
import { getAmenities, getListingDetail, getMedia, type ListingDetail } from "@/lib/seeker/detail";
import { COMPARE_MAX_SERVER } from "@/lib/seeker/compare-const";
import { Breadcrumbs, Container, EmptyState, btnClass, cx } from "@/components/ui";
import { CompareFromStorage, CompareRemove } from "@/components/property/compare-page";

export const metadata: Metadata = { title: "Compare properties", robots: { index: false } };

type Row = { label: string; values: React.ReactNode[]; best?: number[] };

function bestIdx(nums: Array<number | null | undefined>, mode: "min" | "max") {
  const valid = nums.map((n, i) => [n, i] as const).filter(([n]) => n != null && Number.isFinite(n)) as Array<[number, number]>;
  if (valid.length < 2) return [];
  const target = mode === "min" ? Math.min(...valid.map(([n]) => n)) : Math.max(...valid.map(([n]) => n));
  if (valid.every(([n]) => n === target)) return [];
  return valid.filter(([n]) => n === target).map(([, i]) => i);
}

export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  const sp = await searchParams;
  const ids = [...new Set(String(sp.ids ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, COMPARE_MAX_SERVER);
  const items = (await Promise.all(ids.map((id) => getListingDetail(id)))).filter((l): l is ListingDetail => !!l && l.status === "live");
  const liveIds = items.map((l) => l.id);

  if (items.length === 0)
    return (
      <Container className="py-10 max-w-3xl">
        <CompareFromStorage />
        <h1 className="font-display text-4xl mb-6">Compare properties</h1>
        <EmptyState
          icon={<GitCompareArrows size={18} aria-hidden />}
          title="Nothing to compare yet"
          body={`Tap "Compare" on up to ${COMPARE_MAX_SERVER} properties in search results or on a property page, then open the tray at the bottom of the screen.`}
          action={<Link href="/search" className={btnClass("primary", "md")}>Browse properties</Link>}
        />
      </Container>
    );

  const extras = await Promise.all(items.map(async (l) => ({
    cover: (await getMedia(l.id)).find((m) => m.kind === "photo")?.url ?? null,
    amenities: await getAmenities(l.id),
    area: l.carpet_area ?? l.super_area ?? l.builtup_area ?? l.plot_area,
  })));
  const sameTx = items.every((l) => l.transaction_type === items[0].transaction_type);
  const anySale = items.some((l) => l.transaction_type === "sell");
  const anyRent = items.some((l) => l.transaction_type !== "sell");
  const psf = items.map((l, i) => (l.transaction_type === "sell" ? pricePerSqft(l.price, extras[i].area) : null));

  const rows: Row[] = [
    { label: sameTx && !anySale ? "Monthly rent" : "Price", values: items.map((l) => <span key={l.id} className="text-lg font-semibold">{l.transaction_type === "sell" ? formatPrice(l.price) : `₹${formatINR(l.price)}/mo`}</span>), best: sameTx ? bestIdx(items.map((l) => l.price), "min") : [] },
  ];
  if (anySale) rows.push({ label: "Price per sq ft", values: psf.map((v) => v ? `₹${formatINR(v)}` : "—"), best: bestIdx(psf, "min") });
  rows.push(
    { label: "Type", values: items.map((l) => `${l.bhk && !["plot", "office", "shop", "warehouse", "pg"].includes(l.property_type) ? `${l.bhk} BHK ` : ""}${PROPERTY_TYPE_LABEL[l.property_type]}`) },
    { label: "Area", values: items.map((l, i) => (extras[i].area ? `${formatArea(extras[i].area)}${l.carpet_area ? " carpet" : l.super_area ? " super" : ""}` : "—")), best: bestIdx(extras.map((e) => e.area), "max") },
    { label: "Bathrooms", values: items.map((l) => l.bathrooms ?? "—"), best: bestIdx(items.map((l) => l.bathrooms), "max") },
    { label: "Floor", values: items.map((l) => (l.floor != null ? `${l.floor === 0 ? "Ground" : l.floor}${l.total_floors ? ` of ${l.total_floors}` : ""}` : "—")) },
    { label: "Facing", values: items.map((l) => l.facing ?? "—") },
    { label: "Age", values: items.map((l) => (l.age_years == null ? "—" : l.age_years === 0 ? "New" : `${l.age_years} yrs`)), best: bestIdx(items.map((l) => l.age_years), "min") },
    { label: "Furnishing", values: items.map((l) => (l.furnishing ? FURNISHING_LABEL[l.furnishing] : "—")) },
  );
  if (anySale) rows.push(
    { label: "Status", values: items.map((l) => (l.transaction_type !== "sell" ? "—" : l.construction_status === "ready" ? "Ready to move" : l.construction_status === "under_construction" ? `Under construction${l.possession_date ? `, possession ${formatDate(l.possession_date, { month: "short", year: "numeric" })}` : ""}` : "—")) },
  );
  if (anyRent) rows.push(
    { label: "Deposit", values: items.map((l) => (l.transaction_type === "sell" || !l.deposit ? "—" : l.deposit < 100 ? `${l.deposit} month${l.deposit > 1 ? "s" : ""}` : `₹${formatINR(l.deposit)}`)) },
    { label: "Available from", values: items.map((l) => (l.transaction_type === "sell" ? "—" : !l.available_from || new Date(l.available_from) <= new Date() ? "Immediately" : formatDate(l.available_from))) },
  );
  rows.push(
    { label: "Locality", values: items.map((l) => [l.locality_name, l.city_name].filter(Boolean).join(", ")) },
    { label: "Posted by", values: items.map((l) => <span key={l.id} className="capitalize">{l.posted_by_type}{l.poster_company ? ` · ${l.poster_company}` : ""}</span>) },
    { label: "Trust", values: items.map((l) => (
      <span key={l.id} className="flex flex-col gap-1 text-[13px]">
        {l.verified ? <span className="inline-flex items-center gap-1 text-trust font-medium"><BadgeCheck size={14} aria-hidden /> Verified</span> : <span className="text-muted">Not verified</span>}
        {l.rera_id ? <span className="inline-flex items-center gap-1"><ShieldCheck size={14} aria-hidden /> RERA {l.rera_id}</span> : null}
      </span>
    )) },
    { label: "Amenities", values: extras.map((e, i) => <span key={i}><span className="num font-medium">{e.amenities.length}</span><span className="text-muted"> listed</span></span>), best: bestIdx(extras.map((e) => e.amenities.length), "max") },
  );
  const amenityKeys = AMENITIES.map((a) => a.value as string).filter((a) => extras.some((e) => e.amenities.includes(a)));

  return (
    <Container className="py-6 pb-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Search", href: "/search" }, { label: "Compare" }]} />
      <div className="flex flex-wrap items-end justify-between gap-3 mt-3 mb-5">
        <div>
          <h1 className="font-display text-4xl md:text-5xl">Compare {items.length} properties</h1>
          <p className="text-sm text-muted mt-1">Best value in each row is highlighted.{!sameTx && " Prices aren't compared because you picked both sale and rental listings."}</p>
        </div>
        {items.length < COMPARE_MAX_SERVER && <Link href="/search" className={btnClass("secondary", "sm")}>Add another property</Link>}
      </div>

      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[540px] border-separate border-spacing-0 bg-card border border-line rounded-[var(--radius-md)] text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-card w-36 md:w-44 p-3 text-left align-bottom border-b border-line"><span className="sr-only">Feature</span></th>
              {items.map((l, i) => (
                <th key={l.id} scope="col" className="p-3 text-left align-top font-normal border-b border-l border-line min-w-[150px]">
                  <div className="relative aspect-[4/3] rounded-[var(--radius-sm)] overflow-hidden bg-paper-2">
                    {extras[i].cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={extras[i].cover!} alt="" className="w-full h-full object-cover" />
                    ) : null}
                    <CompareRemove id={l.id} ids={liveIds} title={l.title} />
                  </div>
                  <Link href={`/property/${l.id}`} className="block mt-2 font-medium leading-snug hover:underline underline-offset-2 line-clamp-2">{listingHeadline(l)}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="sticky left-0 z-10 bg-card p-3 text-left text-xs font-medium text-muted align-top border-b border-line">{r.label}</th>
                {r.values.map((v, i) => {
                  const best = r.best?.includes(i);
                  return (
                    <td key={i} className={cx("p-3 align-top border-b border-l border-line num", best && "bg-trust-soft")}>
                      {v}
                      {best && <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-trust mt-0.5">Best</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {amenityKeys.map((a) => (
              <tr key={a}>
                <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-normal text-ink-2 border-b border-line">{AMENITY_LABEL[a]}</th>
                {extras.map((e, i) => (
                  <td key={i} className="px-3 py-2 border-b border-l border-line">{e.amenities.includes(a) ? <span className="text-trust font-medium">Yes</span> : <span className="text-muted">No</span>}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="sticky left-0 z-10 bg-card p-3"><span className="sr-only">Actions</span></th>
              {items.map((l) => (
                <td key={l.id} className="p-3 border-l border-line">
                  <Link href={`/property/${l.id}#contact`} className={btnClass("accent", "sm", "w-full")}>Contact {l.posted_by_type}</Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Container>
  );
}
