import type { Metadata } from "next";
import { nowMs } from "@/lib/admin/clock";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requireAdmin, can } from "@/lib/auth";
import { db, addDays } from "@/lib/db";
import { formatINR, formatPaise, timeAgo } from "@/lib/format";
import { LineChart, Notice } from "@/components/ui";
import { AdminHeader, Kpi, Panel } from "@/components/admin/ui";
import { count, fillDays, lastNDays, shortDay } from "@/lib/admin/metrics";
import { SLA_HOURS, NAV_AREAS } from "@/lib/admin/areas";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const user = await requireAdmin("dashboard");
  const sp = await searchParams;
  const { from, to } = lastNDays(30);
  const since7 = addDays(-7), since30 = addDays(-30);

  const live = await count("SELECT COUNT(*) n FROM listings WHERE status = 'live'");
  const pending = await count("SELECT COUNT(*) n FROM listings WHERE status = 'pending'");
  const oldest = await db.prepare("SELECT created_at FROM listings WHERE status = 'pending' ORDER BY created_at LIMIT 1").get() as { created_at: string } | undefined;
  const oldestH = oldest ? (nowMs() - new Date(oldest.created_at).getTime()) / 3600000 : 0;
  const overSla = await count("SELECT COUNT(*) n FROM listings WHERE status = 'pending' AND created_at < ?", addDays(-SLA_HOURS / 24));
  const openReports = await count("SELECT COUNT(*) n FROM reports WHERE status = 'open'");
  const oldestReport = await db.prepare("SELECT created_at FROM reports WHERE status = 'open' ORDER BY created_at LIMIT 1").get() as { created_at: string } | undefined;
  const verif = await count("SELECT COUNT(*) n FROM listings WHERE verification_requested_at IS NOT NULL AND verified = 0 AND status IN ('live','pending')");
  const users7 = await count("SELECT COUNT(*) n FROM users WHERE created_at >= ? AND deleted_at IS NULL", since7);
  const leads7 = await count("SELECT COUNT(*) n FROM leads WHERE created_at >= ?", since7);
  const leadsPrev7 = await count("SELECT COUNT(*) n FROM leads WHERE created_at >= ? AND created_at < ?", addDays(-14), since7);
  const rev30 = await count("SELECT SUM(total_paise) n FROM orders WHERE status = 'paid' AND paid_at >= ?", since30);
  const orders30 = await count("SELECT COUNT(*) n FROM orders WHERE status = 'paid' AND paid_at >= ?", since30);
  const queued = await count("SELECT COUNT(*) n FROM outbox WHERE status = 'queued'");

  const listingsSeries = fillDays(await db.prepare("SELECT substr(created_at,1,10) AS day, COUNT(*) v FROM listings WHERE substr(created_at,1,10) >= ? GROUP BY day").all(from) as Array<{ day: string; v: number }>, from, to);
  const leadsSeries = fillDays(await db.prepare("SELECT substr(created_at,1,10) AS day, COUNT(*) v FROM leads WHERE substr(created_at,1,10) >= ? GROUP BY day").all(from) as Array<{ day: string; v: number }>, from, to);
  const revSeries = fillDays(await db.prepare("SELECT substr(paid_at,1,10) AS day, SUM(total_paise) v FROM orders WHERE status = 'paid' AND substr(paid_at,1,10) >= ? GROUP BY day").all(from) as Array<{ day: string; v: number }>, from, to);
  const viewsSeries = fillDays(await db.prepare("SELECT day, SUM(views) v FROM listing_stats WHERE day >= ? GROUP BY day").all(from) as Array<{ day: string; v: number }>, from, to);

  const recent = can(user, "audit")
    ? (await db.prepare("SELECT a.action, a.entity, a.entity_id, a.created_at, u.name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 8").all() as Array<{ action: string; entity: string; entity_id: number | null; created_at: string; name: string | null }>)
    : [];

  const allow = (key: string) => can(user, NAV_AREAS[key]);
  const pts = (s: Array<{ day: string; v: number }>, div = 1) => s.map((p) => ({ x: shortDay(p.day), y: p.v / div }));
  const leadDelta = leadsPrev7 ? Math.round(((leads7 - leadsPrev7) / leadsPrev7) * 100) : null;

  return (
    <div>
      {sp.denied === "1" && (
        <Notice tone="warn" className="mb-5">
          Your role ({user.admin_role}) doesn&apos;t include that section. Ask a super admin if you need access.
        </Notice>
      )}
      <AdminHeader
        eyebrow={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${(user.name || "there").split(" ")[0]}`}
        sub="Marketplace health at a glance. Numbers are live from the database."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Live listings" value={formatINR(live)} href={allow("listings") ? "/admin/listings?status=live" : undefined} />
        <Kpi
          label="Pending moderation"
          value={pending}
          tone={overSla ? "danger" : pending ? "warn" : "trust"}
          href={allow("moderation") ? "/admin/moderation" : undefined}
          sub={oldest ? <>Oldest {oldestH < 1 ? `${Math.round(oldestH * 60)} min` : `${oldestH.toFixed(1)} h`} of {SLA_HOURS} h SLA{overSla ? ` · ${overSla} over` : ""}</> : "Queue is clear"}
        />
        <Kpi label="Open fraud reports" value={openReports} tone={openReports ? "warn" : "trust"} href={allow("reports") ? "/admin/reports" : undefined} sub={oldestReport ? `Oldest ${timeAgo(oldestReport.created_at)}` : "Nothing open"} />
        <Kpi label="Verification requests" value={verif} href={allow("verification") ? "/admin/verification" : undefined} sub="Field visits to schedule" />
        <Kpi label="New users · 7 days" value={formatINR(users7)} href={allow("users") ? "/admin/users?sort=new" : undefined} />
        <Kpi label="Leads · 7 days" value={formatINR(leads7)} sub={leadDelta == null ? "No prior week" : `${leadDelta >= 0 ? "+" : ""}${leadDelta}% vs previous 7 days`} href={allow("analytics") ? "/admin/analytics" : undefined} />
        <Kpi label="Revenue · 30 days" value={formatPaise(rev30).replace(/\.00$/, "")} sub={`${orders30} paid orders, incl. GST`} href={allow("billing") ? "/admin/billing" : undefined} />
        <Kpi label="Messages queued" value={queued} sub="SMS / email / WhatsApp / push" href={allow("outbox") ? "/admin/outbox" : undefined} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <Panel title="New listings per day · 30 days" action={<span className="num text-xs text-muted">{listingsSeries.reduce((a, b) => a + b.v, 0)} total</span>}>
          <LineChart points={pts(listingsSeries)} height={150} labelEvery={6} />
        </Panel>
        <Panel title="Leads per day · 30 days" action={<span className="num text-xs text-muted">{leadsSeries.reduce((a, b) => a + b.v, 0)} total</span>}>
          <LineChart points={pts(leadsSeries)} height={150} labelEvery={6} color="var(--color-accent)" />
        </Panel>
        <Panel title="Listing page views per day · 30 days" action={<span className="num text-xs text-muted">{formatINR(viewsSeries.reduce((a, b) => a + b.v, 0))} total</span>}>
          <LineChart points={pts(viewsSeries)} height={150} labelEvery={6} />
        </Panel>
        <Panel title="Revenue per day · 30 days (₹)" action={<span className="num text-xs text-muted">{formatPaise(rev30)}</span>}>
          <LineChart points={pts(revSeries, 100)} height={150} labelEvery={6} color="var(--color-trust)" format={(n) => `₹${formatINR(n)}`} />
        </Panel>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4 mt-6">
        <Panel title="Quick links" pad={false}>
          <ul className="divide-y divide-line">
            {[
              { k: "moderation", href: "/admin/moderation", label: "Review pending listings", sub: `${pending} waiting` },
              { k: "reports", href: "/admin/reports", label: "Work the fraud queue", sub: `${openReports} open` },
              { k: "verification", href: "/admin/verification", label: "Schedule verification visits", sub: `${verif} requested` },
              { k: "billing", href: "/admin/billing/coupons", label: "Create a coupon", sub: "Plans, coupons, refunds" },
              { k: "cms", href: "/admin/cms/new", label: "Write an article", sub: "News & guides" },
              { k: "banners", href: "/admin/banners", label: "Schedule a banner", sub: "Home, search, project pages" },
              { k: "outbox", href: "/admin/outbox", label: "See queued OTPs & messages", sub: `${queued} queued` },
              { k: "jobs", href: "/admin/jobs", label: "Run background jobs", sub: "Expiry, alerts, matches" },
            ].filter((q) => allow(q.k)).map((q) => (
              <li key={q.href}>
                <Link href={q.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper/60">
                  <span>
                    <span className="block text-sm font-medium">{q.label}</span>
                    <span className="block text-xs text-muted">{q.sub}</span>
                  </span>
                  <ArrowUpRight size={16} className="text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        {recent.length > 0 ? (
          <Panel title="Recent admin activity" action={<Link href="/admin/audit" className="text-xs text-accent-ink hover:underline">Audit log</Link>} pad={false}>
            <ul className="divide-y divide-line">
              {recent.map((r, i) => (
                <li key={i} className="px-4 py-2.5 text-[13px] flex justify-between gap-3">
                  <span className="min-w-0 truncate"><span className="font-medium">{r.name ?? "System"}</span> <span className="text-ink-2">{r.action}</span> <span className="text-muted">{r.entity}{r.entity_id ? ` #${r.entity_id}` : ""}</span></span>
                  <span className="text-muted whitespace-nowrap">{timeAgo(r.created_at)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <Panel title="Your access">
            <p className="text-sm text-ink-2">You are signed in as <strong>{user.admin_role}</strong>. The left menu shows the sections your role can open. Every action you take is recorded in the audit log.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}
