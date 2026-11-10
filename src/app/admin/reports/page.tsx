import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPhone, timeAgo, formatDate } from "@/lib/format";
import { REPORT_REASONS, LISTING_STATUS_LABEL } from "@/lib/constants";
import { Badge, EmptyState, inputClass, cx } from "@/components/ui";
import { AdminHeader, FilterBar, FSelect, FInput, StatusBadge, Hours, Pager, qs } from "@/components/admin/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/action-form";
import { resolveReport } from "@/lib/admin/actions-users";
import { priceText } from "@/components/admin/listing-review";

export const metadata: Metadata = { title: "Fraud reports" };
const PER = 20;
const REASON_LABEL: Record<string, string> = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]));

type Row = {
  id: number; reason: string; details: string | null; status: string; admin_note: string | null; created_at: string; resolved_at: string | null;
  listing_id: number | null; l_title: string | null; l_status: string | null; l_price: number | null; l_tx: string | null; l_city: string | null;
  reported_user_id: number | null; ru_name: string | null; ru_phone: string | null; ru_role: string | null; ru_blocked: number | null;
  reporter_id: number | null; rp_name: string | null; rp_phone: string | null; resolver: string | null;
  user_reports: number; user_actioned: number; listing_reports: number; reporter_reports: number;
};

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireAdmin("reports");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const status = s("status") || (s("id") ? "" : "open"), reason = s("reason"), id = s("id").replace("#", "");
  const page = Math.max(1, Number(s("page")) || 1);
  const where = ["1=1"]; const args: unknown[] = [];
  if (id) { where.push("r.id = ?"); args.push(Number(id)); }
  if (status && status !== "all") { where.push("r.status = ?"); args.push(status); }
  if (reason) { where.push("r.reason = ?"); args.push(reason); }
  const total = (db.prepare(`SELECT COUNT(*) n FROM reports r WHERE ${where.join(" AND ")}`).get(...args) as { n: number }).n;
  const rows = db.prepare(`
    SELECT r.*, l.title l_title, l.status l_status, l.price l_price, l.transaction_type l_tx, c.name l_city,
      ru.name ru_name, ru.phone ru_phone, ru.role ru_role, ru.blocked ru_blocked,
      rp.name rp_name, rp.phone rp_phone, rv.name resolver,
      (SELECT COUNT(*) FROM reports x WHERE x.reported_user_id = r.reported_user_id) user_reports,
      (SELECT COUNT(*) FROM reports x WHERE x.reported_user_id = r.reported_user_id AND x.status = 'actioned') user_actioned,
      (SELECT COUNT(*) FROM reports x WHERE x.listing_id = r.listing_id) listing_reports,
      (SELECT COUNT(*) FROM reports x WHERE x.reporter_id = r.reporter_id) reporter_reports
    FROM reports r
    LEFT JOIN listings l ON l.id = r.listing_id LEFT JOIN cities c ON c.id = l.city_id
    LEFT JOIN users ru ON ru.id = r.reported_user_id LEFT JOIN users rp ON rp.id = r.reporter_id LEFT JOIN users rv ON rv.id = r.resolved_by
    WHERE ${where.join(" AND ")}
    ORDER BY (r.status = 'open') DESC, CASE WHEN r.status = 'open' THEN r.created_at END ASC, r.id DESC
    LIMIT ${PER} OFFSET ${(page - 1) * PER}`).all(...args) as Row[];
  const counts = db.prepare("SELECT status, COUNT(*) n FROM reports GROUP BY status").all() as { status: string; n: number }[];
  const c = (k: string) => counts.find((x) => x.status === k)?.n ?? 0;
  const params = { status, reason, id };

  return (
    <div>
      <AdminHeader
        eyebrow="AD4 · Trust & users"
        title="Fraud reports"
        sub="Every report should be reviewed within 24 hours. Users with 3 or more actioned reports are flagged as repeat offenders and should be blocked."
        actions={<div className="flex gap-4 text-[13px]"><span><strong className="num">{c("open")}</strong> <span className="text-muted">open</span></span><span><strong className="num">{c("actioned")}</strong> <span className="text-muted">actioned</span></span><span><strong className="num">{c("dismissed")}</strong> <span className="text-muted">dismissed</span></span></div>}
      />
      <FilterBar action="/admin/reports" reset={!!(reason || id || (status && status !== "open"))}>
        <FSelect label="Status" name="status" defaultValue={status}>
          <option value="open">Open</option>
          <option value="actioned">Actioned</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All</option>
        </FSelect>
        <FSelect label="Reason" name="reason" defaultValue={reason}>
          <option value="">Any</option>
          {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </FSelect>
        <FInput label="Report #" name="id" defaultValue={id} className="w-24" inputMode="numeric" />
      </FilterBar>

      {!rows.length ? (
        <EmptyState title={status === "open" ? "No open reports" : "No reports match"} body={status === "open" ? "Nice. New reports from the Report button on listings land here." : "Try another filter."} />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const offender = r.user_actioned >= 3;
            return (
              <article key={r.id} className={cx("bg-card border rounded-[var(--radius-md)] overflow-hidden", offender ? "border-danger/40" : "border-line")}>
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 border-b border-line bg-paper/50 text-[12.5px]">
                  <span className="num font-semibold">Report #{r.id}</span>
                  <StatusBadge status={r.status} />
                  <Badge tone={r.reason === "fraud" ? "danger" : "neutral"}>{REASON_LABEL[r.reason] ?? r.reason}</Badge>
                  {r.status === "open" ? <span>Waiting <Hours iso={r.created_at} /></span> : <span className="text-muted">Resolved {r.resolved_at ? formatDate(r.resolved_at) : ""}{r.resolver ? ` by ${r.resolver}` : ""}</span>}
                  {offender && <Badge tone="danger">Repeat offender</Badge>}
                </header>
                <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
                  <div className="p-4 text-[13px] border-b lg:border-b-0 lg:border-r border-line min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-1.5">What the reporter said</div>
                    <p className="text-ink">{r.details || <span className="text-muted">No details given.</span>}</p>
                    <div className="mt-2 text-xs text-muted">
                      By {r.reporter_id ? <Link className="underline" href={`/admin/users/${r.reporter_id}`}>{r.rp_name || formatPhone(r.rp_phone)}</Link> : "anonymous"} · {timeAgo(r.created_at)}
                      {r.reporter_reports > 3 && <span className="text-warn"> · has filed {r.reporter_reports} reports</span>}
                    </div>
                    {r.admin_note && <pre className="mt-3 p-2.5 bg-paper rounded-[var(--radius-sm)] text-[12px] text-ink-2 whitespace-pre-wrap font-sans">{r.admin_note}</pre>}
                  </div>
                  <div className="p-4 text-[13px] border-b lg:border-b-0 lg:border-r border-line min-w-0 space-y-3">
                    {r.listing_id ? (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-1">Listing</div>
                        <Link href={`/admin/listings/${r.listing_id}`} className="font-medium hover:underline line-clamp-2">#{r.listing_id} {r.l_title ?? "(deleted)"}</Link>
                        {r.l_status && <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted"><StatusBadge status={r.l_status} label={LISTING_STATUS_LABEL[r.l_status]} />{r.l_price != null && <span className="num">{priceText({ price: r.l_price, transaction_type: r.l_tx ?? "sell" })}</span>}<span>{r.l_city}</span><span>{r.listing_reports} report{r.listing_reports > 1 ? "s" : ""} on this listing</span></div>}
                      </div>
                    ) : null}
                    {r.reported_user_id ? (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-1">Reported user</div>
                        <Link href={`/admin/users/${r.reported_user_id}`} className="font-medium hover:underline">{r.ru_name || "Unnamed"}</Link> <span className="text-xs text-muted capitalize">{r.ru_role}</span>
                        <div className="text-xs text-muted num">{formatPhone(r.ru_phone)}</div>
                        <div className={cx("text-xs mt-1", offender ? "text-danger font-semibold" : "text-ink-2")}>{r.user_reports} report{r.user_reports > 1 ? "s" : ""} against this user · {r.user_actioned} actioned{r.ru_blocked ? " · already blocked" : ""}</div>
                      </div>
                    ) : null}
                  </div>
                  <div className="p-4">
                    <ActionForm action={resolveReport} className="space-y-2">
                      <input type="hidden" name="id" value={r.id} />
                      <textarea name="note" rows={2} aria-label="Admin note" placeholder={r.status === "open" ? "Note (optional): what you checked, call outcome…" : "Add a follow-up note"} className={cx(inputClass, "h-auto py-2 text-[13px]")} />
                      <FieldError name="note" />
                      <div className="flex flex-wrap gap-1.5">
                        {r.status === "open" && (
                          <>
                            {r.listing_id && r.l_status !== "removed" && <SubmitButton name="op" value="takedown" variant="danger" confirm="Take down this listing and close the report?">Take down listing</SubmitButton>}
                            {r.reported_user_id && !r.ru_blocked && <SubmitButton name="op" value="block" variant={offender ? "danger" : "secondary"} confirm="Block this user, pause all their listings and close the report?">Block user</SubmitButton>}
                            <SubmitButton name="op" value="action" variant="secondary">Mark actioned</SubmitButton>
                            <SubmitButton name="op" value="dismiss" variant="ghost">Dismiss</SubmitButton>
                          </>
                        )}
                        <SubmitButton name="op" value="note" variant="ghost">Add note</SubmitButton>
                      </div>
                    </ActionForm>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PER))} href={(p) => qs("/admin/reports", { ...params, page: p })} />
    </div>
  );
}
