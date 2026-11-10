import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CARD_FROM, CARD_SELECT, type ListingCard as Card } from "@/lib/listings";
import { timeAgo } from "@/lib/format";
import { clearSeen } from "../actions";
import { ListingCard } from "@/components/listing-card";
import { AccountHeading } from "@/components/account/heading";
import { EmptyState, btnClass } from "@/components/ui";

export const metadata: Metadata = { title: "Recently seen", robots: { index: false } };

export default async function SeenPage() {
  const u = await requireUser("/account/seen");
  const rows = await db.prepare(`SELECT ${CARD_SELECT}, s.seen_at ${CARD_FROM} JOIN seen_listings s ON s.listing_id = l.id AND s.user_id = ? WHERE l.status = 'live' ORDER BY s.seen_at DESC LIMIT 60`).all(u.id) as Array<Card & { seen_at: string }>;
  const saved = new Set((await db.prepare("SELECT listing_id FROM shortlists WHERE user_id = ?").all(u.id) as { listing_id: number }[]).map((r) => r.listing_id));
  return (
    <>
      <AccountHeading title="Recently seen" sub="Listings you opened, newest first. Only live listings are shown."
        action={rows.length ? <form action={clearSeen}><button className={btnClass("ghost", "sm")}>Clear history</button></form> : null} />
      {rows.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((l) => (
            <div key={l.id}>
              <ListingCard l={l} saved={saved.has(l.id)} />
              <p className="text-xs text-muted mt-1.5 px-1">Viewed {timeAgo(l.seen_at)}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<History size={18} />} title="No viewing history" body="Listings you open while signed in appear here so you can find them again." action={<Link href="/search" className={btnClass("primary", "sm")}>Browse listings</Link>} />
      )}
    </>
  );
}
