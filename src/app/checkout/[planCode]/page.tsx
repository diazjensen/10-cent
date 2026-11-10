import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { HOME_STATE } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Breadcrumbs, Container, Notice } from "@/components/ui";
import { CheckoutForm } from "@/components/supply/checkout-form";
import { activePlan, getProfile } from "@/lib/supply/account";
import { getPlan } from "@/lib/supply/billing";

export async function generateMetadata({ params }: PageProps<"/checkout/[planCode]">): Promise<Metadata> {
  const { planCode } = await params;
  const p = await getPlan(planCode);
  return { title: p ? `Checkout: ${p.name}` : "Checkout", robots: { index: false } };
}

export default async function CheckoutPage({ params }: PageProps<"/checkout/[planCode]">) {
  const { planCode } = await params;
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/checkout/${planCode}`)}`);
  const plan = await getPlan(planCode);
  if (!plan) notFound();
  if (plan.price_paise === 0) redirect("/post-property");
  const profile = await getProfile(user.id);
  const cityState = profile?.city_id ? (await db.prepare("SELECT state FROM cities WHERE id = ?").get(profile.city_id) as { state: string } | undefined)?.state : undefined;
  const current = await activePlan(user.id);
  const features = plan.features ? (JSON.parse(plan.features) as string[]) : [];
  const role = user.role === "seeker" ? "owner" : user.role;
  const mismatch = role !== "admin" && plan.audience !== role;

  return (
    <Container className="py-8 md:py-10 max-w-5xl">
      <Breadcrumbs items={[{ label: "Plans", href: "/plans" }, { label: plan.name }]} />
      <h1 className="font-display text-4xl md:text-5xl mt-3">Checkout</h1>
      <p className="text-ink-2 mt-1 text-sm">{plan.name} · {plan.duration_days} days · {plan.listing_limit} active listings · {features.slice(1, 3).join(" · ")}</p>
      {mismatch && <Notice tone="warn" className="mt-4">This plan is for {plan.audience}s. Your account is {role === "owner" ? "an owner" : `a ${role}`} account. <Link href={`/plans#${role}`} className="underline">See {role} plans</Link>.</Notice>}
      {current && <Notice className="mt-4">You&apos;re on {current.name} until {formatDate(current.ends_at)}. {plan.name} will replace it from the moment you pay.</Notice>}
      <div className="mt-6">
        <CheckoutForm
          plan={{ code: plan.code, name: plan.name, price_paise: plan.price_paise }}
          defaults={{ name: profile?.company_name || user.name || "", gstin: profile?.gstin || "", state: cityState || HOME_STATE }}
        />
      </div>
    </Container>
  );
}
