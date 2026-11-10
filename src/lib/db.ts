import "server-only";
import path from "node:path";
import { pgdb } from "./pg";

/**
 * Marketplace database: PostgreSQL (Supabase) via DATABASE_URL. See ./pg.ts for the API.
 * The schema lives in db/schema.sql (apply with `npm run migrate`, or via the Supabase SQL editor).
 * Timestamps are ISO-8601 UTC strings; booleans are 0/1 integers; money is whole rupees (or paise where named *_paise).
 */

export const DATA_DIR = path.join(process.cwd(), "data");
/** User uploads. Local disk for now; move to Supabase Storage / S3 behind a CDN for multi-instance hosting. */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(DATA_DIR, "uploads");

export const db = pgdb;

export const nowIso = () => new Date().toISOString();
export const addDays = (d: number, from = new Date()) =>
  new Date(from.getTime() + d * 86400000).toISOString();

/** Append-only admin audit trail (PRD AD9). */
export async function audit(actorId: number | null, action: string, entity: string, entityId: number | null, details?: unknown, ip?: string) {
  await db.prepare(
    "INSERT INTO audit_logs (actor_id, action, entity, entity_id, details, ip) VALUES (?,?,?,?,?,?)"
  ).run(actorId, action, entity, entityId, details === undefined ? null : JSON.stringify(details), ip ?? null);
}
