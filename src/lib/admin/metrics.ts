import "server-only";
import { db } from "@/lib/db";

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** List of YYYY-MM-DD strings from `from` to `to` inclusive. */
export function dayRange(from: string, to: string) {
  const out: string[] = [];
  const end = new Date(to + "T00:00:00Z");
  for (let d = new Date(from + "T00:00:00Z"); d <= end && out.length < 800; d = new Date(d.getTime() + 86400000)) out.push(dayKey(d));
  return out;
}

/** Fill a day -> value map into a continuous series. */
export function fillDays(rows: Array<{ day: string; v: number }>, from: string, to: string) {
  const m = new Map(rows.map((r) => [r.day, r.v]));
  return dayRange(from, to).map((d) => ({ day: d, v: m.get(d) ?? 0 }));
}

export function lastNDays(n: number) {
  const to = dayKey(new Date());
  const from = dayKey(new Date(Date.now() - (n - 1) * 86400000));
  return { from, to };
}

export const shortDay = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export async function count(sql: string, ...args: unknown[]) {
  return (await db.prepare(sql).get(...args) as { n: number | null }).n ?? 0;
}
