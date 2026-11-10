/* eslint-disable @typescript-eslint/no-explicit-any */
// PostgreSQL access layer (Supabase). Plain module (no "server-only") so scripts can import it.
//
// The API deliberately mirrors the better-sqlite3 shape the app was first written against:
//   await db.prepare("SELECT … WHERE id = ?").get(id)   // row | undefined
//   await db.prepare("SELECT …").all(a, b)              // row[]
//   await db.prepare("INSERT INTO …").run(a, b)         // { changes, lastInsertRowid }
//   await db.transaction(async () => { … })()           // BEGIN/COMMIT, nested calls join the transaction
// SQLite-style `?` placeholders are translated to $1, $2 …, LIKE becomes ILIKE (SQLite's LIKE is case-insensitive),
// and INSERTs into tables with an `id` column get RETURNING id so lastInsertRowid keeps working.
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, types, type PoolClient } from "pg";

types.setTypeParser(20, (v) => parseInt(v, 10)); // int8 (COUNT, BIGINT money) -> number
types.setTypeParser(1700, (v) => parseFloat(v)); // numeric (AVG, SUM) -> number

type G = typeof globalThis & { __tcpool?: Pool; __tcidtables?: Set<string> };

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add your Supabase connection string to .env.local (see .env.example).");
  const local = /@(localhost|127\.0\.0\.1)|host=\/|sslmode=disable/.test(url);
  return new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    ssl: local ? false : { rejectUnauthorized: false },
    idleTimeoutMillis: 30000,
  });
}

export function getPool(): Pool {
  const g = globalThis as G;
  return (g.__tcpool ??= makePool());
}

const txStore = new AsyncLocalStorage<PoolClient>();

async function exec(text: string, params: unknown[]) {
  // Postgres text rejects NUL bytes (SQLite stored them); strip them from user-supplied strings instead of 500ing.
  params = params.map((v) => (typeof v === "string" && v.includes("\u0000") ? v.replace(/\u0000/g, "") : v));
  const client = txStore.getStore();
  return client ? client.query(text, params as any[]) : getPool().query(text, params as any[]);
}

/** `?` -> `$n`, skipping quoted strings. */
export function translate(sql: string): string {
  let out = "", n = 0, q: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (q) { out += c; if (c === q) q = null; continue; }
    if (c === "'" || c === '"') { q = c; out += c; continue; }
    out += c === "?" ? `$${++n}` : c;
  }
  return out
    .replace(/\bLIKE\b/g, "ILIKE")
    // SQLite allows SUM(<boolean expr>) (booleans are 0/1); Postgres needs an int cast. Skips CASE expressions.
    .replace(/\bSUM\(\s*(?!CASE\b)([^()]*?(?:<>|>=|<=|!=|=|>|<|\bIS\s+(?:NOT\s+)?NULL)[^()]*?)\)/gi, (_m, e) => `SUM((${e.trim()})::int)`)
    // SQLite GROUP_CONCAT(x) / GROUP_CONCAT(DISTINCT x) -> string_agg
    .replace(/GROUP_CONCAT\(\s*(DISTINCT\s+)?([\w.]+)\s*\)/gi, (_m, d, col) => `string_agg(${d ?? ""}${col}::text, ',')`);
}

async function idTables(): Promise<Set<string>> {
  const g = globalThis as G;
  if (!g.__tcidtables) {
    const r = await getPool().query("SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'id'");
    g.__tcidtables = new Set(r.rows.map((x: any) => x.table_name));
  }
  return g.__tcidtables;
}

/** `@name` -> `$n` (better-sqlite3 named parameters). Returns the names in order of first use. */
function named(sql: string): { text: string; names: string[] } {
  const names: string[] = [];
  let out = "", q: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (q) { out += c; if (c === q) q = null; continue; }
    if (c === "'" || c === '"') { q = c; out += c; continue; }
    if (c === "@") {
      const m = /^@(\w+)/.exec(sql.slice(i));
      if (m) {
        let idx = names.indexOf(m[1]);
        if (idx < 0) { names.push(m[1]); idx = names.length - 1; }
        out += `$${idx + 1}`;
        i += m[0].length - 1;
        continue;
      }
    }
    out += c;
  }
  return { text: out, names };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

function flat(args: unknown[], names: string[]): unknown[] {
  if (names.length && args.length === 1 && isPlainObject(args[0])) {
    const o = args[0];
    return names.map((n) => (o[n] === undefined ? null : o[n]));
  }
  return args.length === 1 && Array.isArray(args[0]) ? (args[0] as unknown[]) : args;
}

export type RunResult = { changes: number; lastInsertRowid: number };

export interface Statement {
  get<T = any>(...args: unknown[]): Promise<T | undefined>;
  all<T = any>(...args: unknown[]): Promise<T[]>;
  run(...args: unknown[]): Promise<RunResult>;
}

function prepare(sql: string): Statement {
  const nm = /@\w+/.test(sql) ? named(sql) : { text: sql, names: [] as string[] };
  const text = translate(nm.text);
  const names = nm.names;
  return {
    async get(...args) {
      const r = await exec(text, flat(args, names));
      return r.rows[0];
    },
    async all(...args) {
      const r = await exec(text, flat(args, names));
      return r.rows;
    },
    async run(...args) {
      let t = text;
      let returning = false;
      const m = /^\s*INSERT\s+(?:OR\s+(IGNORE|REPLACE)\s+)?INTO\s+(\w+)/i.exec(t);
      if (m) {
        if (m[1]?.toUpperCase() === "REPLACE") throw new Error("INSERT OR REPLACE is not supported; use ON CONFLICT … DO UPDATE");
        if (m[1]) t = t.replace(/INSERT\s+OR\s+IGNORE/i, "INSERT") + (/ON\s+CONFLICT/i.test(t) ? "" : " ON CONFLICT DO NOTHING");
        if (!/\bRETURNING\b/i.test(t) && (await idTables()).has(m[2].toLowerCase())) { t += " RETURNING id"; returning = true; }
      }
      const r = await exec(t, flat(args, names));
      return { changes: r.rowCount ?? 0, lastInsertRowid: returning && r.rows[0] ? Number(r.rows[0].id) : 0 };
    },
  };
}

export interface Db {
  prepare(sql: string): Statement;
  exec(sql: string): Promise<void>;
  /** Returns a function that runs `fn` inside BEGIN/COMMIT (ROLLBACK on error). Nested db calls join it automatically. */
  transaction<A extends unknown[], R>(fn: (...a: A) => Promise<R> | R): (...a: A) => Promise<R>;
  end(): Promise<void>;
}

export const pgdb: Db = {
  prepare,
  async exec(sql) {
    await exec(sql, []);
  },
  transaction(fn) {
    return async (...a) => {
      if (txStore.getStore()) return fn(...a); // already inside a transaction
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        const result = await txStore.run(client, async () => fn(...a));
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    };
  },
  async end() {
    const g = globalThis as G;
    if (g.__tcpool) { await g.__tcpool.end(); g.__tcpool = undefined; }
  },
};
