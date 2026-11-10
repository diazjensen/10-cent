import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatINR } from "@/lib/format";
import { Badge, inputClass, cx } from "@/components/ui";
import { AdminHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/action-form";
import { saveBanner, deleteBanner } from "@/lib/admin/actions-content";

export const metadata: Metadata = { title: "Banners" };

type Banner = { id: number; title: string; subtitle: string | null; link: string | null; placement: string; project_id: number | null; project: string | null; starts_at: string | null; ends_at: string | null; active: number; clicks: number; impressions: number };
const PLACEMENTS = [
  { value: "home_top", label: "Home page, top" },
  { value: "search_inline", label: "Search results, inline" },
  { value: "project_sidebar", label: "Project page sidebar" },
];
const PL = Object.fromEntries(PLACEMENTS.map((p) => [p.value, p.label]));
const inp = cx(inputClass, "h-9 mt-1 text-[13px]");
const lbl = "block text-[12px] font-medium text-ink-2";
/** ISO -> value for <input type=datetime-local> in IST. */
const local = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 5.5 * 3600000).toISOString().slice(0, 16) : "");

function BannerForm({ b, projects }: { b?: Banner; projects: { id: number; name: string }[] }) {
  return (
    <ActionForm action={saveBanner} resetOnSuccess={!b} className="grid sm:grid-cols-2 gap-3">
      {b && <input type="hidden" name="id" value={b.id} />}
      <label className={cx(lbl, "sm:col-span-2")}>Headline<input name="title" defaultValue={b?.title} className={inp} placeholder="Prestige Lakeside: 3 BHK from ₹1.4 Cr" /><FieldError name="title" /></label>
      <label className={cx(lbl, "sm:col-span-2")}>Sub-line<input name="subtitle" defaultValue={b?.subtitle ?? ""} className={inp} placeholder="RERA registered. Possession Dec 2027." /><FieldError name="subtitle" /></label>
      <label className={lbl}>Placement
        <select name="placement" defaultValue={b?.placement ?? "home_top"} className={inp}>{PLACEMENTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
        <FieldError name="placement" />
      </label>
      <label className={lbl}>Project <span className="font-normal text-muted">(optional)</span>
        <select name="project_id" defaultValue={b?.project_id ?? ""} className={inp}><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <FieldError name="project_id" />
      </label>
      <label className={cx(lbl, "sm:col-span-2")}>Link<input name="link" defaultValue={b?.link ?? ""} className={inp} placeholder="/projects/prestige-lakeside" /><FieldError name="link" /></label>
      <label className={lbl}>Starts (IST)<input type="datetime-local" name="starts_at" defaultValue={local(b?.starts_at ?? null)} className={inp} /><FieldError name="starts_at" /></label>
      <label className={lbl}>Ends (IST)<input type="datetime-local" name="ends_at" defaultValue={local(b?.ends_at ?? null)} className={inp} /><FieldError name="ends_at" /></label>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="active" defaultChecked={b ? !!b.active : true} className="accent-[var(--color-ink)]" /> Active</label>
      <div className="sm:col-span-2"><SubmitButton size="md">{b ? "Save banner" : "Schedule banner"}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function BannersPage() {
  await requireAdmin("banners");
  const banners = await db.prepare("SELECT b.*, p.name project FROM banners b LEFT JOIN projects p ON p.id = b.project_id ORDER BY b.active DESC, b.id DESC").all() as Banner[];
  const projects = await db.prepare("SELECT id, name FROM projects WHERE approved = 1 ORDER BY name").all() as { id: number; name: string }[];
  const now = new Date().toISOString();
  const state = (b: Banner) => !b.active ? "paused" : b.starts_at && b.starts_at > now ? "scheduled" : b.ends_at && b.ends_at < now ? "ended" : "running";

  return (
    <div>
      <AdminHeader eyebrow="AD6 · Revenue" title="Banners" sub="Sponsored banners for builders. A banner shows only while it is active and inside its schedule. CTR = clicks ÷ impressions, counted by /api/banner." />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
        <div className="space-y-3 min-w-0">
          {!banners.length && <p className="text-sm text-muted">No banners yet.</p>}
          {banners.map((b) => {
            const st = state(b);
            const ctr = b.impressions ? (b.clicks / b.impressions) * 100 : 0;
            return (
              <details key={b.id} className="bg-card border border-line rounded-[var(--radius-md)]">
                <summary className="list-none cursor-pointer p-4 grid sm:grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1"><Badge>{PL[b.placement] ?? b.placement}</Badge><StatusBadge status={st === "running" ? "active" : st === "scheduled" ? "pending" : st === "ended" ? "expired" : "cancelled"} label={st} /></div>
                    <div className="font-semibold truncate">{b.title}</div>
                    {b.subtitle && <div className="text-[13px] text-muted truncate">{b.subtitle}</div>}
                    <div className="text-xs text-muted mt-1">{formatDate(b.starts_at)} → {formatDate(b.ends_at)}{b.project ? ` · ${b.project}` : ""} · {b.link}</div>
                  </div>
                  <dl className="flex gap-5 text-right text-[13px]">
                    <div><dt className="text-xs text-muted">Impr.</dt><dd className="num font-semibold">{formatINR(b.impressions)}</dd></div>
                    <div><dt className="text-xs text-muted">Clicks</dt><dd className="num font-semibold">{formatINR(b.clicks)}</dd></div>
                    <div><dt className="text-xs text-muted">CTR</dt><dd className="num font-semibold">{ctr.toFixed(2)}%</dd></div>
                  </dl>
                </summary>
                <div className="px-4 pb-4 pt-3 border-t border-line">
                  <BannerForm b={b} projects={projects} />
                  <ActionForm action={deleteBanner} className="mt-3 pt-3 border-t border-line">
                    <input type="hidden" name="id" value={b.id} />
                    <SubmitButton variant="ghost" className="text-danger" confirm="Delete this banner and its stats?">Delete banner</SubmitButton>
                  </ActionForm>
                </div>
              </details>
            );
          })}
        </div>
        <Panel title="New banner"><BannerForm projects={projects} /></Panel>
      </div>
    </div>
  );
}
