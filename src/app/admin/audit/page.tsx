import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { pgInt, pageNum } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { AdminHeader, FilterBar, FInput, FSelect, Table, Th, Td, EmptyRow, Pager, qs } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Audit log" };
const PER = 50;

const ENTITY_LINK: Record<string, (id: number) => string> = {
  listing: (id) => `/admin/listings/${id}`,
  user: (id) => `/admin/users/${id}`,
  report: (id) => `/admin/reports?id=${id}`,
  order: (id) => `/admin/billing?id=${id}`,
  article: (id) => `/admin/cms/${id}`,
};

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin("audit");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const actor = s("actor"), action = s("action"), entity = s("entity"), eid = s("eid"), from = s("from"), to = s("to");
  const page = pageNum(s("page"));
  const where = ["1=1"]; const args: unknown[] = [];
  if (actor === "system") where.push("a.actor_id IS NULL");
  else if (/^\d+$/.test(actor)) { where.push("a.actor_id = ?"); args.push(pgInt(actor)); }
  if (action) { where.push("a.action LIKE ?"); args.push(`${action}%`); }
  if (entity) { where.push("a.entity = ?"); args.push(entity); }
  if (eid) { where.push("a.entity_id = ?"); args.push(pgInt(eid)); }
  if (from) { where.push("substr(a.created_at,1,10) >= ?"); args.push(from); }
  if (to) { where.push("substr(a.created_at,1,10) <= ?"); args.push(to); }
  const total = (await db.prepare(`SELECT COUNT(*) n FROM audit_logs a WHERE ${where.join(" AND ")}`).get(...args) as { n: number }).n;
  const rows = await db.prepare(`SELECT a.*, u.name actor_name, u.admin_role FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id WHERE ${where.join(" AND ")} ORDER BY a.id DESC LIMIT ${PER} OFFSET ${(page - 1) * PER}`).all(...args) as { id: number; actor_id: number | null; actor_name: string | null; admin_role: string | null; action: string; entity: string; entity_id: number | null; details: string | null; ip: string | null; created_at: string }[];
  const actors = await db.prepare("SELECT DISTINCT u.id, u.name, u.admin_role FROM audit_logs a JOIN users u ON u.id = a.actor_id ORDER BY u.name").all() as { id: number; name: string | null; admin_role: string | null }[];
  const entities = (await db.prepare("SELECT DISTINCT entity FROM audit_logs ORDER BY entity").all() as { entity: string }[]).map((e) => e.entity);
  const params = { actor, action, entity, eid, from, to };

  return (
    <div>
      <AdminHeader eyebrow="AD9 · System" title="Audit log" sub="Append-only record of every admin action and background job run, with the actor, target and IP. Entries can't be edited or deleted." actions={<span className="text-[13px] text-muted"><strong className="num text-ink">{total.toLocaleString("en-IN")}</strong> entries</span>} />
      <FilterBar action="/admin/audit" reset={Object.values(params).some(Boolean)}>
        <FSelect label="Actor" name="actor" defaultValue={actor}>
          <option value="">Anyone</option>
          <option value="system">System / jobs</option>
          {actors.map((a) => <option key={a.id} value={a.id}>{a.name ?? `#${a.id}`} ({a.admin_role ?? "user"})</option>)}
        </FSelect>
        <FInput label="Action starts with" name="action" defaultValue={action} placeholder="listing." className="w-36" />
        <FSelect label="Entity" name="entity" defaultValue={entity}>
          <option value="">Any</option>
          {entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </FSelect>
        <FInput label="Entity id" name="eid" defaultValue={eid} className="w-24" inputMode="numeric" />
        <FInput label="From" type="date" name="from" defaultValue={from} />
        <FInput label="To" type="date" name="to" defaultValue={to} />
      </FilterBar>
      <Table>
        <thead><tr><Th>When (IST)</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Details</Th><Th>IP</Th></tr></thead>
        <tbody>
          {!rows.length && <EmptyRow cols={6}>No entries match.</EmptyRow>}
          {rows.map((a) => {
            const link = a.entity_id && ENTITY_LINK[a.entity] ? ENTITY_LINK[a.entity](a.entity_id) : null;
            return (
              <tr key={a.id} className="align-top">
                <Td className="whitespace-nowrap num text-[12px]">{new Date(a.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" })}</Td>
                <Td className="whitespace-nowrap">{a.actor_id ? <Link href={qs("/admin/audit", { ...params, actor: a.actor_id, page: undefined })} className="hover:underline">{a.actor_name ?? `#${a.actor_id}`}</Link> : <span className="text-muted">System</span>}{a.admin_role && <div className="text-[11px] text-muted">{a.admin_role}</div>}</Td>
                <Td className="font-mono text-[12px] whitespace-nowrap">{a.action}</Td>
                <Td className="whitespace-nowrap">{link ? <Link href={link} className="underline">{a.entity} #{a.entity_id}</Link> : <span>{a.entity}{a.entity_id ? ` #${a.entity_id}` : ""}</span>}</Td>
                <Td className="max-w-[420px]">{a.details ? <code className="block text-[11.5px] text-ink-2 break-all line-clamp-3" title={a.details}>{a.details}</code> : <span className="text-muted">—</span>}</Td>
                <Td className="font-mono text-[11.5px] text-muted">{a.ip ?? "—"}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PER))} href={(p) => qs("/admin/audit", { ...params, page: p })} />
    </div>
  );
}
