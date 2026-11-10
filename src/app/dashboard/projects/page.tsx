import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";
import { Badge, btnClass, Card, EmptyState, Notice } from "@/components/ui";
import { activePlan, dashboardContext } from "@/lib/supply/account";
import { PageTitle } from "@/components/supply/bits";
import { FeatureToggle } from "@/components/supply/feature-toggle";

export const metadata: Metadata = { title: "My projects", robots: { index: false } };

const STATUS: Record<string, string> = { new_launch: "New launch", under_construction: "Under construction", ready: "Ready to move" };

export default async function ProjectsDash({ searchParams }: PageProps<"/dashboard/projects">) {
  const sp = await searchParams;
  const { subject } = await dashboardContext("/dashboard/projects");
  if (subject.role !== "builder" && subject.role !== "admin") redirect("/dashboard");
  const created = Number(sp.created) || null;
  const plan = activePlan(subject.id);
  const rows = db.prepare(
    `SELECT p.*, lo.name locality, c.name city,
       (SELECT url FROM project_media m WHERE m.project_id = p.id AND m.kind = 'photo' ORDER BY sort LIMIT 1) cover,
       (SELECT COUNT(*) FROM leads WHERE project_id = p.id) leads,
       (SELECT COUNT(*) FROM leads WHERE project_id = p.id AND status = 'new') new_leads,
       (SELECT COUNT(*) FROM project_towers WHERE project_id = p.id) towers,
       (SELECT COUNT(*) FROM project_unit_types WHERE project_id = p.id) unit_types
     FROM projects p JOIN cities c ON c.id = p.city_id LEFT JOIN localities lo ON lo.id = p.locality_id
     WHERE p.builder_id = ? ORDER BY p.created_at DESC`
  ).all(subject.id) as Array<{ id: number; name: string; slug: string; status: string; approved: number; featured: number; price_min: number | null; price_max: number | null; possession_date: string | null; rera_id: string | null; locality: string | null; city: string; cover: string | null; leads: number; new_leads: number; towers: number; unit_types: number; total_units: number | null }>;

  return (
    <div>
      <PageTitle eyebrow="Builder" title="Projects" sub="Add projects with towers, unit types and price lists. Promote approved projects with a builder plan." action={<Link href="/dashboard/projects/new" className={btnClass("accent", "md")}>Add project</Link>} />
      {created && <Notice tone="trust" className="mb-4">Project submitted. It will appear on 10cent once our team approves it (usually within 2 working days).</Notice>}
      <Card className="p-4 mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          {plan && plan.audience === "builder" ? <>On <b>{plan.name}</b> until {formatDate(plan.ends_at)}. You can feature approved projects on the city home page and in search.</> : <>Featured slots, sponsored search placement and banners come with builder plans.</>}
        </p>
        <Link href="/plans#builder" className={btnClass(plan?.audience === "builder" ? "ghost" : "secondary", "sm")}>{plan?.audience === "builder" ? "Plan details" : "See builder plans"}</Link>
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="No projects yet" body="Add your first project with towers, unit types, a price list and a brochure." action={<Link href="/dashboard/projects/new" className={btnClass("accent", "md")}>Add project</Link>} />
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => (
            <li key={p.id}>
              <Card className={`p-4 grid grid-cols-[96px_1fr] md:grid-cols-[140px_1fr_auto] gap-4 ${created === p.id ? "ring-2 ring-accent/50" : ""}`}>
                {p.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover} alt="" className="w-full aspect-[4/3] object-cover rounded-[var(--radius-sm)] border border-line" />
                ) : <div className="w-full aspect-[4/3] grid place-items-center rounded-[var(--radius-sm)] bg-paper-2 text-xs text-muted">No photos</div>}
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-1.5">
                    {p.approved ? <Badge tone="trust">Approved</Badge> : <Badge tone="warn">Pending approval</Badge>}
                    {p.featured ? <Badge tone="accent">Featured</Badge> : null}
                    <Badge>{STATUS[p.status] ?? p.status}</Badge>
                  </div>
                  <p className="font-medium mt-1.5">{p.name}</p>
                  <p className="text-xs text-muted">{[p.locality, p.city].filter(Boolean).join(", ")}{p.rera_id ? ` · RERA ${p.rera_id}` : ""}</p>
                  <p className="text-sm mt-1.5 num">{p.price_min ? `${formatPrice(p.price_min)} – ${formatPrice(p.price_max)}` : "Price on request"} <span className="text-xs text-muted">· {p.towers} tower{p.towers === 1 ? "" : "s"} · {p.unit_types} unit type{p.unit_types === 1 ? "" : "s"}{p.total_units ? ` · ${p.total_units} units` : ""}{p.possession_date ? ` · possession ${formatDate(p.possession_date, { month: "short", year: "numeric" })}` : ""}</span></p>
                  <p className="text-xs mt-1.5"><Link href={`/dashboard/leads?project=${p.id}`} className="hover:underline"><b className="num">{p.leads}</b> leads{p.new_leads ? <span className="text-accent-ink"> ({p.new_leads} new)</span> : null}</Link></p>
                </div>
                <div className="col-span-2 md:col-span-1 flex flex-wrap md:flex-col gap-2 md:items-end">
                  <Link href={`/dashboard/projects/${p.id}`} className={btnClass("secondary", "sm")}>Edit</Link>
                  {p.approved ? <Link href={`/projects/${p.slug}`} className={btnClass("ghost", "sm")}>View</Link> : null}
                  <FeatureToggle id={p.id} featured={!!p.featured} compact />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
