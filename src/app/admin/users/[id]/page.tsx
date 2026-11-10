import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { pgInt } from "@/lib/admin/guard";
import { formatPhone, formatDate, formatPaise, timeAgo } from "@/lib/format";
import { LISTING_STATUS_LABEL } from "@/lib/constants";
import { Badge, Breadcrumbs, Notice, inputClass, cx } from "@/components/ui";
import { AdminHeader, Panel, Table, Th, Td, EmptyRow, StatusBadge } from "@/components/admin/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/action-form";
import { setKyc, blockUser, unblockUser, setListingLimit } from "@/lib/admin/actions-users";
import { priceText } from "@/components/admin/listing-review";

export async function generateMetadata({ params }: PageProps<"/admin/users/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `User #${id}` };
}

type UserRow = { id: number; name: string | null; phone: string | null; email: string | null; role: string; admin_role: string | null; kyc_status: string; blocked: number; block_reason: string | null; is_nri: number; preferred_cities: string | null; free_listing_limit: number; created_at: string; last_login_at: string | null; deleted_at: string | null };
type Profile = { company_name: string | null; rera_number: string | null; experience_years: number | null; established_year: number | null; about: string | null; website: string | null; gstin: string | null; rating: number | null; rating_count: number; city_name: string | null };

export default async function UserDetail({ params }: PageProps<"/admin/users/[id]">) {
  const me = await requireAdmin("users");
  const { id } = await params;
  const u = await db.prepare("SELECT * FROM users WHERE id = ?").get(pgInt(id)) as UserRow | undefined;
  if (!u) notFound();
  const p = await db.prepare("SELECT pr.*, c.name city_name FROM profiles pr LEFT JOIN cities c ON c.id = pr.city_id WHERE user_id = ?").get(u.id) as Profile | undefined;
  const listings = await db.prepare("SELECT l.id, l.title, l.status, l.price, l.transaction_type, l.created_at, c.name city FROM listings l JOIN cities c ON c.id = l.city_id WHERE user_id = ? ORDER BY l.id DESC LIMIT 50").all(u.id) as { id: number; title: string; status: string; price: number; transaction_type: string; created_at: string; city: string }[];
  const leadsIn = await db.prepare("SELECT COUNT(*) n, SUM(status = 'spam') spam FROM leads WHERE poster_id = ?").get(u.id) as { n: number; spam: number | null };
  const leadsOut = await db.prepare("SELECT ld.id, ld.channel, ld.status, ld.created_at, ld.listing_id, l.title FROM leads ld LEFT JOIN listings l ON l.id = ld.listing_id WHERE ld.seeker_id = ? ORDER BY ld.id DESC LIMIT 15").all(u.id) as { id: number; channel: string; status: string; created_at: string; listing_id: number | null; title: string | null }[];
  const leadsOutN = (await db.prepare("SELECT COUNT(*) n, SUM(status='spam') spam FROM leads WHERE seeker_id = ?").get(u.id) as { n: number; spam: number | null });
  const reports = await db.prepare("SELECT r.id, r.reason, r.details, r.status, r.created_at, r.listing_id FROM reports r WHERE reported_user_id = ? ORDER BY r.id DESC").all(u.id) as { id: number; reason: string; details: string | null; status: string; created_at: string; listing_id: number | null }[];
  const orders = await db.prepare("SELECT o.id, o.status, o.total_paise, o.created_at, p.name plan, i.id invoice_id FROM orders o JOIN plans p ON p.id = o.plan_id LEFT JOIN invoices i ON i.order_id = o.id WHERE o.user_id = ? ORDER BY o.id DESC").all(u.id) as { id: number; status: string; total_paise: number; created_at: string; plan: string; invoice_id: number | null }[];
  const subs = await db.prepare("SELECT s.status, s.ends_at, p.name FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.user_id = ? ORDER BY s.id DESC LIMIT 5").all(u.id) as { status: string; ends_at: string; name: string }[];
  const actioned = reports.filter((r) => r.status === "actioned").length;
  const isStaff = u.role === "admin";

  return (
    <div>
      <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Users", href: "/admin/users" }, { label: u.name || `#${u.id}` }]} />
      <div className="mt-3" />
      <AdminHeader
        title={<>{u.name || "Unnamed user"} <span className="text-muted text-2xl num">#{u.id}</span></>}
        sub={<>{formatPhone(u.phone)}{u.email ? ` · ${u.email}` : ""} · joined {formatDate(u.created_at)} · {u.last_login_at ? `last seen ${timeAgo(u.last_login_at)}` : "never signed in"}</>}
        actions={<div className="flex flex-wrap gap-1.5"><Badge tone="ink">{u.role}{u.admin_role ? ` · ${u.admin_role}` : ""}</Badge>{u.blocked ? <Badge tone="danger">Blocked</Badge> : null}{u.is_nri ? <Badge>NRI</Badge> : null}{actioned >= 3 ? <Badge tone="danger">Repeat offender</Badge> : null}</div>}
      />
      {u.deleted_at && <Notice tone="warn" className="mb-4">This account was deleted on {formatDate(u.deleted_at)}.</Notice>}
      {u.blocked ? <Notice tone="danger" className="mb-4">Blocked: {u.block_reason}</Notice> : null}
      {actioned >= 3 && !u.blocked && <Notice tone="danger" className="mb-4">{actioned} reports against this user were actioned. Policy: repeat offenders should be blocked.</Notice>}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Panel title={`Listings (${listings.length})`} pad={false}>
            <Table className="border-0 rounded-none">
              <thead><tr><Th>ID</Th><Th>Title</Th><Th>Price</Th><Th>Status</Th><Th>Posted</Th></tr></thead>
              <tbody>
                {!listings.length && <EmptyRow cols={5}>No listings.</EmptyRow>}
                {listings.map((l) => (
                  <tr key={l.id}>
                    <Td className="num text-muted">#{l.id}</Td>
                    <Td className="max-w-[320px]"><Link href={`/admin/listings/${l.id}`} className="hover:underline line-clamp-1">{l.title}</Link><div className="text-xs text-muted">{l.city}</div></Td>
                    <Td className="num whitespace-nowrap">{priceText(l)}</Td>
                    <Td><StatusBadge status={l.status} label={LISTING_STATUS_LABEL[l.status]} /></Td>
                    <Td className="whitespace-nowrap text-muted">{timeAgo(l.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>

          <Panel title={`Reports against this user (${reports.length})`} pad={false}>
            <ul className="divide-y divide-line">
              {!reports.length && <li className="px-4 py-4 text-[13px] text-muted">No reports.</li>}
              {reports.map((r) => (
                <li key={r.id} className="px-4 py-2.5 text-[13px] flex justify-between gap-3">
                  <span><Link href={`/admin/reports?id=${r.id}`} className="font-medium hover:underline">#{r.id} {r.reason.replace(/_/g, " ")}</Link>{r.listing_id && <span className="text-muted"> on listing #{r.listing_id}</span>}{r.details && <span className="block text-muted">{r.details}</span>}</span>
                  <span className="whitespace-nowrap"><StatusBadge status={r.status} /> <span className="text-muted text-xs">{timeAgo(r.created_at)}</span></span>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="grid md:grid-cols-2 gap-4">
            <Panel title="Leads">
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <div><dt className="text-xs text-muted">Received as poster</dt><dd className="num text-lg font-semibold">{leadsIn.n}</dd><dd className="text-xs text-muted">{leadsIn.spam ?? 0} marked spam</dd></div>
                <div><dt className="text-xs text-muted">Sent as seeker</dt><dd className="num text-lg font-semibold">{leadsOutN.n}</dd><dd className={cx("text-xs", (leadsOutN.spam ?? 0) >= 3 ? "text-danger font-semibold" : "text-muted")}>{leadsOutN.spam ?? 0} marked spam by posters</dd></div>
              </dl>
              {leadsOut.length > 0 && (
                <ul className="mt-3 space-y-1 text-[12.5px]">
                  {leadsOut.map((l) => <li key={l.id} className="flex justify-between gap-2"><span className="truncate">{l.channel.replace("_", " ")} · {l.title ?? "project enquiry"}</span><span className="text-muted whitespace-nowrap">{l.status} · {timeAgo(l.created_at)}</span></li>)}
                </ul>
              )}
            </Panel>
            <Panel title="Orders & plans" pad={false}>
              <ul className="divide-y divide-line text-[13px]">
                {!orders.length && <li className="px-4 py-4 text-muted">No orders.</li>}
                {orders.map((o) => (
                  <li key={o.id} className="px-4 py-2.5 flex justify-between gap-2">
                    <span>#{o.id} {o.plan}<span className="block text-xs text-muted">{formatDate(o.created_at)}{o.invoice_id ? <> · <a className="underline" href={`/invoices/${o.invoice_id}`}>invoice</a></> : null}</span></span>
                    <span className="text-right"><span className="num">{formatPaise(o.total_paise)}</span><span className="block"><StatusBadge status={o.status} /></span></span>
                  </li>
                ))}
                {subs.map((s, i) => <li key={`s${i}`} className="px-4 py-2 text-xs text-muted">Subscription {s.name}: {s.status}, ends {formatDate(s.ends_at)}</li>)}
              </ul>
            </Panel>
          </div>
        </div>

        <div className="space-y-4">
          {p && (
            <Panel title="Profile">
              <dl className="space-y-1.5 text-[13px]">
                {([["Company", p.company_name], ["RERA no.", p.rera_number], ["City", p.city_name], ["Experience", p.experience_years ? `${p.experience_years} yrs` : null], ["Established", p.established_year], ["GSTIN", p.gstin], ["Website", p.website], ["Rating", p.rating ? `${p.rating.toFixed(1)} (${p.rating_count})` : null]] as const).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right break-all">{v}</dd></div>
                ))}
              </dl>
              {p.about && <p className="mt-2 text-[12.5px] text-ink-2 line-clamp-4">{p.about}</p>}
            </Panel>
          )}

          <Panel title="KYC & verification">
            <ActionForm action={setKyc} className="space-y-2.5">
              <input type="hidden" name="id" value={u.id} />
              <div className="text-[13px]">Current: <StatusBadge status={u.kyc_status === "verified" ? "verified" : u.kyc_status} /></div>
              <div className="grid grid-cols-2 gap-1.5 text-[13px]">
                {["none", "pending", "verified", "rejected"].map((k) => (
                  <label key={k} className="flex items-center gap-2 h-9 px-2.5 border border-line-2 rounded-[var(--radius-sm)] has-[:checked]:border-ink has-[:checked]:bg-paper capitalize cursor-pointer">
                    <input type="radio" name="kyc" value={k} defaultChecked={u.kyc_status === k} className="accent-[var(--color-ink)]" />{k}
                  </label>
                ))}
              </div>
              <input name="note" placeholder="Note (required when rejecting)" className={cx(inputClass, "h-9 text-[13px]")} />
              <FieldError name="note" />
              <SubmitButton>Update KYC</SubmitButton>
            </ActionForm>
          </Panel>

          <Panel title="Free listing limit">
            <ActionForm action={setListingLimit} className="flex items-start gap-2">
              <input type="hidden" name="id" value={u.id} />
              <div>
                <input name="limit" inputMode="numeric" defaultValue={u.free_listing_limit} aria-label="Free listing limit" className={cx(inputClass, "h-9 w-24 num")} />
                <FieldError name="limit" />
              </div>
              <SubmitButton variant="secondary" size="md" className="h-9">Save</SubmitButton>
            </ActionForm>
            <p className="text-xs text-muted mt-2">Active listings allowed without a paid plan. Default is 3.</p>
          </Panel>

          {!isStaff && (
            <Panel title={u.blocked ? "Unblock user" : "Block user"}>
              {u.blocked ? (
                <ActionForm action={unblockUser} className="space-y-2.5">
                  <input type="hidden" name="id" value={u.id} />
                  <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="restore" defaultChecked className="accent-[var(--color-ink)]" /> Put listings paused by the block back live</label>
                  <SubmitButton variant="trust" confirm="Unblock this user?">Unblock</SubmitButton>
                </ActionForm>
              ) : (
                <ActionForm action={blockUser} className="space-y-2.5">
                  <input type="hidden" name="id" value={u.id} />
                  <textarea name="reason" rows={2} placeholder="Reason, e.g. Asked seekers for token money before visits (reports #12, #19)" className={cx(inputClass, "h-auto py-2 text-[13px]")} />
                  <FieldError name="reason" />
                  <p className="text-xs text-muted">Blocking signs them out everywhere, stops OTP login and pauses their live listings.</p>
                  <SubmitButton variant="danger" confirm="Block this user, pause their listings and sign them out?">Block user</SubmitButton>
                </ActionForm>
              )}
            </Panel>
          )}
          {isStaff && can(me, "staff") && <p className="text-[13px] text-muted px-1">Staff account. Manage access on the <Link className="underline" href="/admin/staff">Staff & roles</Link> page.</p>}
        </div>
      </div>
    </div>
  );
}
