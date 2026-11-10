import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { pgInt, pageNum } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { getCities } from "@/lib/listings";
import { formatPhone, timeAgo } from "@/lib/format";
import { LISTING_STATUS_LABEL } from "@/lib/constants";
import { AdminHeader, FilterBar, FInput, FSelect, Table, Th, Td, EmptyRow, StatusBadge, Pager, qs } from "@/components/admin/ui";
import { ToggleForm, TakedownForm, RestoreForm, ApproveForm } from "@/components/admin/listing-forms";
import { priceText } from "@/components/admin/listing-review";

export const metadata: Metadata = { title: "All listings" };
const PER = 30;

type Row = { id: number; title: string; status: string; price: number; transaction_type: string; city_name: string; locality_name: string | null; poster_name: string | null; poster_phone: string | null; user_id: number; created_at: string; featured: number; premium: number; verified: number; posted_by_type: string };

export default async function AllListings({ searchParams }: PageProps<"/admin/listings">) {
  await requireAdmin("moderation");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const q = s("q"), city = s("city"), status = s("status"), phone = s("phone").replace(/\D/g, "").slice(-10), flag = s("flag");
  const page = pageNum(s("page"));

  const where: string[] = ["1=1"]; const args: unknown[] = [];
  if (q) {
    if (/^#?\d+$/.test(q)) { where.push("l.id = ?"); args.push(pgInt(q.replace("#", ""))); }
    else { where.push("(l.title LIKE ? OR lo.name LIKE ? OR l.address LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  }
  if (city) { where.push("c.slug = ?"); args.push(city); }
  if (status) { where.push("l.status = ?"); args.push(status); }
  if (phone) { where.push("u.phone LIKE ?"); args.push(`%${phone}%`); }
  if (flag === "featured") where.push("l.featured = 1");
  if (flag === "premium") where.push("l.premium = 1");
  if (flag === "verified") where.push("l.verified = 1");
  const from = `FROM listings l JOIN users u ON u.id = l.user_id JOIN cities c ON c.id = l.city_id LEFT JOIN localities lo ON lo.id = l.locality_id WHERE ${where.join(" AND ")}`;
  const total = (await db.prepare(`SELECT COUNT(*) n ${from}`).get(...args) as { n: number }).n;
  const rows = await db.prepare(`SELECT l.id, l.title, l.status, l.price, l.transaction_type, c.name city_name, lo.name locality_name, u.name poster_name, u.phone poster_phone, l.user_id, l.created_at, l.featured, l.premium, l.verified, l.posted_by_type ${from} ORDER BY l.id DESC LIMIT ${PER} OFFSET ${(page - 1) * PER}`).all(...args) as Row[];
  const pages = Math.max(1, Math.ceil(total / PER));
  const params = { q, city, status, phone, flag };

  return (
    <div>
      <AdminHeader eyebrow="AD2 · Listings" title="All listings" sub="Search the whole catalogue by id, title, city, status or the poster's phone. Take down, restore, feature or mark premium." actions={<span className="text-[13px] text-muted"><strong className="num text-ink">{total.toLocaleString("en-IN")}</strong> matching</span>} />
      <FilterBar action="/admin/listings" reset={Object.values(params).some(Boolean)}>
        <FInput label="ID or title" name="q" defaultValue={q} placeholder="#123 or Koramangala" className="w-44" />
        <FInput label="Poster phone" name="phone" defaultValue={phone} inputMode="numeric" placeholder="98765…" className="w-36" />
        <FSelect label="City" name="city" defaultValue={city}>
          <option value="">All</option>
          {(await getCities()).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </FSelect>
        <FSelect label="Status" name="status" defaultValue={status}>
          <option value="">Any</option>
          {Object.entries(LISTING_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </FSelect>
        <FSelect label="Flag" name="flag" defaultValue={flag}>
          <option value="">Any</option>
          <option value="featured">Featured</option>
          <option value="premium">Premium</option>
          <option value="verified">Verified</option>
        </FSelect>
      </FilterBar>

      <Table>
        <thead>
          <tr><Th>ID</Th><Th>Listing</Th><Th>Price</Th><Th>Status</Th><Th>Poster</Th><Th>Promote</Th><Th className="text-right">Actions</Th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow cols={7}>No listings match. Try a different id, phone or status.</EmptyRow>}
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-paper/40">
              <Td className="num text-muted">#{r.id}</Td>
              <Td className="min-w-[240px] max-w-[360px]">
                <Link href={`/admin/listings/${r.id}`} className="font-medium hover:underline line-clamp-1">{r.title}</Link>
                <div className="text-xs text-muted">{[r.locality_name, r.city_name].filter(Boolean).join(", ")} · {timeAgo(r.created_at)}{r.verified ? " · Verified" : ""}</div>
              </Td>
              <Td className="num whitespace-nowrap">{priceText(r)}</Td>
              <Td><StatusBadge status={r.status} label={LISTING_STATUS_LABEL[r.status]} /></Td>
              <Td className="whitespace-nowrap">
                <Link href={`/admin/users/${r.user_id}`} className="hover:underline">{r.poster_name || "—"}</Link>
                <div className="text-xs text-muted num">{formatPhone(r.poster_phone)} · {r.posted_by_type}</div>
              </Td>
              <Td>
                <div className="flex gap-1.5">
                  <ToggleForm id={r.id} field="featured" on={!!r.featured} />
                  <ToggleForm id={r.id} field="premium" on={!!r.premium} />
                </div>
              </Td>
              <Td className="text-right">
                <div className="flex justify-end flex-wrap gap-1.5 [&_details_form]:text-left">
                  {r.status === "pending" && <ApproveForm id={r.id} />}
                  {["live", "paused"].includes(r.status) && <TakedownForm id={r.id} />}
                  {["removed", "paused", "expired"].includes(r.status) && <RestoreForm id={r.id} />}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pager page={page} pages={pages} href={(p) => qs("/admin/listings", { ...params, page: p })} />
    </div>
  );
}
