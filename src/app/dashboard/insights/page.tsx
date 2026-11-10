import { nowMs } from "@/lib/supply/time";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/format";
import { btnClass, Card, EmptyState, LineChart, Select, Stat } from "@/components/ui";
import { dashboardContext } from "@/lib/supply/account";
import { PageTitle } from "@/components/supply/bits";

export const metadata: Metadata = { title: "Insights", robots: { index: false } };

type Day = { day: string; impressions: number; views: number; contacts: number };

export default async function Insights({ searchParams }: PageProps<"/dashboard/insights">) {
  const sp = await searchParams;
  const { subject } = await dashboardContext("/dashboard/insights");
  const listingId = Number(sp.listing) || null;
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) days.push(new Date(nowMs() - i * 86400000).toISOString().slice(0, 10));
  const from = days[0];

  const mine = await db.prepare(
      `SELECT l.id, l.title, l.status, l.price, l.locality_id,
       COALESCE(SUM(s.impressions),0) impressions, COALESCE(SUM(s.views),0) views, COALESCE(SUM(s.contacts),0) contacts, COALESCE(SUM(s.shortlists),0) shortlists,
       (SELECT COUNT(*) FROM listing_media m WHERE m.listing_id = l.id AND m.kind = 'photo') photos
     FROM listings l LEFT JOIN listing_stats s ON s.listing_id = l.id AND s.day >= ?
     WHERE l.user_id = ? GROUP BY l.id ORDER BY views DESC`
    ).all(from, subject.id) as Array<{ id: number; title: string; status: string; price: number; locality_id: number; impressions: number; views: number; contacts: number; shortlists: number; photos: number }>;

  const rows = await db.prepare(
      `SELECT s.day, SUM(s.impressions) impressions, SUM(s.views) views, SUM(s.contacts) contacts
     FROM listing_stats s JOIN listings l ON l.id = s.listing_id
     WHERE l.user_id = ? AND s.day >= ? ${listingId ? "AND l.id = ?" : ""} GROUP BY s.day`
    ).all(...[subject.id, from, ...(listingId ? [listingId] : [])]) as Day[];
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const series = days.map((d) => byDay.get(d) ?? { day: d, impressions: 0, views: 0, contacts: 0 });
  const sum = (k: keyof Omit<Day, "day">) => series.reduce((a, r) => a + r[k], 0);
  const imp = sum("impressions"), views = sum("views"), contacts = sum("contacts");
  const ctr = imp ? (views / imp) * 100 : 0;
  const conv = views ? (contacts / views) * 100 : 0;
  const label = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const sel = listingId ? mine.find((m) => m.id === listingId) : null;

  const tipFor = (m: (typeof mine)[number]) => {
    if (m.status !== "live") return "Not live, so it isn't getting impressions.";
    if (m.photos < 3) return "Add at least 5 photos; the cover photo drives clicks from search.";
    const c = m.impressions ? m.views / m.impressions : 0;
    if (m.impressions > 50 && c < 0.05) return "Few people click through. Try a brighter cover photo or review the price.";
    const k = m.views ? m.contacts / m.views : 0;
    if (m.views > 30 && k < 0.03) return "Viewed but rarely contacted. Check the price against the locality and add details.";
    return "Performing well. Renew before expiry to keep your position.";
  };

  return (
    <div>
      <PageTitle eyebrow="Performance" title="Insights" sub="Last 30 days. Impressions are appearances in search results; views are visits to the listing page." />
      {mine.length === 0 ? (
        <EmptyState title="No listings yet" body="Insights appear once you have a listing." action={<Link href="/post-property" className={btnClass("accent", "md")}>Post property</Link>} />
      ) : (
        <>
          <form action="/dashboard/insights" className="flex gap-2 mb-5 max-w-lg">
            <label htmlFor="listing" className="sr-only">Listing</label>
            <Select id="listing" name="listing" defaultValue={listingId ?? ""}>
              <option value="">All listings</option>
              {mine.map((m) => <option key={m.id} value={m.id}>#{m.id} {m.title.slice(0, 50)}</option>)}
            </Select>
            <button className={btnClass("secondary", "md")}>Show</button>
          </form>
          {sel && <p className="text-sm text-ink-2 -mt-2 mb-4">Showing <b>{sel.title}</b></p>}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Impressions" value={formatINR(imp)} />
            <Stat label="Views" value={formatINR(views)} />
            <Stat label="Click-through rate" value={`${ctr.toFixed(1)}%`} sub="views ÷ impressions" />
            <Stat label="Contacts" value={formatINR(contacts)} sub={`${conv.toFixed(1)}% of views`} />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mt-6">
            {([
              ["Impressions", "impressions", "var(--color-ink-2)"],
              ["Views", "views", "var(--color-ink)"],
              ["Contacts", "contacts", "var(--color-accent)"],
            ] as const).map(([t, k, color]) => (
              <Card key={k} className="p-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium">{t}</p>
                  <p className="num text-xs text-muted">{formatINR(sum(k))} total</p>
                </div>
                <div className="mt-2">
                  <LineChart points={series.map((r) => ({ x: label(r.day), y: r[k] }))} height={150} labelEvery={10} color={color} format={(n) => formatINR(n)} />
                </div>
              </Card>
            ))}
          </div>

          <h2 className="font-display text-2xl mt-10 mb-3">By listing</h2>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="text-left text-xs text-muted border-b border-line">
                <tr>
                  <th className="font-medium px-4 py-2.5">Listing</th>
                  <th className="font-medium px-3 py-2.5 text-right">Impr.</th>
                  <th className="font-medium px-3 py-2.5 text-right">Views</th>
                  <th className="font-medium px-3 py-2.5 text-right">CTR</th>
                  <th className="font-medium px-3 py-2.5 text-right">Contacts</th>
                  <th className="font-medium px-4 py-2.5">Tip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {mine.map((m) => (
                  <tr key={m.id} className={m.id === listingId ? "bg-paper" : undefined}>
                    <td className="px-4 py-3 max-w-[260px]"><Link href={`/dashboard/insights?listing=${m.id}`} className="hover:underline line-clamp-1">{m.title}</Link><span className="text-xs text-muted">#{m.id} · {m.status}</span></td>
                    <td className="px-3 py-3 text-right num">{formatINR(m.impressions)}</td>
                    <td className="px-3 py-3 text-right num">{formatINR(m.views)}</td>
                    <td className="px-3 py-3 text-right num">{m.impressions ? `${((m.views / m.impressions) * 100).toFixed(1)}%` : "—"}</td>
                    <td className="px-3 py-3 text-right num">{m.contacts}</td>
                    <td className="px-4 py-3 text-xs text-ink-2 max-w-[280px]">{tipFor(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
