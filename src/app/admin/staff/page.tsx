import type { Metadata } from "next";
import { nowMs } from "@/lib/admin/clock";
import Link from "next/link";
import { requireAdmin, ADMIN_PERMISSIONS } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatPhone, timeAgo } from "@/lib/format";
import { ADMIN_ROLES } from "@/lib/constants";
import { inputClass, cx } from "@/components/ui";
import { AdminHeader, Panel, Table, Th, Td } from "@/components/admin/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/action-form";
import { createStaff, changeStaffRole, revokeStaff } from "@/lib/admin/actions-users";

export const metadata: Metadata = { title: "Staff & roles" };

export default async function StaffPage() {
  const me = await requireAdmin("staff");
  const rows = db.prepare(`SELECT u.id, u.name, u.phone, u.email, u.admin_role, u.last_login_at,
      (SELECT COUNT(*) FROM audit_logs a WHERE a.actor_id = u.id AND a.created_at >= ?) actions30
    FROM users u WHERE u.role = 'admin' AND u.deleted_at IS NULL ORDER BY CASE u.admin_role WHEN 'super' THEN 0 WHEN 'moderator' THEN 1 WHEN 'support' THEN 2 WHEN 'sales' THEN 3 ELSE 4 END, u.id`)
    .all(new Date(nowMs() - 30 * 86400000).toISOString()) as { id: number; name: string | null; phone: string | null; email: string | null; admin_role: string; last_login_at: string | null; actions30: number }[];
  const areas = Object.keys(ADMIN_PERMISSIONS);

  return (
    <div>
      <AdminHeader eyebrow="AD1 · System" title="Staff & roles" sub="Add team members by mobile number and give each one role. Roles decide which admin sections they can open; changes apply on their next page load." />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Table>
            <thead><tr><Th>Member</Th><Th>Role</Th><Th className="text-right">Actions (30d)</Th><Th>Last seen</Th><Th className="text-right">Access</Th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <Td><Link href={`/admin/audit?actor=${s.id}`} className="font-medium hover:underline">{s.name || "Unnamed"}</Link>{s.id === me.id && <span className="text-xs text-muted"> (you)</span>}<div className="text-xs text-muted num">{formatPhone(s.phone)}{s.email ? ` · ${s.email}` : ""}</div></Td>
                  <Td>
                    {s.id === me.id ? <span className="capitalize font-medium">{s.admin_role}</span> : (
                      <ActionForm action={changeStaffRole} inline className="flex items-center gap-1.5 flex-wrap">
                        <input type="hidden" name="id" value={s.id} />
                        <select name="admin_role" defaultValue={s.admin_role} aria-label={`Role for ${s.name}`} className={cx(inputClass, "h-8 w-32 text-[13px] capitalize")}>
                          {ADMIN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <SubmitButton variant="secondary">Change</SubmitButton>
                      </ActionForm>
                    )}
                  </Td>
                  <Td className="text-right num">{s.actions30}</Td>
                  <Td className="whitespace-nowrap text-muted">{s.last_login_at ? timeAgo(s.last_login_at) : "never"}</Td>
                  <Td className="text-right">
                    {s.id !== me.id && (
                      <ActionForm action={revokeStaff} inline className="inline-flex flex-col items-end gap-1">
                        <input type="hidden" name="id" value={s.id} />
                        <SubmitButton variant="ghost" className="text-danger" confirm={`Revoke admin access for ${s.name ?? s.phone}? They will be signed out and become a regular user.`}>Revoke</SubmitButton>
                      </ActionForm>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Panel title="What each role can open" pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead><tr><th className="text-left px-4 py-2 text-muted font-medium">Area</th>{ADMIN_ROLES.map((r) => <th key={r} className="px-2 py-2 capitalize text-muted font-medium">{r}</th>)}</tr></thead>
                <tbody>
                  {[...areas, "jobs"].map((a) => (
                    <tr key={a} className="border-t border-line">
                      <td className="px-4 py-1.5 capitalize">{a}</td>
                      {ADMIN_ROLES.map((r) => {
                        const ok = (ADMIN_PERMISSIONS[a] ?? ["super"]).includes(r);
                        return <td key={r} className={cx("text-center", ok ? "text-trust font-semibold" : "text-line-2")}>{ok ? "Yes" : "–"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <Panel title="Add a staff member">
          <ActionForm action={createStaff} resetOnSuccess className="space-y-3">
            <label className="block text-[12.5px] font-medium text-ink-2">Mobile number
              <input name="phone" inputMode="numeric" placeholder="98765 43210" className={cx(inputClass, "mt-1 h-9")} required />
              <FieldError name="phone" />
            </label>
            <label className="block text-[12.5px] font-medium text-ink-2">Name
              <input name="name" placeholder="Full name" className={cx(inputClass, "mt-1 h-9")} />
            </label>
            <label className="block text-[12.5px] font-medium text-ink-2">Work email <span className="font-normal text-muted">(optional)</span>
              <input name="email" type="email" placeholder="name@10cent.in" className={cx(inputClass, "mt-1 h-9")} />
              <FieldError name="email" />
            </label>
            <label className="block text-[12.5px] font-medium text-ink-2">Role
              <select name="admin_role" defaultValue="moderator" className={cx(inputClass, "mt-1 h-9 capitalize")}>
                {ADMIN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <FieldError name="admin_role" />
            </label>
            <p className="text-xs text-muted">If the number already has a 10cent account it is promoted; otherwise a new account is created. They sign in with OTP as usual.</p>
            <SubmitButton size="md" pendingLabel="Adding…">Add staff member</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}
