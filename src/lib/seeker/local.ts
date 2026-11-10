"use client";

// Per-device seeker state kept in localStorage: compare tray (D9), recent searches and recently viewed (S9).
import { useSyncExternalStore } from "react";
import { COMPARE_MAX_SERVER } from "./compare-const";

export const COMPARE_MAX = COMPARE_MAX_SERVER;
const KEYS = { compare: "tc_compare", searches: "tc_recent_searches", viewed: "tc_recent_viewed" } as const;
const EVT = "tc-local-change";

export type CompareItem = { id: number; title: string; price: string; cover?: string | null };
export type RecentSearch = { q: string; label: string; at: number };
export type RecentView = { id: number; title: string; price: string; place: string; cover?: string | null; at: number };

function read<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(key: string, v: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full or blocked; non-critical */
  }
  cache.delete(key);
  window.dispatchEvent(new Event(EVT));
}

// useSyncExternalStore needs referentially stable snapshots.
const cache = new Map<string, { raw: string | null; val: unknown[] }>();
function snapshot<T>(key: string): T[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* ignore */ }
  const c = cache.get(key);
  if (c && c.raw === raw) return c.val as T[];
  const val = read<T>(key);
  cache.set(key, { raw, val });
  return val;
}
const EMPTY: never[] = [];
function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
}
function useLocal<T>(key: string): T[] {
  return useSyncExternalStore(subscribe, () => snapshot<T>(key), () => EMPTY as T[]);
}

export const useCompare = () => useLocal<CompareItem>(KEYS.compare);
export const useRecentSearches = () => useLocal<RecentSearch>(KEYS.searches);
export const useRecentViews = () => useLocal<RecentView>(KEYS.viewed);

/** Returns false when the tray is already full. */
export function toggleCompare(item: CompareItem): { ok: boolean; added: boolean } {
  const cur = read<CompareItem>(KEYS.compare);
  if (cur.some((c) => c.id === item.id)) {
    write(KEYS.compare, cur.filter((c) => c.id !== item.id));
    return { ok: true, added: false };
  }
  if (cur.length >= COMPARE_MAX) return { ok: false, added: false };
  write(KEYS.compare, [...cur, item]);
  return { ok: true, added: true };
}
export const removeCompare = (id: number) => write(KEYS.compare, read<CompareItem>(KEYS.compare).filter((c) => c.id !== id));
export const clearCompare = () => write(KEYS.compare, []);

export function pushRecentSearch(s: Omit<RecentSearch, "at">) {
  const cur = read<RecentSearch>(KEYS.searches).filter((r) => r.q !== s.q);
  write(KEYS.searches, [{ ...s, at: Date.now() }, ...cur].slice(0, 8));
}
export const clearRecentSearches = () => write(KEYS.searches, []);

export function pushRecentView(v: Omit<RecentView, "at">) {
  const cur = read<RecentView>(KEYS.viewed).filter((r) => r.id !== v.id);
  write(KEYS.viewed, [{ ...v, at: Date.now() }, ...cur].slice(0, 12));
}
export const clearRecentViews = () => write(KEYS.viewed, []);
