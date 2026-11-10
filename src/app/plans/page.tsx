import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatINR } from "@/lib/format";
import { btnClass, Container, cx } from "@/components/ui";
import { activePlan } from "@/lib/supply/account";
import type { Plan } from "@/lib/supply/billing";

export const metadata: Metadata = {
  title: "Plans and pricing for owners, agents and builders",
  description: "Post up to 3 listings free. Paid plans add more listings, higher placement in search, verification and lead tools for agents and builders.",
};

const AUDIENCES = [
  { key: "owner", title: "Owners", sub: "Selling or renting out your own home or shop." },
  { key: "agent", title: "Agents", sub: "Brokers and channel partners managing many listings." },
  { key: "builder", title: "Builders", sub: "Developers promoting projects and collecting leads." },
] as const;

export default async function PlansPage() {
  const user = await getUser();
  const plans = await db.prepare("SELECT * FROM plans WHERE active = 1 ORDER BY sort").all() as Plan[];
  const current = user ? await activePlan(user.id) : null;
  const mine = user?.role === "agent" ? "agent" : user?.role === "builder" ? "builder" : user ? "owner" : null;

  return (
    <>
      <section className="border-b border-line">
        <Container className="py-12 md:py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Plans and pricing</p>
          <h1 className="font-display text-5xl md:text-6xl leading-[0.98] mt-2 max-w-3xl">Free to post. Pay only when you need more reach.</h1>
          <p className="text-ink-2 mt-4 max-w-2xl">Seekers never pay. Owners get 3 listings free; paid plans add listings, higher placement in search and tools for professionals. Prices exclude 18% GST.</p>
          <nav aria-label="Plans for" className="mt-6 flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <a key={a.key} href={`#${a.key}`} className={btnClass(mine === a.key ? "primary" : "secondary", "sm")}>For {a.title.toLowerCase()}</a>
            ))}
          </nav>
          {current && (
            <p className="mt-5 text-sm text-ink-2">You&apos;re on <b>{current.name}</b> until {formatDate(current.ends_at)}. Buying another plan replaces it from today.</p>
          )}
        </Container>
      </section>

      <Container className="py-10 md:py-14 space-y-16">
        {AUDIENCES.map((a) => {
          const list = plans.filter((p) => p.audience === a.key);
          return (
            <section key={a.key} id={a.key} className="scroll-mt-24" aria-labelledby={`h-${a.key}`}>
              <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
                <div>
                  <h2 id={`h-${a.key}`} className="font-display text-4xl">{a.title}</h2>
                  <p className="text-sm text-muted mt-1">{a.sub}</p>
                </div>
              </div>
              <div className={cx("grid gap-4", list.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2 max-w-4xl")}>
                {list.map((p) => {
                  const features = (p.features ? (JSON.parse(p.features) as string[]) : []);
                  const isCurrent = current?.plan_id === p.id;
                  const featured = ["owner_plus", "agent_pro", "builder_featured"].includes(p.code);
                  const free = p.price_paise === 0;
                  return (
                    <article key={p.id} className={cx("relative bg-card border rounded-[var(--radius-lg)] p-6 flex flex-col", featured ? "border-ink" : "border-line")}>
                      {featured && <span className="absolute -top-3 left-6 text-[10px] font-bold uppercase tracking-wider bg-ink text-white px-2 py-1 rounded-full">Most chosen</span>}
                      <h3 className="font-medium text-lg">{p.name}</h3>
                      <p className="mt-3 flex items-baseline gap-1.5">
                        <span className="num text-4xl font-semibold tracking-tight">{free ? "₹0" : `₹${formatINR(p.price_paise / 100)}`}</span>
                        <span className="text-sm text-muted">{free ? "forever" : `/ ${p.duration_days} days`}</span>
                      </p>
                      <p className="text-xs text-muted mt-1">{free ? "No card needed" : `+ GST · ₹${formatINR(Math.round(p.price_paise / 100 / p.duration_days))} a day`}</p>
                      <ul className="mt-5 space-y-2.5 text-sm text-ink-2 flex-1">
                        {features.map((f) => (
                          <li key={f} className="flex gap-2"><Check size={16} className="text-trust shrink-0 mt-0.5" aria-hidden />{f}</li>
                        ))}
                      </ul>
                      <div className="mt-6">
                        {isCurrent ? (
                          <span className={btnClass("secondary", "md", "w-full pointer-events-none")}>Your current plan</span>
                        ) : free ? (
                          <Link href="/post-property" className={btnClass("secondary", "md", "w-full")}>Post free</Link>
                        ) : (
                          <Link href={`/checkout/${p.code}`} className={btnClass(featured ? "accent" : "primary", "md", "w-full")}>Choose {p.name}</Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
              {a.key === "builder" && (
                <p className="text-sm text-ink-2 mt-4">Builder plans unlock the featured project slot (switch it on from <Link href="/dashboard/projects" className="underline underline-offset-2">Projects</Link>), the lead dashboard with CSV export and a CRM webhook.</p>
              )}
            </section>
          );
        })}

        <section className="grid md:grid-cols-3 gap-6 border-t border-line pt-10 text-sm">
          <div><h3 className="font-medium">How billing works</h3><p className="text-muted mt-1">Pay once per plan period by UPI, card or netbanking. No auto-renewal. A GST tax invoice is issued instantly.</p></div>
          <div><h3 className="font-medium">GST</h3><p className="text-muted mt-1">18% GST applies. Add your GSTIN at checkout to claim input tax credit. CGST + SGST within Karnataka, IGST elsewhere.</p></div>
          <div><h3 className="font-medium">Upgrades</h3><p className="text-muted mt-1">A new plan starts immediately and replaces the current one. Your listings get the new plan&apos;s ranking boost right away.</p></div>
        </section>
        <p className="text-xs text-muted">Prices shown are placeholders pending market research and may change before launch.</p>
      </Container>
    </>
  );
}
