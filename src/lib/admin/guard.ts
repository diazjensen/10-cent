import "server-only";
import { revalidatePath } from "next/cache";
import { getUser, can, clientIp, type User } from "@/lib/auth";
import { audit as writeAudit } from "@/lib/db";

/** Result shape every admin server action returns (rendered by <ActionForm>). */
export type ActionState = {
  ok?: string;
  error?: string;
  errors?: Record<string, string>;
  /** Increments on every response so the client can reset/close forms. */
  at?: number;
  data?: unknown;
};

export const NOT_ALLOWED: ActionState = { error: "You don't have permission to do this." };

/**
 * Server-side permission check for admin server actions and API routes.
 * Every admin mutation calls this first; the UI hiding a button is never enough.
 */
export async function staff(area: string): Promise<User | null> {
  const u = await getUser();
  return can(u, area) ? u : null;
}

export async function auditAs(u: User, action: string, entity: string, entityId: number | null, details?: unknown) {
  writeAudit(u.id, action, entity, entityId, details, await clientIp());
}

export function done(ok: string, data?: unknown): ActionState {
  revalidatePath("/admin", "layout");
  return { ok, at: Date.now(), data };
}

export function fail(error: string, errors?: Record<string, string>): ActionState {
  return { error, errors, at: Date.now() };
}

/** Collect zod issues into { field: message }. */
export function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "_");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const int = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === "") return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n) : NaN;
};
export const bool = (fd: FormData, k: string) => (fd.get(k) === "on" || fd.get(k) === "1" || fd.get(k) === "true" ? 1 : 0);
export const ids = (fd: FormData, k = "ids") =>
  fd.getAll(k).map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
