import { StaticPage, staticPageMetadata } from "@/components/content/static-page";

export function generateMetadata() {
  return staticPageMetadata("posting-policy");
}

export default function Page() {
  return <StaticPage slug="posting-policy" />;
}
