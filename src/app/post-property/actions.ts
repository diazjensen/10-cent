"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { issuesToErrors, listingSchema, type ListingDraft } from "@/lib/supply/listing-schema";
import { saveListing } from "@/lib/supply/listing-service";

export type SubmitResult =
  | { ok: true; id: number; flagged: boolean }
  | { ok: false; errors: Record<string, string>; limit?: { used: number; limit: number }; needLogin?: boolean };

export async function submitListingAction(draft: ListingDraft, editId: number | null): Promise<SubmitResult> {
  const user = await getUser();
  if (!user) return { ok: false, needLogin: true, errors: { form: "Your session expired. Log in again; your draft is saved on this device." } };
  if (!(await rateLimit(`post:${user.id}`, 30, 3600)).ok) return { ok: false, errors: { form: "Too many submissions in the last hour. Please try again later." } };

  const parsed = listingSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, errors: issuesToErrors(parsed.error.issues) };

  const res = await saveListing(user, parsed.data, editId ? Number(editId) : null);
  if (!res.ok) return { ok: false, errors: res.errors, limit: res.limit };

  const f = res.flags;
  const flagged = f.duplicate || f.duplicateImages || f.priceOutlier || !f.phoneValid;
  await notify(
        user.id,
        {
          kind: "moderation",
          title: editId ? "Listing updated and sent for review" : "Listing submitted for review",
          body: `Listing #${res.id} will be reviewed within 24 hours.${f.contactInDescription ? " We removed phone numbers/emails from the description; buyers reach you through 10cent." : ""}`,
          link: `/dashboard/listings?highlight=${res.id}`,
        },
        ["sms", "email"]
      );
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  return { ok: true, id: res.id, flagged };
}
