import Link from "next/link";
import { getCities } from "@/lib/listings";
import { Container } from "@/components/ui";

export default function CityNotFound() {
  const cities = getCities();
  return (
    <Container className="py-20 max-w-xl text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">404</p>
      <h1 className="font-display text-5xl mt-3">We&apos;re not in this city yet</h1>
      <p className="text-ink-2 mt-4">10cent currently lists property in these cities:</p>
      <ul className="mt-6 flex flex-wrap justify-center gap-2">
        {cities.map((c) => (
          <li key={c.slug}><Link href={`/property-in-${c.slug}`} className="inline-flex h-9 items-center px-3.5 rounded-full border border-line-2 bg-card text-sm hover:border-ink">{c.name}</Link></li>
        ))}
      </ul>
    </Container>
  );
}
