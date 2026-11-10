import { redirect } from "next/navigation";

export const metadata = { title: "Edit listing" };

/** Edit re-uses the post-property form. */
export default async function EditListing({ params }: PageProps<"/dashboard/listings/[id]/edit">) {
  const { id } = await params;
  redirect(`/post-property?edit=${encodeURIComponent(id)}`);
}
