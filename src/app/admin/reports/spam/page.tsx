import type { Metadata } from "next";
import { nowMs } from "@/lib/admin/clock";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db, addDays } from "@/lib/db";
import { formatPhone, timeAgo } from "@/lib/format";
import { LISTING_STATUS_LABEL } from "@/lib/constants";
import { Badge } from "@/components/ui";
import { AdminHeader, Panel, Table, Th, Td, EmptyRow, StatusBadge, FilterBar, FSelect } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Duplicates & spam" };

export default async function SpamDashboard({ searchParams }: PageProps<"/admin/reports/spam">) {
  await requireAdmin("reports");
  const sp = await searchParams;
  const days = [1, 7, 30].includes(Number(sp.days)) ? Number(sp.days) : 7;
  const since = addDays(-days);

  const dups = db.prepare(`
    SELECT l.id, l.title, l.status, l.created_at, l.user_id, u.name, u.phone, l.auto_flags,
      (SELECT GROUP_CONCAT(x.id) FROM listings x WHERE x.dup_hash = l.dup_hash AND x.id <> l.id AND l.dup_hash IS NOT NULL) same_hash
    FROM listings l JOIN users u ON u.id = l.user_id
    WHERE l.status IN ('pending','live','paused') AND (
      l.auto_flags LIKE '%"duplicate":true%'
      OR (l.dup_hash IS NOT NULL AND EXISTS (SELECT 1 FROM listings x WHERE x.dup_hash = l.dup_hash AND x.id <> l.id AND x.status IN ('pending','live','paused')))
    ) ORDER BY l.id DESC LIMIT 40`).all() as { id: number; title: string; status: string; created_at: string; user_id: number; name: string | null; phone: string | null; auto_flags: string | null; same_hash: string | null }[];

  const imgReuse = db.prepare(`
    SELECT m1.listing_id a, m2.listing_id b, COUNT(*) n FROM listing_media m1
    JOIN listing_media m2 ON m1.sha256 = m2.sha256 AND m1.listing_id < m2.listing_id
    WHERE m1.sha256 IS NOT NULL GROUP BY a, b ORDER BY n DESC LIMIT 20`).all() as { a: number; b: number; n: number }[];

  const bursts = db.prepare(`
    SELECT u.id, u.name, u.phone, u.role, u.blocked, COUNT(*) n, MIN(l.created_at) first, MAX(l.created_at) last,
      SUM(l.status = 'rejected') rejected
    FROM listings l JOIN users u ON u.id = l.user_id
    WHERE l.created_at >= ? GROUP BY u.id HAVING n >= ? ORDER BY n DESC LIMIT 25`).all(since, days === 1 ? 3 : 5) as { id: number; name: string | null; phone: string | null; role: string; blocked: number; n: number; first: string; last: string; rejected: number }[];

  const scrapers = db.prepare(`
    SELECT s.id, s.name, s.phone, s.blocked, COUNT(*) total, SUM(ld.status = 'spam') spam,
      COUNT(DISTINCT ld.poster_id) posters, SUM(ld.channel = 'phone_reveal') reveals
    FROM leads ld JOIN users s ON s.id = ld.seeker_id
    WHERE ld.created_at >= ? GROUP BY s.id HAVING spam >= 2 OR reveals >= 15 OR total >= 30
    ORDER BY spam DESC, total DESC LIMIT 25`).all(since) as { id: number; name: string | null; phone: string | null; blocked: number; total: number; spam: number; posters: number; reveals: number }[];

  const now = Math.floor(nowMs() / 1000);
  const limits = db.prepare("SELECT key, window_start, count FROM rate_limits ORDER BY count DESC LIMIT 25").all() as { key: string; window_start: number; count: number }[];

  return (
    <div>
      <AdminHeader eyebrow="AD4 · Trust & users" title="Duplicates & spam" sub="Signals from automated checks, posting bursts, spam-marked enquiries and rate limits. Use them to find scrapers, bulk spammers and copy-paste listings." />
      <FilterBar action="/admin/reports/spam">
        <FSelect label="Window" name="days" defaultValue={String(days)}>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </FSelect>
      </FilterBar>

      <div className="grid xl:grid-cols-2 gap-4">
        <Panel title={`Duplicate listings (${dups.length})`} pad={false}>
          <Table className="border-0 rounded-none">
            <thead><tr><Th>Listing</Th><Th>Matches</Th><Th>Poster</Th></tr></thead>
            <tbody>
              {!dups.length && <EmptyRow cols={3}>No duplicates detected.</EmptyRow>}
              {dups.map((d) => {
                let of: number | undefined;
                try { of = JSON.parse(d.auto_flags ?? "{}").duplicateOf; } catch { /* ignore */ }
                const others = [...new Set([...(of ? [of] : []), ...(d.same_hash ? d.same_hash.split(",").map(Number) : [])])];
                return (
                  <tr key={d.id}>
                    <Td className="max-w-[260px]"><Link href={`/admin/listings/${d.id}`} className="font-medium hover:underline line-clamp-1">#{d.id} {d.title}</Link><div className="mt-0.5"><StatusBadge status={d.status} label={LISTING_STATUS_LABEL[d.status]} /></div></Td>
                    <Td className="whitespace-nowrap">{others.map((o) => <Link key={o} href={`/admin/listings/${o}`} className="mr-2 underline num">#{o}</Link>)}</Td>
                    <Td className="whitespace-nowrap"><Link href={`/admin/users/${d.user_id}`} className="hover:underline">{d.name || "—"}</Link><div className="text-xs text-muted num">{formatPhone(d.phone)}</div></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {imgReuse.length > 0 && (
            <div className="px-4 py-3 border-t border-line text-[13px]">
              <div className="font-semibold mb-1.5">Same photo on different listings</div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {imgReuse.map((r) => <li key={`${r.a}-${r.b}`} className="num"><Link className="underline" href={`/admin/listings/${r.a}`}>#{r.a}</Link> ↔ <Link className="underline" href={`/admin/listings/${r.b}`}>#{r.b}</Link> <span className="text-muted">{r.n} photo{r.n > 1 ? "s" : ""}</span></li>)}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="Posting bursts: many listings in a short time" pad={false}>
          <Table className="border-0 rounded-none">
            <thead><tr><Th>User</Th><Th className="text-right">Listings</Th><Th>Span</Th></tr></thead>
            <tbody>
              {!bursts.length && <EmptyRow cols={3}>No user posted {days === 1 ? "3" : "5"}+ listings in this window.</EmptyRow>}
              {bursts.map((b) => (
                <tr key={b.id}>
                  <Td><Link href={`/admin/users/${b.id}`} className="font-medium hover:underline">{b.name || "Unnamed"}</Link> <span className="text-xs text-muted capitalize">{b.role}</span>{b.blocked ? <Badge tone="danger" className="ml-1">Blocked</Badge> : null}<div className="text-xs text-muted num">{formatPhone(b.phone)}</div></Td>
                  <Td className="text-right num font-semibold">{b.n}{b.rejected ? <div className="text-xs text-danger font-normal">{b.rejected} rejected</div> : null}</Td>
                  <Td className="text-xs text-muted whitespace-nowrap">{timeAgo(b.first)} → {timeAgo(b.last)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="px-4 py-2.5 text-xs text-muted border-t border-line">Agents and builders legitimately post in bulk; check rejections and duplicates before acting.</p>
        </Panel>

        <Panel title="Possible scrapers: spam-marked enquiries per seeker" pad={false}>
          <Table className="border-0 rounded-none">
            <thead><tr><Th>Seeker</Th><Th className="text-right">Leads</Th><Th className="text-right">Spam</Th><Th className="text-right">Reveals</Th><Th className="text-right">Posters</Th></tr></thead>
            <tbody>
              {!scrapers.length && <EmptyRow cols={5}>No seekers with 2+ spam-marked enquiries in this window.</EmptyRow>}
              {scrapers.map((s) => (
                <tr key={s.id}>
                  <Td><Link href={`/admin/users/${s.id}`} className="font-medium hover:underline">{s.name || "Unnamed"}</Link>{s.blocked ? <Badge tone="danger" className="ml-1">Blocked</Badge> : null}<div className="text-xs text-muted num">{formatPhone(s.phone)}</div></Td>
                  <Td className="text-right num">{s.total}</Td>
                  <Td className={`text-right num ${s.spam >= 3 ? "text-danger font-semibold" : ""}`}>{s.spam}</Td>
                  <Td className="text-right num">{s.reveals}</Td>
                  <Td className="text-right num">{s.posters}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        <Panel title="Top rate-limited keys" pad={false}>
          <Table className="border-0 rounded-none">
            <thead><tr><Th>Key</Th><Th className="text-right">Hits in window</Th><Th>Window started</Th></tr></thead>
            <tbody>
              {!limits.length && <EmptyRow cols={3}>No rate-limit counters yet.</EmptyRow>}
              {limits.map((l) => (
                <tr key={l.key}>
                  <Td className="font-mono text-[12px] break-all">{l.key}</Td>
                  <Td className="text-right num font-semibold">{l.count}</Td>
                  <Td className="text-xs text-muted whitespace-nowrap">{now - l.window_start < 86400 * 2 ? timeAgo(new Date(l.window_start * 1000).toISOString()) : new Date(l.window_start * 1000).toLocaleDateString("en-IN")}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="px-4 py-2.5 text-xs text-muted border-t border-line">Keys look like <code>otp:t:&lt;phone&gt;</code>, <code>otp:ip:&lt;ip&gt;</code> or <code>reveal:&lt;user&gt;</code>. A key at its limit is being throttled.</p>
        </Panel>
      </div>
    </div>
  );
}
