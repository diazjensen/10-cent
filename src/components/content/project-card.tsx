import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { formatDate, formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui";

export const PROJECT_STATUS: Record<string, { label: string; tone: "accent" | "warn" | "trust" }> = {
  new_launch: { label: "New launch", tone: "accent" },
  under_construction: { label: "Under construction", tone: "warn" },
  ready: { label: "Ready to move", tone: "trust" },
};

export type ProjectCardRow = {
  id: number; slug: string; name: string; status: string; price_min: number | null; price_max: number | null;
  possession_date: string | null; rera_id: string | null; featured: number; sponsored: number;
  loc: string | null; city: string; city_slug: string; builder: string | null; builder_id: number;
  cover: string | null; bhks: string | null; live: number;
};

export const PROJECT_CARD_SQL = `
  SELECT p.id, p.slug, p.name, p.status, p.price_min, p.price_max, p.possession_date, p.rera_id, p.featured, p.sponsored, p.builder_id, p.created_at,
    lo.name loc, c.name city, c.slug city_slug, COALESCE(pr.company_name, u.name) builder,
    (SELECT url FROM project_media m WHERE m.project_id = p.id ORDER BY sort LIMIT 1) cover,
    (SELECT GROUP_CONCAT(DISTINCT bhk) FROM (SELECT bhk FROM project_unit_types ut WHERE ut.project_id = p.id ORDER BY bhk)) bhks,
    (SELECT COUNT(*) FROM listings l WHERE l.project_id = p.id AND l.status = 'live') live
  FROM projects p JOIN cities c ON c.id = p.city_id LEFT JOIN localities lo ON lo.id = p.locality_id
  JOIN users u ON u.id = p.builder_id LEFT JOIN profiles pr ON pr.user_id = p.builder_id`;

export function bhkLabel(bhks: string | null) {
  if (!bhks) return null;
  const list = bhks.split(",").map(Number).filter(Boolean).sort((a, b) => a - b);
  return list.length ? `${list.join(", ")} BHK` : null;
}

export function priceRange(min: number | null, max: number | null) {
  if (!min && !max) return "Price on request";
  if (min && max && min !== max) return `${formatPrice(min, { short: true })} – ${formatPrice(max, { short: true }).replace("₹", "")}`;
  return formatPrice(min || max, { short: true });
}

export function ProjectCard({ p }: { p: ProjectCardRow }) {
  const st = PROJECT_STATUS[p.status];
  return (
    <article className="group bg-card border border-line rounded-[var(--radius-md)] overflow-hidden hover:shadow-[var(--shadow-pop)] transition-shadow">
      <Link href={`/projects/${p.slug}`} className="block">
        <div className="relative aspect-[16/10] bg-paper-2 overflow-hidden">
          {p.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.cover} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
          ) : null}
          <div className="absolute left-2.5 top-2.5 flex gap-1.5">
            {st && <Badge tone={st.tone} className="bg-white">{st.label}</Badge>}
            {p.sponsored ? <Badge tone="ink">Sponsored</Badge> : p.featured ? <Badge tone="ink">Featured</Badge> : null}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-medium text-[17px] leading-snug truncate">{p.name}</h3>
              <p className="text-xs text-muted truncate">{[p.loc, p.city].filter(Boolean).join(", ")}</p>
            </div>
            {p.rera_id && <span className="shrink-0 inline-flex items-center gap-0.5 text-[11px] font-semibold text-trust" title={`RERA ${p.rera_id}`}><ShieldCheck size={13} aria-hidden /> RERA</span>}
          </div>
          <div className="num text-lg font-semibold tracking-tight mt-2">{priceRange(p.price_min, p.price_max)}</div>
          <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1 text-xs text-ink-2">
            {bhkLabel(p.bhks) && <span>{bhkLabel(p.bhks)}</span>}
            {p.possession_date && <span className="before:content-['·'] before:mr-2 before:text-muted">{p.status === "ready" ? "Ready" : `Possession ${formatDate(p.possession_date, { month: "short", year: "numeric" })}`}</span>}
          </div>
          <div className="mt-3 pt-3 border-t border-line text-xs text-muted flex justify-between gap-2">
            <span className="truncate">by <span className="text-ink-2 font-medium">{p.builder}</span></span>
            {p.live > 0 && <span className="shrink-0 num">{p.live} resale/rent</span>}
          </div>
        </div>
      </Link>
    </article>
  );
}
