import { StaticPage, staticPageMetadata } from "@/components/content/static-page";

export function generateMetadata() {
  return staticPageMetadata("privacy");
}

export default function Page() {
  return <StaticPage slug="privacy" />;
}
