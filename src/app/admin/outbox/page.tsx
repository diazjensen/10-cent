import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { Badge, Notice } from "@/components/ui";
import { AdminHeader, FilterBar, FInput, FSelect, Table, Th, Td, EmptyRow, StatusBadge, Pager, qs } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { SelectAll } from "@/components/admin/select-all";
import { markOutboxSent } from "@/lib/admin/actions-system";

export const metadata: Metadata = { title: "Message outbox" };
const PER = 50;

export default async function OutboxPage({ searchParams }: PageProps<"/admin/outbox">) {
  await requireAdmin("outbox");
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const channel = s("channel"), status = s("status") || "queued", q = s("q"), kind = s("kind");
  const page = Math.max(1, Number(s("page")) || 1);
  const where = ["1=1"]; const args: unknown[] = [];
  if (channel) { where.push("channel = ?"); args.push(channel); }
  if (status !== "all") { where.push("status = ?"); args.push(status); }
  if (q) { where.push("(recipient LIKE ? OR body LIKE ?)"); args.push(`%${q.replace(/^\+?91/, "")}%`, `%${q}%`); }
  if (kind === "otp") where.push("body LIKE '%verification code%'");
  if (kind === "other") where.push("body NOT LIKE '%verification code%'");
  const total = (db.prepare(`SELECT COUNT(*) n FROM outbox WHERE ${where.join(" AND ")}`).get(...args) as { n: number }).n;
  const rows = db.prepare(`SELECT * FROM outbox WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ${PER} OFFSET ${(page - 1) * PER}`).all(...args) as { id: number; channel: string; recipient: string; subject: string | null; body: string; status: string; created_at: string }[];
  const byCh = db.prepare("SELECT channel, COUNT(*) n FROM outbox WHERE status = 'queued' GROUP BY channel").all() as { channel: string; n: number }[];
  const params = { channel, status, q, kind };

  return (
    <div>
      <AdminHeader
        eyebrow="System"
        title="Message outbox"
        sub="Every SMS, email, WhatsApp and push message the platform sends is queued here. Until provider keys (MSG91 / SES / WhatsApp Cloud / FCM) are configured, nothing leaves the building: support can read OTPs and notifications here and mark them handled."
        actions={<div className="flex flex-wrap gap-1.5">{byCh.map((c) => <Badge key={c.channel} tone="warn">{c.channel} {c.n}</Badge>)}</div>}
      />
      <Notice tone="warn" className="mb-4">OTPs are secrets. Only read one out to a user after confirming the request came from them.</Notice>
      <FilterBar action="/admin/outbox" reset={!!(channel || q || kind || status !== "queued")}>
        <FInput label="Recipient or text" name="q" defaultValue={q} className="w-52" placeholder="9876543210" />
        <FSelect label="Channel" name="channel" defaultValue={channel}>
          <option value="">All</option>
          {["sms", "email", "whatsapp", "push"].map((c) => <option key={c} value={c}>{c}</option>)}
        </FSelect>
        <FSelect label="Status" name="status" defaultValue={status}>
          <option value="queued">Queued</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="all">All</option>
        </FSelect>
        <FSelect label="Type" name="kind" defaultValue={kind}>
          <option value="">All</option><option value="otp">OTP codes</option><option value="other">Notifications</option>
        </FSelect>
      </FilterBar>

      {status === "queued" && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <SelectAll form="outbox-bulk" label="Select all on page" />
          <ActionForm action={markOutboxSent} id="outbox-bulk" inline className="flex items-center gap-2">
            <SubmitButton name="status" value="sent" variant="secondary">Mark selected sent</SubmitButton>
            <SubmitButton name="status" value="failed" variant="ghost">Mark failed</SubmitButton>
          </ActionForm>
        </div>
      )}

      <Table>
        <thead><tr><Th className="w-8"><span className="sr-only">Select</span></Th><Th>Queued</Th><Th>Channel</Th><Th>To</Th><Th>Message</Th><Th>Status</Th><Th className="text-right">Action</Th></tr></thead>
        <tbody>
          {!rows.length && <EmptyRow cols={7}>{status === "queued" ? "Nothing queued. New OTPs and notifications appear here instantly." : "No messages match."}</EmptyRow>}
          {rows.map((m) => {
            const otp = m.body.match(/^(\d{6}) is your 10cent verification code/);
            return (
              <tr key={m.id} className="align-top">
                <Td>{m.status === "queued" && <input type="checkbox" name="ids" value={m.id} form="outbox-bulk" aria-label={`Select message ${m.id}`} className="w-4 h-4 accent-[var(--color-ink)]" />}</Td>
                <Td className="whitespace-nowrap text-muted">{timeAgo(m.created_at)}<div className="num text-[11px]">#{m.id}</div></Td>
                <Td><Badge tone={m.channel === "sms" ? "ink" : "neutral"}>{m.channel}</Badge></Td>
                <Td className="num whitespace-nowrap">{m.recipient}</Td>
                <Td className="max-w-[520px]">
                  {otp ? (
                    <div><span className="text-xs text-muted">OTP</span> <span className="num font-mono text-lg font-semibold tracking-[0.2em] text-accent-ink">{otp[1]}</span></div>
                  ) : (
                    <>
                      {m.subject && <div className="font-medium">{m.subject}</div>}
                      <div className="text-ink-2 text-[12.5px] line-clamp-3">{m.body}</div>
                    </>
                  )}
                </Td>
                <Td><StatusBadge status={m.status} /></Td>
                <Td className="text-right">
                  {m.status === "queued" && (
                    <ActionForm action={markOutboxSent} inline notice="none" className="inline">
                      <input type="hidden" name="ids" value={m.id} />
                      <SubmitButton name="status" value="sent" variant="ghost">Mark sent</SubmitButton>
                    </ActionForm>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PER))} href={(p) => qs("/admin/outbox", { ...params, page: p })} />
    </div>
  );
}
