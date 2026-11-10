import type { Metadata } from "next";
import { nowMs } from "@/lib/admin/clock";
import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getCities } from "@/lib/listings";
import { formatINR } from "@/lib/format";
import { PROPERTY_TYPE_LABEL } from "@/lib/constants";
import { LineChart } from "@/components/ui";
import { AdminHeader, FilterBar, FInput, FSelect, Panel, Bars, Table, Th, Td, EmptyRow, qs } from "@/components/admin/ui";
import { parseRange, trafficTable, supplyTable, leadsTable, revenueTable, funnelTable, type Range } from "@/lib/admin/analytics";
import { fillDays, shortDay, dayRange } from "@/lib/admin/metrics";

export const metadata: Metadata = { title: "Analytics" };

function Csv({ table, r }: { table: string; r: Range }) {
  return (
    <a href={qs(`/api/admin/export/${table}`, { from: r.from, to: r.to, city: r.city })} className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink">
      <Download size={13} aria-hidden /> CSV
    </a>
  );
}

const sumBy = <T,>(rows: T[], key: (r: T) => string, val: (r: T) => number) => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + val(r));
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireAdmin("analytics");
  const r = parseRange(await searchParams);
  const days = dayRange(r.from, r.to);
  const labelEvery = Math.max(1, Math.ceil(days.length / 6));

  const traffic = await trafficTable(r);
  const supply = await supplyTable(r);
  const leads = await leadsTable(r);
  const revenue = await revenueTable(r);
  const funnel = await funnelTable(r);

  const tSeries = (col: number) => fillDays(traffic.rows.map((x) => ({ day: String(x[0]), v: Number(x[col]) })), r.from, r.to).map((p) => ({ x: shortDay(p.day), y: p.v }));
  const supplyDaily = fillDays(sumBy(supply.rows, (x) => String(x[0]), (x) => Number(x[4])).map((x) => ({ day: x.label, v: x.value })), r.from, r.to).map((p) => ({ x: shortDay(p.day), y: p.v }));
  const leadsDaily = fillDays(sumBy(leads.rows, (x) => String(x[0]), (x) => Number(x[2])).map((x) => ({ day: x.label, v: x.value })), r.from, r.to).map((p) => ({ x: shortDay(p.day), y: p.v }));
  const revDaily = fillDays(sumBy(revenue.rows, (x) => String(x[0]), (x) => Number(x[6])).map((x) => ({ day: x.label, v: x.value })), r.from, r.to).map((p) => ({ x: shortDay(p.day), y: p.v }));
  const total = (rows: Array<Array<string | number>>, col: number) => rows.reduce((a, x) => a + Number(x[col]), 0);

  return (
    <div>
      <AdminHeader eyebrow="AD8 · Content & growth" title="Analytics" sub="Traffic, supply, demand and revenue for the selected range. Every table downloads as CSV with the same filters." />
      <FilterBar action="/admin/analytics">
        <FInput label="From" type="date" name="from" defaultValue={r.from} />
        <FInput label="To" type="date" name="to" defaultValue={r.to} />
        <FSelect label="City" name="city" defaultValue={r.city}>
          <option value="">All cities</option>
          {(await getCities()).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </FSelect>
        <div className="flex gap-1.5 text-xs pb-2">
          {[7, 30, 90].map((n) => (
            <a key={n} href={qs("/admin/analytics", { from: new Date(nowMs() - (n - 1) * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10), city: r.city })} className="h-7 px-2.5 inline-flex items-center rounded-full border border-line-2 hover:border-ink">{n}d</a>
          ))}
        </div>
      </FilterBar>

      <Panel title="Funnel: impressions → views → contacts" action={<Csv table="funnel" r={r} />} className="mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line rounded-[var(--radius-sm)] overflow-hidden">
          {funnel.rows.map((f, i) => (
            <div key={String(f[0])} className="bg-card p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{String(f[0]).replace("_", " ")}</div>
              <div className="num text-2xl font-semibold mt-1.5">{formatINR(Number(f[1]))}</div>
              <div className="text-xs text-muted mt-1">{i === 0 ? "Listing cards shown" : <><span className="num font-medium text-ink">{f[2]}%</span> of previous · <span className="num">{f[3]}%</span> of impressions</>}</div>
              <div className="h-1.5 mt-2.5 bg-paper-2 rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: `${Math.max(2, Number(f[3]))}%` }} /></div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title={`Traffic · ${formatINR(total(traffic.rows, 2))} detail views`} action={<Csv table="traffic" r={r} />}>
          <LineChart points={tSeries(2)} labelEvery={labelEvery} height={150} />
          <p className="text-xs text-muted mt-2">Impressions: <span className="num">{formatINR(total(traffic.rows, 1))}</span> · contacts: <span className="num">{formatINR(total(traffic.rows, 3))}</span> · shortlists: <span className="num">{formatINR(total(traffic.rows, 4))}</span></p>
        </Panel>
        <Panel title={`Supply · ${formatINR(total(supply.rows, 4))} new listings`} action={<Csv table="supply" r={r} />}>
          <LineChart points={supplyDaily} labelEvery={labelEvery} height={150} />
          <div className="grid sm:grid-cols-2 gap-5 mt-4">
            <div><div className="text-xs text-muted mb-2">By city</div><Bars rows={sumBy(supply.rows, (x) => String(x[1]), (x) => Number(x[4])).slice(0, 8)} /></div>
            <div><div className="text-xs text-muted mb-2">By type</div><Bars rows={sumBy(supply.rows, (x) => PROPERTY_TYPE_LABEL[String(x[3])] ?? String(x[3]), (x) => Number(x[4])).slice(0, 8)} /></div>
          </div>
        </Panel>
        <Panel title={`Leads · ${formatINR(total(leads.rows, 2))}`} action={<Csv table="leads" r={r} />}>
          <LineChart points={leadsDaily} labelEvery={labelEvery} height={150} color="var(--color-accent)" />
          <div className="mt-4"><div className="text-xs text-muted mb-2">By channel</div><Bars rows={sumBy(leads.rows, (x) => String(x[1]).replace("_", " "), (x) => Number(x[2]))} /></div>
        </Panel>
        <Panel title={`Revenue · ₹${formatINR(total(revenue.rows, 6))}`} action={<Csv table="revenue" r={r} />}>
          <LineChart points={revDaily} labelEvery={labelEvery} height={150} color="var(--color-trust)" format={(n) => `₹${formatINR(n)}`} />
          <div className="mt-4"><div className="text-xs text-muted mb-2">By plan (incl. GST){r.city ? " · not filtered by city" : ""}</div><Bars rows={sumBy(revenue.rows, (x) => String(x[1]), (x) => Number(x[6]))} format={(n) => `₹${formatINR(n)}`} /></div>
        </Panel>
      </div>

      <Panel title="Daily traffic table" action={<Csv table="traffic" r={r} />} className="mt-4" pad={false}>
        <Table className="border-0 rounded-none max-h-96 overflow-y-auto">
          <thead><tr>{traffic.columns.map((c) => <Th key={c} className={c === "day" ? "" : "text-right"}>{c.replace("_", " ")}</Th>)}<Th className="text-right">view rate</Th></tr></thead>
          <tbody>
            {!traffic.rows.length && <EmptyRow cols={6}>No traffic recorded for this range.</EmptyRow>}
            {[...traffic.rows].reverse().map((row) => (
              <tr key={String(row[0])}>
                {row.map((v, i) => <Td key={i} className={i ? "text-right num" : "num"}>{i ? formatINR(Number(v)) : String(v)}</Td>)}
                <Td className="text-right num">{Number(row[1]) ? ((Number(row[2]) / Number(row[1])) * 100).toFixed(1) : "0.0"}%</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}
