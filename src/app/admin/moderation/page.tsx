import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db, addDays } from "@/lib/db";
import { getCities } from "@/lib/listings";
import { EmptyState } from "@/components/ui";
import { AdminHeader, FilterBar, FSelect } from "@/components/admin/ui";
import { ListingReview } from "@/components/admin/listing-review";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { SelectAll } from "@/components/admin/select-all";
import { bulkApprove } from "@/lib/admin/actions-listings";
import { ADMIN_LISTING_SELECT, type AdminListing } from "@/lib/admin/moderation";
import { SLA_HOURS } from "@/lib/admin/areas";

export const metadata: Metadata = { title: "Moderation queue" };

export default async function ModerationQueue({ searchParams }: PageProps<"/admin/moderation">) {
  await requireAdmin("moderation");
  const sp = await searchParams;
  const city = typeof sp.city === "string" ? sp.city : "";
  const flagged = sp.flagged === "1";
  const where = ["l.status = 'pending'"];
  const args: unknown[] = [];
  if (city) { where.push("c.slug = ?"); args.push(city); }
  if (flagged) where.push("(l.auto_flags LIKE '%\"duplicate\":true%' OR l.auto_flags LIKE '%\"priceOutlier\":true%' OR l.auto_flags LIKE '%\"imagesOk\":false%')");
  const rows = db.prepare(`${ADMIN_LISTING_SELECT} WHERE ${where.join(" AND ")} ORDER BY l.created_at ASC LIMIT 50`).all(...args) as AdminListing[];
  const total = (db.prepare("SELECT COUNT(*) n FROM listings WHERE status = 'pending'").get() as { n: number }).n;
  const over = (db.prepare("SELECT COUNT(*) n FROM listings WHERE status = 'pending' AND created_at < ?").get(addDays(-SLA_HOURS / 24)) as { n: number }).n;
  const today = (db.prepare("SELECT COUNT(*) n FROM moderation_logs WHERE action IN ('approved','rejected') AND created_at >= ?").get(new Date().toISOString().slice(0, 10)) as { n: number }).n;

  return (
    <div>
      <AdminHeader
        eyebrow="AD2 · Listings"
        title="Moderation queue"
        sub={`Oldest first. Every listing should be live or rejected within ${SLA_HOURS} hours of submission. Approving publishes it for 60 days and notifies the poster by SMS and email.`}
        actions={
          <div className="flex gap-4 text-[13px]">
            <span><strong className="num">{total}</strong> <span className="text-muted">pending</span></span>
            <span className={over ? "text-danger" : ""}><strong className="num">{over}</strong> <span className={over ? "" : "text-muted"}>over SLA</span></span>
            <span><strong className="num">{today}</strong> <span className="text-muted">reviewed today</span></span>
          </div>
        }
      />

      <FilterBar action="/admin/moderation" reset={!!(city || flagged)}>
        <FSelect label="City" name="city" defaultValue={city}>
          <option value="">All cities</option>
          {getCities().map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </FSelect>
        <FSelect label="Show" name="flagged" defaultValue={flagged ? "1" : ""}>
          <option value="">Everything</option>
          <option value="1">Only auto-flagged</option>
        </FSelect>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState title="Queue is clear" body={city || flagged ? "Nothing pending matches these filters." : "No listings are waiting for review. New submissions show up here instantly."} />
      ) : (
        <>
          <div className="sticky top-28 lg:top-16 z-20 -mx-1 px-1 py-2 mb-3 bg-paper/95 backdrop-blur flex flex-wrap items-center gap-3 border-b border-line">
            <SelectAll form="bulk-approve" label={`Select all ${rows.length}`} />
            <ActionForm action={bulkApprove} id="bulk-approve" inline className="flex items-center gap-3">
              <SubmitButton variant="trust" confirm="Approve every selected listing and notify the posters?" pendingLabel="Approving…">Approve selected</SubmitButton>
            </ActionForm>
            <span className="text-xs text-muted">Only bulk-approve listings whose checks are clean.</span>
          </div>
          <div className="space-y-4">
            {rows.map((l) => <ListingReview key={l.id} l={l} selectable />)}
          </div>
        </>
      )}
    </div>
  );
}
