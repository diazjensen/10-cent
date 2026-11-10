import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCities } from "@/lib/listings";
import { formatPrice, formatDate } from "@/lib/format";
import { cx } from "@/components/ui";
import { AdminHeader, FilterBar, FInput, FSelect, Table, Th, Td, EmptyRow } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { toggleProject } from "@/lib/admin/actions-content";

export const metadata: Metadata = { title: "Projects & builders" };

type Row = { id: number; name: string; slug: string; status: string; rera_id: string | null; price_min: number | null; price_max: number | null; possession_date: string | null; featured: number; sponsored: number; approved: number; created_at: string; city: string; locality: string | null; builder_id: number; builder: string | null; company: string | null; listings: number; leads: number; banners: number };

function Toggle({ id, field, on, label }: { id: number; field: string; on: boolean; label: string }) {
  return (
    <ActionForm action={toggleProject} inline notice="none" className="contents">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="field" value={field} />
      <button type="submit" aria-pressed={on} className={cx("h-7 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wide border", on ? (field === "approved" ? "bg-trust text-white border-trust" : "bg-ink text-white border-ink") : "bg-card text-muted border-line-2 hover:border-ink hover:text-ink")}>
        {label}
      </button>
    </ActionForm>
  );
}

export default async function ProjectsAdmin({ searchParams }: PageProps<"/admin/projects">) {
  const me = await requireAdmin("projects");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const q = s("q"), city = s("city"), state = s("state");
  const where = ["1=1"]; const args: unknown[] = [];
  if (q) { where.push("(p.name LIKE ? OR pr.company_name LIKE ? OR u.name LIKE ? OR p.rera_id LIKE ?)"); args.push(...Array(4).fill(`%${q}%`)); }
  if (city) { where.push("c.slug = ?"); args.push(city); }
  if (state === "unapproved") where.push("p.approved = 0");
  if (state === "featured") where.push("p.featured = 1");
  if (state === "sponsored") where.push("p.sponsored = 1");
  const rows = db.prepare(`SELECT p.*, c.name city, lo.name locality, u.name builder, pr.company_name company,
      (SELECT COUNT(*) FROM listings l WHERE l.project_id = p.id AND l.status = 'live') listings,
      (SELECT COUNT(*) FROM leads ld WHERE ld.project_id = p.id) leads,
      (SELECT COUNT(*) FROM banners b WHERE b.project_id = p.id AND b.active = 1) banners
    FROM projects p JOIN cities c ON c.id = p.city_id LEFT JOIN localities lo ON lo.id = p.locality_id JOIN users u ON u.id = p.builder_id LEFT JOIN profiles pr ON pr.user_id = p.builder_id
    WHERE ${where.join(" AND ")} ORDER BY p.approved ASC, p.id DESC`).all(...args) as Row[];

  return (
    <div>
      <AdminHeader eyebrow="AD6 · Revenue" title="Projects & builders" sub="Approve new projects before they go public, and switch on paid placements: Featured (city home page slot) and Sponsored (top of search)." actions={can(me, "banners") ? <Link href="/admin/banners" className="text-[13px] underline">Manage banners</Link> : null} />
      <FilterBar action="/admin/projects" reset={!!(q || city || state)}>
        <FInput label="Project, builder or RERA" name="q" defaultValue={q} className="w-56" />
        <FSelect label="City" name="city" defaultValue={city}>
          <option value="">All</option>
          {getCities().map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </FSelect>
        <FSelect label="Show" name="state" defaultValue={state}>
          <option value="">All projects</option>
          <option value="unapproved">Awaiting approval</option>
          <option value="featured">Featured</option>
          <option value="sponsored">Sponsored</option>
        </FSelect>
      </FilterBar>
      <Table>
        <thead><tr><Th>Project</Th><Th>Builder</Th><Th>Status</Th><Th className="text-right">Price</Th><Th className="text-right">Live units / leads</Th><Th>Placement</Th></tr></thead>
        <tbody>
          {!rows.length && <EmptyRow cols={6}>No projects match.</EmptyRow>}
          {rows.map((p) => (
            <tr key={p.id} className={p.approved ? "" : "bg-warn-soft/40"}>
              <Td className="min-w-[220px]"><Link href={`/projects/${p.slug}`} target="_blank" className="font-medium hover:underline">{p.name}</Link><div className="text-xs text-muted">{[p.locality, p.city].filter(Boolean).join(", ")}{p.rera_id ? ` · RERA ${p.rera_id}` : " · no RERA id"}</div></Td>
              <Td><Link href={`/admin/users/${p.builder_id}`} className="hover:underline">{p.company || p.builder}</Link></Td>
              <Td className="whitespace-nowrap capitalize">{p.status.replace(/_/g, " ")}<div className="text-xs text-muted">Possession {formatDate(p.possession_date, { month: "short", year: "numeric" })}</div></Td>
              <Td className="text-right num whitespace-nowrap">{p.price_min ? `${formatPrice(p.price_min)} – ${formatPrice(p.price_max)}` : "—"}</Td>
              <Td className="text-right num">{p.listings} / {p.leads}{p.banners ? <div className="text-xs text-muted">{p.banners} banner{p.banners > 1 ? "s" : ""}</div> : null}</Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">
                  <Toggle id={p.id} field="approved" on={!!p.approved} label={p.approved ? "Approved" : "Approve"} />
                  <Toggle id={p.id} field="featured" on={!!p.featured} label="Featured" />
                  <Toggle id={p.id} field="sponsored" on={!!p.sponsored} label="Sponsored" />
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
