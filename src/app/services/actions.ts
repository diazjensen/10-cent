"use server";

import { z } from "zod";
import { getUser, normalizePhone, normalizeEmail, clientIp } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { formatINR, parseBudget } from "@/lib/format";
import { SERVICES } from "@/lib/content/services";

export type ServiceState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> };

const contact = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z.string().trim().transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" });
    return p ?? "";
  }),
  email: z.string().trim().max(120).transform((v, ctx) => {
    if (!v) return null;
    const e = normalizeEmail(v);
    if (!e) ctx.addIssue({ code: "custom", message: "Enter a valid email or leave it blank" });
    return e;
  }),
  city: z.string().trim().min(2, "Enter your city").max(60),
  consent: z.literal("on", { message: "Please agree to be contacted" }),
});

function superAdmin() {
  return db.prepare("SELECT id FROM users WHERE admin_role = 'super' AND deleted_at IS NULL ORDER BY id LIMIT 1").get() as { id: number } | undefined;
}

function issues(e: z.ZodError) {
  const fe: Record<string, string> = {};
  for (const i of e.issues) fe[String(i.path[0])] ??= i.message;
  return fe;
}

/** Service requests are stored as leads routed to the super admin until partner integrations go live. */
async function save(tag: string, d: { name: string; phone: string; email: string | null }, details: string): Promise<ServiceState> {
  const admin = superAdmin();
  if (!admin) return { error: "We couldn't route your request right now. Please email support@10cent.in." };
  const ip = await clientIp();
  if (!rateLimit(`svc:${ip}`, 8, 3600).ok || !rateLimit(`svc:p:${d.phone}`, 5, 86400).ok) return { error: "We've already received several requests from you. Our team will call you shortly." };
  const today = new Date().toISOString().slice(0, 10);
  const dup = db.prepare("SELECT id FROM leads WHERE listing_id IS NULL AND project_id IS NULL AND phone = ? AND message LIKE ? AND substr(created_at,1,10) = ?").get(d.phone, `${tag}%`, today);
  if (dup) return { ok: true, message: "We already have your request from today. An advisor will call you within one working day." };
  const u = await getUser();
  const message = `${tag} ${details}`;
  db.prepare("INSERT INTO leads (listing_id, project_id, seeker_id, poster_id, name, phone, email, message, channel, consent) VALUES (NULL, NULL, ?, ?, ?, ?, ?, ?, 'enquiry', 1)")
    .run(u?.id ?? null, admin.id, d.name, d.phone, d.email, message);
  notify(admin.id, { kind: "lead", title: `${tag.replace(/[[\]]/g, "")} request from ${d.name}`, body: `${d.phone}${d.email ? `, ${d.email}` : ""}. ${details}`, link: "/admin" }, ["email"]);
  return { ok: true };
}

const loanSchema = contact.extend({
  amount: z.string().trim().min(1, "Enter the loan amount you need"),
  income: z.string().trim().min(1, "Enter your monthly income"),
  employment: z.enum(["salaried", "self_employed", "nri"], { message: "Choose your employment type" }),
  property: z.enum(["identified", "searching", "construction", "balance_transfer"], { message: "Tell us where you are" }),
});

export async function applyHomeLoan(_prev: ServiceState, form: FormData): Promise<ServiceState> {
  const parsed = loanSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: issues(parsed.error) };
  const d = parsed.data;
  const amount = parseBudget(d.amount), income = parseBudget(d.income);
  const fe: Record<string, string> = {};
  if (!amount || amount < 1_00_000 || amount > 50_00_00_000) fe.amount = "Enter an amount between ₹1 L and ₹50 Cr, e.g. 75L";
  if (!income || income < 10_000) fe.income = "Enter your net monthly income, e.g. 120000";
  if (Object.keys(fe).length) return { fieldErrors: fe };
  const banks = form.getAll("banks").map(String).slice(0, 8);
  const status = { identified: "Property identified", searching: "Still searching", construction: "Self-construction", balance_transfer: "Balance transfer" }[d.property];
  const emp = { salaried: "Salaried", self_employed: "Self-employed", nri: "NRI" }[d.employment];
  const details = `Loan ₹${formatINR(amount!)} · income ₹${formatINR(income!)}/month · ${emp} · ${status} · ${d.city}${banks.length ? ` · prefers ${banks.join(", ")}` : ""}`;
  const r = await save("[Home loan]", d, details);
  return r.ok && !r.message ? { ok: true, message: `Thanks ${d.name.split(" ")[0]}. A 10cent loan advisor will call you on ${d.phone} within one working day with offers from partner banks.` } : r;
}

const interestSchema = contact.extend({
  service: z.string(),
  notes: z.string().trim().max(600, "Keep it under 600 characters"),
});

export async function registerServiceInterest(_prev: ServiceState, form: FormData): Promise<ServiceState> {
  const parsed = interestSchema.safeParse({ ...Object.fromEntries(form), notes: form.get("notes") ?? "" });
  if (!parsed.success) return { fieldErrors: issues(parsed.error) };
  const svc = SERVICES.find((s) => s.slug === parsed.data.service && !s.live);
  if (!svc) return { fieldErrors: { service: "Choose a service" } };
  const r = await save(svc.tag, parsed.data, `${parsed.data.city}${parsed.data.notes ? ` · ${parsed.data.notes}` : ""}`);
  return r.ok && !r.message ? { ok: true, message: `Noted. We're onboarding ${svc.title.toLowerCase()} partners in ${parsed.data.city} and will call you when one can take your job.` } : r;
}
