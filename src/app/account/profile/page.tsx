import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getCities } from "@/lib/listings";
import { formatDate, formatPhone } from "@/lib/format";
import { updateProfile, deleteAccount } from "../actions";
import { AccountHeading } from "@/components/account/heading";
import { ProfileForm, DeleteAccountForm } from "@/components/account/profile-form";
import { btnClass } from "@/components/ui";

export const metadata: Metadata = { title: "Profile and privacy", robots: { index: false } };

const lakh = (n: number | null) => (n == null ? "" : n >= 1e7 ? `${+(n / 1e7).toFixed(2)}Cr` : n >= 1e5 ? `${+(n / 1e5).toFixed(2)}L` : String(n));

export default async function ProfilePage({ searchParams }: PageProps<"/account/profile">) {
  const sp = await searchParams;
  const welcome = sp.welcome === "1";
  const nextRaw = typeof sp.next === "string" ? sp.next : "/";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";
  const u = await requireUser(`/account/profile${welcome ? `?welcome=1&next=${encodeURIComponent(next)}` : ""}`);
  const cities = getCities();
  return (
    <>
      {welcome ? (
        <div className="mb-6 bg-ink text-white rounded-[var(--radius-md)] p-5 md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Welcome to 10cent</p>
          <h1 className="font-display text-4xl md:text-5xl leading-[1] mt-2">You&apos;re in. Tell us a little about yourself.</h1>
          <p className="text-white/70 text-sm mt-3 max-w-xl">Your name is shown to owners when you contact them. Cities and budget help us suggest better matches. You can skip this and fill it in later.</p>
          <Link href={next} className="inline-block mt-4 text-sm underline underline-offset-4 text-white/80 hover:text-white">Skip for now and continue</Link>
        </div>
      ) : (
        <AccountHeading title="Profile & privacy" sub={`Member since ${formatDate(u.created_at, { month: "long", year: "numeric" })}`} />
      )}
      <ProfileForm
        p={{ name: u.name ?? "", email: u.email ?? "", phone: u.phone ? formatPhone(u.phone) : "", is_nri: !!u.is_nri, cities: (u.preferred_cities ?? "").split(",").filter(Boolean), budget_min: lakh(u.budget_min), budget_max: lakh(u.budget_max), role: u.role }}
        allCities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
        action={updateProfile}
        welcome={welcome}
        next={next}
      />

      <section className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-line rounded-[var(--radius-md)] p-5">
          <h2 className="font-medium">Download my data</h2>
          <p className="text-sm text-muted mt-1">A JSON file with your profile, listings, shortlist, searches, enquiries, visits, notifications, reviews and payments.</p>
          <a href="/account/export" download className={btnClass("secondary", "sm", "mt-4")}><Download size={14} aria-hidden /> Download JSON</a>
        </div>
        <div className="bg-card border border-danger/30 rounded-[var(--radius-md)] p-5">
          <h2 className="font-medium text-danger">Delete my account</h2>
          <p className="text-sm text-muted mt-1 mb-4">
            Removes your name, phone and email, shortlist, saved searches, history, alerts and requirements, and takes down your listings.
            Invoices are kept for tax records without your contact details. This can&apos;t be undone.
          </p>
          <DeleteAccountForm action={deleteAccount} />
        </div>
      </section>
    </>
  );
}
