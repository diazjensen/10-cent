"use server";

import { deliverLeadWebhook } from "@/lib/supply/webhook";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser, normalizePhone, normalizeEmail } from "@/lib/auth";
import { db, nowIso } from "@/lib/db";
import { notify } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { formatDate } from "@/lib/format";

export type LeadState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> };

type Channel = "enquiry" | "brochure" | "visit";

const base = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z.string().trim().transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" });
    return p ?? "";
  }),
  email: z.string().trim().max(120).optional().transform((v, ctx) => {
    if (!v) return null;
    const e = normalizeEmail(v);
    if (!e) ctx.addIssue({ code: "custom", message: "Enter a valid email or leave it blank" });
    return e;
  }),
  message: z.string().trim().max(1000, "Keep the message under 1,000 characters").optional(),
  consent: z.literal("on", { message: "Please agree to be contacted by the builder" }),
});

function issues(err: z.ZodError) {
  const fe: Record<string, string> = {};
  for (const i of err.issues) fe[String(i.path[0])] ??= i.message;
  return fe;
}

function loadProject(id: number) {
  return db.prepare("SELECT id, slug, name, builder_id, brochure_url FROM projects WHERE id = ? AND approved = 1").get(id) as
    | { id: number; slug: string; name: string; builder_id: number; brochure_url: string | null }
    | undefined;
}

/** Creates (or reuses today's) lead for a project and notifies the builder. Returns the lead id and whether it was new. */
function upsertLead(p: { id: number; name: string; builder_id: number; slug: string }, seekerId: number, channel: Channel, d: { name: string; phone: string; email: string | null; message?: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const dup = db.prepare("SELECT id FROM leads WHERE seeker_id = ? AND project_id = ? AND channel = ? AND substr(created_at,1,10) = ?").get(seekerId, p.id, channel, today) as { id: number } | undefined;
  if (dup) return { id: dup.id, fresh: false };
  const info = db.prepare("INSERT INTO leads (project_id, seeker_id, poster_id, name, phone, email, message, channel, consent) VALUES (?,?,?,?,?,?,?,?,1)")
    .run(p.id, seekerId, p.builder_id, d.name, d.phone, d.email, d.message || null, channel);
  const leadId = Number(info.lastInsertRowid);
  void deliverLeadWebhook(leadId);
  return { id: leadId, fresh: true };
}

async function guard(projectId: number) {
  const p = loadProject(projectId);
  if (!p) return { error: "This project is no longer available." } as const;
  const u = await getUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(`/projects/${p.slug}#enquire`)}`);
  if (u.id === p.builder_id) return { error: "This is your own project." } as const;
  if (!rateLimit(`plead:${u.id}`, 20, 3600).ok) return { error: "Too many requests. Please try again in a while." } as const;
  return { p, u } as const;
}

export async function projectEnquiry(projectId: number, _prev: LeadState, form: FormData): Promise<LeadState> {
  const g = await guard(projectId);
  if ("error" in g) return { error: g.error };
  const parsed = base.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: issues(parsed.error) };
  const d = parsed.data;
  if (!d.message || d.message.length < 5) return { fieldErrors: { message: "Tell the builder what you'd like to know" } };
  const r = upsertLead(g.p, g.u.id, "enquiry", d);
  if (r.fresh) {
    notify(g.p.builder_id, { kind: "lead", title: `New enquiry for ${g.p.name}`, body: `${d.name} (${d.phone}): ${d.message.slice(0, 140)}`, link: "/dashboard/responses" }, ["sms", "email"]);
  }
  revalidatePath("/account/contacted");
  return { ok: true, message: r.fresh ? `Sent. ${g.p.name}'s sales team will call you on ${d.phone}.` : "You already sent an enquiry for this project today. The builder has your details." };
}

export async function projectBrochure(projectId: number, _prev: LeadState, form: FormData): Promise<LeadState> {
  const g = await guard(projectId);
  if ("error" in g) return { error: g.error };
  const parsed = base.safeParse({ ...Object.fromEntries(form), message: undefined });
  if (!parsed.success) return { fieldErrors: issues(parsed.error) };
  const r = upsertLead(g.p, g.u.id, "brochure", { ...parsed.data, message: "Downloaded the brochure" });
  if (r.fresh) {
    notify(g.p.builder_id, { kind: "lead", title: `Brochure downloaded: ${g.p.name}`, body: `${parsed.data.name} (${parsed.data.phone}) downloaded the brochure.`, link: "/dashboard/responses" }, ["sms", "email"]);
  }
  revalidatePath("/account/contacted");
  const safe = g.p.brochure_url && /^(\/|https?:\/\/)/.test(g.p.brochure_url) ? g.p.brochure_url : `/projects/${g.p.slug}/brochure`;
  redirect(safe);
}

const SLOTS = ["10:00", "12:00", "15:00", "17:00"];

export async function projectVisit(projectId: number, _prev: LeadState, form: FormData): Promise<LeadState> {
  const g = await guard(projectId);
  if ("error" in g) return { error: g.error };
  const parsed = base.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: issues(parsed.error) };
  const date = String(form.get("date") ?? "");
  const slot = String(form.get("slot") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { fieldErrors: { date: "Pick a date" } };
  if (!SLOTS.includes(slot)) return { fieldErrors: { slot: "Pick a time slot" } };
  // Interpret date + slot as IST.
  const when = new Date(`${date}T${slot}:00+05:30`);
  const min = Date.now() + 2 * 3600_000, max = Date.now() + 60 * 86400_000;
  if (!(when.getTime() > min && when.getTime() < max)) return { fieldErrors: { date: "Choose a time at least 2 hours from now and within 60 days" } };
  const d = parsed.data;
  const msg = `Site visit on ${formatDate(when.toISOString(), { weekday: "short", day: "numeric", month: "short" })} at ${slot} IST${d.message ? `. ${d.message}` : ""}`;
  const r = upsertLead(g.p, g.u.id, "visit", { ...d, message: msg });
  const existing = db.prepare("SELECT id FROM visits WHERE lead_id = ?").get(r.id) as { id: number } | undefined;
  if (existing) {
    db.prepare("UPDATE visits SET scheduled_at = ?, status = 'requested' WHERE id = ?").run(when.toISOString(), existing.id);
    db.prepare("UPDATE leads SET message = ? WHERE id = ?").run(msg, r.id);
  } else {
    db.prepare("INSERT INTO visits (lead_id, project_id, seeker_id, scheduled_at, status, created_at) VALUES (?,?,?,?, 'requested', ?)").run(r.id, g.p.id, g.u.id, when.toISOString(), nowIso());
  }
  notify(g.p.builder_id, { kind: "visit", title: `${existing ? "Visit rescheduled" : "Site visit request"}: ${g.p.name}`, body: `${d.name} (${d.phone}) · ${msg}`, link: "/dashboard/responses" }, ["sms", "email"]);
  notify(g.u.id, { kind: "visit", title: `Visit requested at ${g.p.name}`, body: `${formatDate(when.toISOString(), { weekday: "short", day: "numeric", month: "short" })}, ${slot} IST. The builder will call to confirm.`, link: "/account/contacted" });
  revalidatePath("/account/contacted");
  return { ok: true, message: existing ? "Your visit request for today was updated with the new time." : "Visit requested. The builder will call to confirm the slot." };
}
