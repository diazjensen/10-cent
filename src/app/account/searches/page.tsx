import type { Metadata } from "next";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildSearchWhere, CARD_FROM, type SearchFilters } from "@/lib/listings";
import { describeSearch } from "@/lib/content/describe-search";
import { updateSavedSearch, deleteSavedSearch } from "../actions";
import { AccountHeading } from "@/components/account/heading";
import { SavedSearchRow } from "@/components/account/saved-search-row";
import { EmptyState, btnClass } from "@/components/ui";

export const metadata: Metadata = { title: "Saved searches and alerts", robots: { index: false } };

export default async function SearchesPage() {
  const u = await requireUser("/account/searches");
  const rows = await db.prepare("SELECT * FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC").all(u.id) as Array<{ id: number; name: string; query: string; channels: string; frequency: string; created_at: string }>;
  const cityNames = Object.fromEntries((await db.prepare("SELECT slug, name FROM cities").all() as Array<{ slug: string; name: string }>).map((c) => [c.slug, c.name]));
  const locNames = Object.fromEntries((await db.prepare("SELECT id, name FROM localities").all() as Array<{ id: number; name: string }>).map((l) => [l.id, l.name]));
  const count = async (query: string) => {
    const f = Object.fromEntries(new URLSearchParams(query)) as SearchFilters;
    const { where, args } = buildSearchWhere(f);
    return (await db.prepare(`SELECT COUNT(*) n ${CARD_FROM} WHERE ${where}`).get(...args) as { n: number }).n;
  };
  const counts = await Promise.all(rows.map((s) => count(s.query)));
  return (
    <>
      <AccountHeading title="Saved searches" sub="We check these for new matches and alert you on the channels you pick." />
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((s, i) => <SavedSearchRow key={s.id} s={s} chips={describeSearch(s.query, cityNames, locNames)} matches={counts[i]} update={updateSavedSearch} remove={deleteSavedSearch} />)}
        </ul>
      ) : (
        <EmptyState icon={<BellRing size={18} />} title="No saved searches" body="Run a search, then use “Save search” on the results page to get alerts when new listings match." action={<Link href="/search" className={btnClass("primary", "sm")}>Go to search</Link>} />
      )}
      <p className="text-xs text-muted mt-6">Channel delivery also depends on your <Link href="/account/notifications#prefs" className="underline">notification preferences</Link>.</p>
    </>
  );
}
