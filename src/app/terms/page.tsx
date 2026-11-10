import { StaticPage, staticPageMetadata } from "@/components/content/static-page";

export function generateMetadata() {
  return staticPageMetadata("terms");
}

export default function Page() {
  return <StaticPage slug="terms" />;
}
