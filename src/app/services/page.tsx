import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Landmark, Truck, Sofa, FileSignature, Globe2 } from "lucide-react";
import { getUser } from "@/lib/auth";
import { SERVICES } from "@/lib/content/services";
import { registerServiceInterest } from "./actions";
import { InterestForm } from "@/components/content/service-forms";
import { Badge, Breadcrumbs, Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Home services: loans, movers, interiors, rental agreements",
  description: "Home loans, packers and movers, interiors, rental agreements and NRI property management through 10cent's vetted partners.",
  alternates: { canonical: "/services" },
};

const ICON = { "home-loan": Landmark, "packers-movers": Truck, interiors: Sofa, "rental-agreement": FileSignature, "nri-management": Globe2 } as const;

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  const sp = await searchParams;
  const u = await getUser();
  const me = u ? { name: u.name ?? "", phone: u.phone ?? "", email: u.email ?? "", city: "" } : null;
  const partner = SERVICES.filter((s) => !s.live);
  const initial = typeof sp.service === "string" && partner.some((s) => s.slug === sp.service) ? sp.service : undefined;
  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Services" }]} />
      <div className="mt-4 max-w-3xl">
        <h1 className="font-display text-[44px] md:text-[64px] leading-[1]">After you find the home.</h1>
        <p className="text-ink-2 mt-3 leading-relaxed">Loans, moving, interiors and paperwork through partners we&apos;ve checked: registered businesses, written quotes, and a 10cent contact if something goes wrong.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 border-t border-l border-line mt-8">
        {SERVICES.map((s) => {
          const Icon = ICON[s.slug];
          return (
            <Link key={s.slug} href={s.live ? `/services/${s.slug}` : `/services?service=${s.slug}#interest`} className="group bg-card border-r border-b border-line p-5 hover:bg-paper-2 flex flex-col min-h-[200px]">
              <div className="flex items-start justify-between">
                <span className="w-10 h-10 grid place-items-center rounded-full bg-accent-soft text-accent-ink"><Icon size={18} aria-hidden /></span>
                <ArrowUpRight size={16} className="text-muted group-hover:text-ink" aria-hidden />
              </div>
              <h2 className="mt-5 font-medium text-[17px]">{s.title}</h2>
              <p className="mt-1 text-sm text-muted leading-relaxed flex-1">{s.blurb}</p>
              <div className="mt-3">{s.live ? <Badge tone="trust">Available now</Badge> : <Badge>Partner onboarding</Badge>}</div>
            </Link>
          );
        })}
      </div>
      <section id="interest" className="mt-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_520px] gap-8 items-start scroll-mt-24">
        <div>
          <h2 className="font-display text-3xl">We&apos;re onboarding partners city by city.</h2>
          <p className="text-ink-2 mt-3 leading-relaxed max-w-xl">Packers and movers, interiors, rental agreements and NRI property management are being rolled out with local partners. Register your interest and we&apos;ll call you as soon as a partner in your city can take the job, usually within a week.</p>
          <ul className="mt-5 text-sm text-ink-2 space-y-2 max-w-xl">
            <li>· Partners are GST-registered and sign our service-quality agreement</li>
            <li>· You get an itemised written quote before any work starts</li>
            <li>· Payment goes to the partner directly; 10cent never asks for advance cash</li>
          </ul>
        </div>
        <div className="bg-card border border-line rounded-[var(--radius-md)] p-5 md:p-6">
          <InterestForm me={me} action={registerServiceInterest} services={partner.map((s) => ({ slug: s.slug, title: s.title }))} initial={initial} />
        </div>
      </section>
    </Container>
  );
}
