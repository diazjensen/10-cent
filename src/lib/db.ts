import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";

/**
 * Single SQLite database for the whole marketplace.
 * The schema mirrors PRD §6.3 so it can be ported to PostgreSQL/PostGIS later.
 * All money is stored in rupees (INTEGER) unless the column ends with _paise.
 * All timestamps are ISO strings (UTC).
 */

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, "10cent.db");


type GlobalWithDb = typeof globalThis & { __tcdb?: Database.Database };

function open(): Database.Database {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  return db;
}

export function getDb(): Database.Database {
  const g = globalThis as GlobalWithDb;
  if (!g.__tcdb) g.__tcdb = open();
  return g.__tcdb;
}

export const db = new Proxy({} as Database.Database, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

export const nowIso = () => new Date().toISOString();
export const addDays = (d: number, from = new Date()) =>
  new Date(from.getTime() + d * 86400000).toISOString();

/** Append-only admin audit trail (PRD AD9). */
export function audit(actorId: number | null, action: string, entity: string, entityId: number | null, details?: unknown, ip?: string) {
  db.prepare(
    "INSERT INTO audit_logs (actor_id, action, entity, entity_id, details, ip) VALUES (?,?,?,?,?,?)"
  ).run(actorId, action, entity, entityId, details === undefined ? null : JSON.stringify(details), ip ?? null);
}
