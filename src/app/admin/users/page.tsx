import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPhone, formatDate, timeAgo } from "@/lib/format";
import { Badge } from "@/components/ui";
import { AdminHeader, FilterBar, FInput, FSelect, Table, Th, Td, EmptyRow, StatusBadge, Pager, qs } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Users" };
const PER = 30;

type Row = { id: number; name: string | null; phone: string | null; email: string | null; role: string; admin_role: string | null; kyc_status: string; blocked: number; created_at: string; last_login_at: string | null; listings: number; live: number; reports: number; actioned: number };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireAdmin("users");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const q = s("q"), role = s("role"), kyc = s("kyc"), state = s("state"), sort = s("sort");
  const page = Math.max(1, Number(s("page")) || 1);
  const where = ["u.deleted_at IS NULL"]; const args: unknown[] = [];
  if (q) {
    const digits = q.replace(/\D/g, "");
    if (/^#\d+$/.test(q)) { where.push("u.id = ?"); args.push(Number(q.slice(1))); }
    else { where.push("(u.name LIKE ? OR u.email LIKE ? OR (? <> '' AND u.phone LIKE ?) OR pr.company_name LIKE ?)"); args.push(`%${q}%`, `%${q}%`, digits, `%${digits}%`, `%${q}%`); }
  }
  if (role) { where.push("u.role = ?"); args.push(role); }
  if (kyc) { where.push("u.kyc_status = ?"); args.push(kyc); }
  if (state === "blocked") where.push("u.blocked = 1");
  if (state === "offender") where.push("(SELECT COUNT(*) FROM reports r WHERE r.reported_user_id = u.id AND r.status = 'actioned') >= 3");
  const from = `FROM users u LEFT JOIN profiles pr ON pr.user_id = u.id WHERE ${where.join(" AND ")}`;
  const total = (db.prepare(`SELECT COUNT(*) n ${from}`).get(...args) as { n: number }).n;
  const order = sort === "listings" ? "listings DESC" : sort === "reports" ? "reports DESC" : "u.id DESC";
  const rows = db.prepare(`SELECT u.id, u.name, u.phone, u.email, u.role, u.admin_role, u.kyc_status, u.blocked, u.created_at, u.last_login_at,
      (SELECT COUNT(*) FROM listings l WHERE l.user_id = u.id) listings,
      (SELECT COUNT(*) FROM listings l WHERE l.user_id = u.id AND l.status = 'live') live,
      (SELECT COUNT(*) FROM reports r WHERE r.reported_user_id = u.id) reports,
      (SELECT COUNT(*) FROM reports r WHERE r.reported_user_id = u.id AND r.status = 'actioned') actioned
    ${from} ORDER BY ${order} LIMIT ${PER} OFFSET ${(page - 1) * PER}`).all(...args) as Row[];
  const params = { q, role, kyc, state, sort };

  return (
    <div>
      <AdminHeader eyebrow="AD3 · Trust & users" title="Users" sub="Seekers, owners, agents and builders. Open a user to change KYC, block or unblock, or raise their free listing limit." actions={<span className="text-[13px] text-muted"><strong className="num text-ink">{total.toLocaleString("en-IN")}</strong> users</span>} />
      <FilterBar action="/admin/users" reset={Object.values(params).some(Boolean)}>
        <FInput label="Phone, email, name or #id" name="q" defaultValue={q} className="w-56" placeholder="9876543210" />
        <FSelect label="Role" name="role" defaultValue={role}>
          <option value="">Any</option>
          {["seeker", "owner", "agent", "builder", "admin"].map((r) => <option key={r} value={r}>{r}</option>)}
        </FSelect>
        <FSelect label="KYC" name="kyc" defaultValue={kyc}>
          <option value="">Any</option>
          {["none", "pending", "verified", "rejected"].map((r) => <option key={r} value={r}>{r}</option>)}
        </FSelect>
        <FSelect label="State" name="state" defaultValue={state}>
          <option value="">Any</option>
          <option value="blocked">Blocked</option>
          <option value="offender">Repeat offenders (3+ actioned reports)</option>
        </FSelect>
        <FSelect label="Sort" name="sort" defaultValue={sort}>
          <option value="">Newest</option>
          <option value="listings">Most listings</option>
          <option value="reports">Most reports</option>
        </FSelect>
      </FilterBar>
      <Table>
        <thead><tr><Th>User</Th><Th>Contact</Th><Th>Role</Th><Th>KYC</Th><Th className="text-right">Listings</Th><Th className="text-right">Reports</Th><Th>Joined</Th></tr></thead>
        <tbody>
          {!rows.length && <EmptyRow cols={7}>No users match these filters.</EmptyRow>}
          {rows.map((u) => (
            <tr key={u.id} className="hover:bg-paper/40">
              <Td>
                <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">{u.name || "Unnamed"}</Link>
                <span className="text-xs text-muted num"> #{u.id}</span>
                {u.blocked ? <Badge tone="danger" className="ml-2">Blocked</Badge> : null}
                {u.actioned >= 3 ? <Badge tone="danger" className="ml-2">Repeat offender</Badge> : null}
              </Td>
              <Td className="whitespace-nowrap"><div className="num">{formatPhone(u.phone)}</div><div className="text-xs text-muted">{u.email}</div></Td>
              <Td className="capitalize">{u.role}{u.admin_role && <span className="text-muted"> · {u.admin_role}</span>}</Td>
              <Td><StatusBadge status={u.kyc_status === "verified" ? "verified" : u.kyc_status} /></Td>
              <Td className="text-right num">{u.listings}<span className="text-muted text-xs"> ({u.live} live)</span></Td>
              <Td className={`text-right num ${u.actioned >= 3 ? "text-danger font-semibold" : ""}`}>{u.reports}</Td>
              <Td className="whitespace-nowrap">{formatDate(u.created_at)}<div className="text-xs text-muted">{u.last_login_at ? `seen ${timeAgo(u.last_login_at)}` : "never signed in"}</div></Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PER))} href={(p) => qs("/admin/users", { ...params, page: p })} />
    </div>
  );
}
