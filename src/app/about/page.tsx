import { StaticPage, staticPageMetadata } from "@/components/content/static-page";

export function generateMetadata() {
  return staticPageMetadata("about");
}

export default function Page() {
  return <StaticPage slug="about" />;
}
