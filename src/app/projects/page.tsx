import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCities, getCity, getLocalities } from "@/lib/listings";
import { ProjectCard, PROJECT_CARD_SQL, PROJECT_STATUS, type ProjectCardRow } from "@/components/content/project-card";
import { AutoSelect } from "@/components/content/auto-submit";
import { Breadcrumbs, Container, EmptyState, Input, Pagination, btnClass, cx } from "@/components/ui";

const PAGE = 12;
const BUDGETS: Array<[string, string, string]> = [["", "", "Any budget"], ["", "5000000", "Under ₹50 L"], ["5000000", "10000000", "₹50 L – 1 Cr"], ["10000000", "20000000", "₹1 – 2 Cr"], ["20000000", "50000000", "₹2 – 5 Cr"], ["50000000", "", "Above ₹5 Cr"]];
const SORTS = [["featured", "Featured first"], ["newest", "Newest"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"], ["possession", "Earliest possession"]] as const;

export async function generateMetadata({ searchParams }: PageProps<"/projects">): Promise<Metadata> {
  const sp = await searchParams;
  const c = typeof sp.city === "string" ? await getCity(sp.city) : undefined;
  const st = typeof sp.status === "string" ? PROJECT_STATUS[sp.status]?.label : undefined;
  const where = c ? ` in ${c.name}` : " in India";
  return {
    title: `${st ? `${st} projects` : "New residential projects"}${where}`,
    description: `RERA-registered new launch, under-construction and ready-to-move residential projects${where}, with price lists, floor plans and possession dates.`,
    alternates: { canonical: c ? `/projects?city=${c.slug}` : "/projects" },
  };
}

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const sp = await searchParams;
  const f = { city: str(sp.city), status: str(sp.status), bhk: str(sp.bhk), budget: str(sp.budget), loc: str(sp.loc), q: str(sp.q).trim(), sort: str(sp.sort) || "featured" };
  const page = Math.max(1, Number(sp.page) || 1);
  const cities = await getCities();
  const city = f.city ? await getCity(f.city) : undefined;
  const locs = city ? await getLocalities(city.id) : [];

  const where = ["p.approved = 1"];
  const args: (string | number)[] = [];
  if (city) { where.push("p.city_id = ?"); args.push(city.id); }
  if (f.status && PROJECT_STATUS[f.status]) { where.push("p.status = ?"); args.push(f.status); }
  if (f.loc && locs.some((l) => l.id === Number(f.loc))) { where.push("p.locality_id = ?"); args.push(Number(f.loc)); }
  if (f.bhk) {
    const b = Number(f.bhk);
    where.push(`EXISTS (SELECT 1 FROM project_unit_types ut WHERE ut.project_id = p.id AND ${b >= 4 ? "ut.bhk >= 4" : "ut.bhk = ?"})`);
    if (b < 4) args.push(b);
  }
  const budget = BUDGETS.find(([lo, hi]) => `${lo}-${hi}` === f.budget);
  if (budget) {
    if (budget[0]) { where.push("COALESCE(p.price_max, p.price_min) >= ?"); args.push(Number(budget[0])); }
    if (budget[1]) { where.push("p.price_min <= ?"); args.push(Number(budget[1])); }
  }
  if (f.q) {
    const like = `%${f.q}%`;
    where.push("(p.name LIKE ? OR lo.name LIKE ? OR c.name LIKE ? OR pr.company_name LIKE ? OR p.address LIKE ?)");
    args.push(like, like, like, like, like);
  }
  const order = {
    featured: "p.sponsored DESC, p.featured DESC, p.created_at DESC",
    newest: "p.created_at DESC",
    price_asc: "p.price_min IS NULL, p.price_min ASC",
    price_desc: "COALESCE(p.price_max, p.price_min) DESC",
    possession: "p.status = 'ready' DESC, p.possession_date ASC",
  }[f.sort] ?? "p.featured DESC, p.created_at DESC";
  const w = where.join(" AND ");
  const total = (await db.prepare(`SELECT COUNT(*) n FROM projects p JOIN cities c ON c.id = p.city_id LEFT JOIN localities lo ON lo.id = p.locality_id LEFT JOIN profiles pr ON pr.user_id = p.builder_id WHERE ${w}`).get(...args) as { n: number }).n;
  const rows = await db.prepare(`${PROJECT_CARD_SQL} WHERE ${w} ORDER BY ${order}, p.id DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`).all(...args) as ProjectCardRow[];
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (o: Record<string, string>) => {
    const u = new URLSearchParams(Object.entries({ ...f, ...o }).filter(([k, v]) => v && !(k === "sort" && v === "featured")));
    const s = u.toString();
    return `/projects${s ? `?${s}` : ""}`;
  };

  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "New projects" }]} />
      <div className="mt-4 mb-6">
        <h1 className="font-display text-[44px] md:text-[64px] leading-[1]">New projects{city ? <> in {city.name}</> : null}</h1>
        <p className="text-ink-2 mt-2">Builder projects with RERA numbers linked to the state portal, published price lists and construction progress.</p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0 mb-4">
        {[["", "All"], ...Object.entries(PROJECT_STATUS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <Link key={k} href={qs({ status: k, page: "" })} aria-current={f.status === k ? "page" : undefined}
            className={cx("shrink-0 h-9 px-4 inline-flex items-center rounded-full text-sm border", f.status === k ? "bg-ink text-white border-ink" : "bg-card border-line text-ink-2 hover:border-ink-2")}>{label}</Link>
        ))}
      </div>

      <form method="get" className="bg-card border border-line rounded-[var(--radius-md)] p-3 grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_0.8fr_1fr_1fr_auto] gap-2 items-end mb-6">
        {f.status && <input type="hidden" name="status" value={f.status} />}
        <div className="col-span-2 md:col-span-1">
          <label htmlFor="pq" className="sr-only">Search projects</label>
          <Input id="pq" name="q" defaultValue={f.q} placeholder="Project, builder or locality" />
        </div>
        <div><label htmlFor="pcity" className="sr-only">City</label>
          <AutoSelect id="pcity" name="city" defaultValue={f.city}><option value="">All cities</option>{cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</AutoSelect></div>
        <div><label htmlFor="ploc" className="sr-only">Locality</label>
          <AutoSelect id="ploc" name="loc" defaultValue={f.loc} disabled={!city}><option value="">{city ? "All localities" : "Pick a city first"}</option>{locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</AutoSelect></div>
        <div><label htmlFor="pbhk" className="sr-only">BHK</label>
          <AutoSelect id="pbhk" name="bhk" defaultValue={f.bhk}><option value="">Any BHK</option>{[1, 2, 3].map((b) => <option key={b} value={b}>{b} BHK</option>)}<option value="4">4+ BHK</option></AutoSelect></div>
        <div><label htmlFor="pbud" className="sr-only">Budget</label>
          <AutoSelect id="pbud" name="budget" defaultValue={f.budget}>{BUDGETS.map(([lo, hi, l]) => <option key={l} value={lo || hi ? `${lo}-${hi}` : ""}>{l}</option>)}</AutoSelect></div>
        <div><label htmlFor="psort" className="sr-only">Sort</label>
          <AutoSelect id="psort" name="sort" defaultValue={f.sort}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</AutoSelect></div>
        <button className={btnClass("primary", "md", "col-span-2 md:col-span-1")}>Search</button>
      </form>

      <div className="flex items-center justify-between mb-4 text-sm">
        <p className="text-muted num">{total} project{total === 1 ? "" : "s"}</p>
        {(f.city || f.status || f.bhk || f.budget || f.loc || f.q) && <Link href="/projects" className="text-accent-ink font-medium">Clear filters</Link>}
      </div>
      {rows.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{rows.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
      ) : (
        <EmptyState title="No projects match these filters" body="Try a wider budget, another BHK, or all localities in the city." action={<Link href="/projects" className={btnClass("secondary", "sm")}>Clear filters</Link>} />
      )}
      <Pagination page={page} pages={pages} hrefFor={(n) => qs({ page: n > 1 ? String(n) : "" })} />
    </Container>
  );
}
