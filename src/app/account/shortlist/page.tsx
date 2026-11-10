import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CARD_FROM, CARD_SELECT, type ListingCard as Card } from "@/lib/listings";
import { formatPrice, formatINR, timeAgo } from "@/lib/format";
import { LISTING_STATUS_LABEL } from "@/lib/constants";
import { removeShortlist, clearShortlist } from "../actions";
import { ListingCard } from "@/components/listing-card";
import { AccountHeading } from "@/components/account/heading";
import { ComparePicker } from "@/components/account/compare-picker";
import { EmptyState, btnClass } from "@/components/ui";

export const metadata: Metadata = { title: "My shortlist", robots: { index: false } };

export default async function ShortlistPage() {
  const u = await requireUser("/account/shortlist");
  const rows = await db.prepare(`SELECT ${CARD_SELECT}, s.created_at saved_at ${CARD_FROM} JOIN shortlists s ON s.listing_id = l.id AND s.user_id = ? ORDER BY s.created_at DESC`).all(u.id) as Array<Card & { saved_at: string }>;
  const live = rows.filter((r) => r.status === "live");
  const gone = rows.filter((r) => r.status !== "live");
  return (
    <>
      <AccountHeading title="Shortlist" sub={rows.length ? `${rows.length} saved home${rows.length === 1 ? "" : "s"}` : undefined}
        action={rows.length ? <form action={clearShortlist}><button className={btnClass("ghost", "sm")}>Clear all</button></form> : null} />
      {!rows.length ? (
        <EmptyState icon={<Heart size={18} />} title="Nothing shortlisted yet" body="Tap the heart on any listing to save it here. Your shortlist syncs across devices." action={<Link href="/search" className={btnClass("primary", "sm")}>Start searching</Link>} />
      ) : (
        <>
          {live.length >= 2 && <ComparePicker items={live.map((l) => ({ id: l.id, label: `${l.bhk ? `${l.bhk} BHK, ` : ""}${l.locality_name ?? l.city_name} · ${l.transaction_type === "sell" ? formatPrice(l.price, { short: true }) : `₹${formatINR(l.price)}`}` }))} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {live.map((l) => (
              <div key={l.id}>
                <ListingCard l={l} saved />
                <div className="flex items-center justify-between mt-1.5 px-1 text-xs text-muted">
                  <span>Saved {timeAgo(l.saved_at)}</span>
                  <form action={removeShortlist}><input type="hidden" name="listing_id" value={l.id} /><button className="inline-flex items-center gap-1 hover:text-danger"><Trash2 size={13} aria-hidden /> Remove</button></form>
                </div>
              </div>
            ))}
          </div>
          {gone.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-medium mb-2">No longer available</h2>
              <ul className="divide-y divide-line bg-card border border-line rounded-[var(--radius-md)]">
                {gone.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0 truncate text-ink-2">{l.title} <span className="text-muted">· {LISTING_STATUS_LABEL[l.status] ?? l.status}</span></span>
                    <form action={removeShortlist}><input type="hidden" name="listing_id" value={l.id} /><button className="text-xs text-muted hover:text-danger shrink-0">Remove</button></form>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
