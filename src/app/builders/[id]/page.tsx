import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe } from "lucide-react";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { searchListings } from "@/lib/listings";
import { ListingCard } from "@/components/listing-card";
import { ProjectCard, PROJECT_CARD_SQL, type ProjectCardRow } from "@/components/content/project-card";
import { Breadcrumbs, Container, EmptyState, Stat } from "@/components/ui";

type Builder = { id: number; name: string | null; created_at: string; company_name: string | null; about: string | null; established_year: number | null; experience_years: number | null; website: string | null; rating: number | null; rating_count: number; rera_number: string | null; city: string | null };

async function getBuilder(id: number) {
  return await db.prepare(`SELECT u.id, u.name, u.created_at, pr.company_name, pr.about, pr.established_year, pr.experience_years, pr.website, pr.rating, pr.rating_count, pr.rera_number, c.name city
    FROM users u LEFT JOIN profiles pr ON pr.user_id = u.id LEFT JOIN cities c ON c.id = pr.city_id
    WHERE u.id = ? AND u.role = 'builder' AND u.deleted_at IS NULL AND u.blocked = 0`).get(id) as Builder | undefined;
}

export async function generateMetadata({ params }: PageProps<"/builders/[id]">): Promise<Metadata> {
  const { id } = await params;
  const b = await getBuilder(Number(id));
  if (!b) return { title: "Builder not found" };
  const name = b.company_name ?? b.name ?? "Builder";
  return { title: `${name}: projects, track record and reviews`, description: (b.about ?? `${name} projects on 10cent.`).slice(0, 160), alternates: { canonical: `/builders/${b.id}` } };
}

export default async function BuilderPage({ params }: PageProps<"/builders/[id]">) {
  const { id } = await params;
  const b = await getBuilder(Number(id));
  if (!b) notFound();
  const name = b.company_name ?? b.name ?? "Builder";
  const projects = await db.prepare(`${PROJECT_CARD_SQL} WHERE p.approved = 1 AND p.builder_id = ? ORDER BY p.status = 'ready', p.possession_date DESC`).all(b.id) as ProjectCardRow[];
  const ongoing = projects.filter((p) => p.status !== "ready");
  const past = projects.filter((p) => p.status === "ready");
  const listings = await searchListings({ poster: String(b.id), sort: "newest" }, { pageSize: 8 });
  const user = await getUser();
  const saved = new Set(user ? (await db.prepare("SELECT listing_id FROM shortlists WHERE user_id = ?").all(user.id) as { listing_id: number }[]).map((r) => r.listing_id) : []);
  const years = b.established_year ? new Date().getFullYear() - b.established_year : b.experience_years;
  const units = (await db.prepare("SELECT COALESCE(SUM(total_units),0) n FROM projects WHERE builder_id = ? AND approved = 1").get(b.id) as { n: number }).n;
  const cities = (await db.prepare("SELECT DISTINCT c.name FROM projects p JOIN cities c ON c.id = p.city_id WHERE p.builder_id = ? AND p.approved = 1").all(b.id) as { name: string }[]).map((r) => r.name);

  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Projects", href: "/projects" }, { label: name }]} />
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-8 items-start">
        <div className="flex gap-5">
          <span className="w-16 h-16 md:w-20 md:h-20 rounded-[var(--radius-md)] bg-ink text-white grid place-items-center font-display text-4xl shrink-0">{name.slice(0, 1)}</span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Developer{b.established_year ? ` · since ${b.established_year}` : ""}</p>
            <h1 className="font-display text-[40px] md:text-[56px] leading-[1] mt-1">{name}</h1>
            {b.about && <p className="mt-3 text-ink-2 leading-relaxed max-w-2xl">{b.about}</p>}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {cities.length > 0 && <span>Active in {cities.join(", ")}</span>}
              {b.website && /^https?:\/\//.test(b.website) && <a href={b.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-ink-2 hover:text-ink"><Globe size={14} aria-hidden />Website</a>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Years in business" value={years ?? "—"} />
          <Stat label="Projects on 10cent" value={projects.length} sub={`${ongoing.length} ongoing · ${past.length} delivered`} />
          <Stat label="Homes (listed projects)" value={units ? units.toLocaleString("en-IN") : "—"} />
          <Stat label="Buyer rating" value={b.rating ? `${b.rating.toFixed(1)}/5` : "—"} sub={b.rating_count ? `${b.rating_count} ratings` : undefined} />
        </div>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-3xl mb-4">Ongoing projects</h2>
        {ongoing.length ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{ongoing.map((p) => <ProjectCard key={p.id} p={p} />)}</div> : <EmptyState title="No ongoing projects listed" />}
      </section>
      <section className="mt-12">
        <h2 className="font-display text-3xl mb-4">Completed projects</h2>
        {past.length ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{past.map((p) => <ProjectCard key={p.id} p={p} />)}</div> : <EmptyState title="No completed projects listed on 10cent yet" />}
      </section>
      {listings.rows.length > 0 && (
        <section className="mt-12">
          <div className="flex items-end justify-between mb-4"><h2 className="font-display text-3xl">Active listings</h2>{listings.total > listings.rows.length && <Link href={`/search?poster=${b.id}`} className="text-sm font-medium">All {listings.total}</Link>}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{listings.rows.map((l) => <ListingCard key={l.id} l={l} saved={saved.has(l.id)} />)}</div>
        </section>
      )}
    </Container>
  );
}
