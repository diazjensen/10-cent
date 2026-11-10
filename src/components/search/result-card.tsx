import type { ListingCard as Card } from "@/lib/listings";
import { ListingCard, priceLabel } from "@/components/listing-card";
import { CompareToggle } from "@/components/property/compare-ui";
import { listingHeadline } from "@/lib/format";

/** Shared listing card plus an "Add to compare" control over the photo (PRD D9). */
export function ResultCard({ l, saved }: { l: Card; saved: boolean }) {
  return (
    <div className="relative">
      <ListingCard l={l} saved={saved} />
      <div className="absolute inset-x-0 top-0 aspect-[4/3] pointer-events-none">
        <div className="absolute right-2.5 bottom-2.5 pointer-events-auto">
          <CompareToggle variant="overlay" item={{ id: l.id, title: listingHeadline(l), price: `${priceLabel(l)}${l.transaction_type === "sell" ? "" : "/mo"}`, cover: l.cover_url }} />
        </div>
      </div>
    </div>
  );
}
