import { StaticPage, staticPageMetadata } from "@/components/content/static-page";

/** CMS pages created in Admin > CMS > Pages that don't have a dedicated route (about/terms/privacy/posting-policy do). */
export async function generateMetadata({ params }: PageProps<"/info/[slug]">) {
  const { slug } = await params;
  return staticPageMetadata(slug);
}

export default async function Page({ params }: PageProps<"/info/[slug]">) {
  const { slug } = await params;
  return <StaticPage slug={slug} />;
}
