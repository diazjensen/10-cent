import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCities } from "@/lib/listings";
import { Card, Notice } from "@/components/ui";
import { dashboardContext, getProfile } from "@/lib/supply/account";
import { PageTitle } from "@/components/supply/bits";
import { ProfileForm } from "@/components/supply/profile-form";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

export default async function ProfilePage() {
  const { subject, impersonating } = await dashboardContext("/dashboard/profile");
  const p = await getProfile(subject.id);
  const biz = subject.role === "agent" || subject.role === "builder";
  const live = (await db.prepare("SELECT COUNT(*) n FROM listings WHERE user_id = ? AND status = 'live'").get(subject.id) as { n: number }).n;
  const s = (v: unknown) => (v == null ? "" : String(v));
  return (
    <div className="max-w-3xl">
      <PageTitle
        eyebrow={biz ? "Shown publicly on your listings" : "Account"}
        title={biz ? "Business profile" : "Profile"}
        sub={biz ? "Seekers see your company, RERA number, experience and rating next to every listing." : "Your name appears on listings as the owner. Your number is only shared with signed-in seekers."}
      />
      {impersonating && <Notice tone="warn" className="mb-4">Read-only while viewing another user&apos;s dashboard.</Notice>}
      {biz && (
        <Card className="p-4 mb-6 grid grid-cols-3 gap-3 text-center">
          <div><p className="num text-2xl font-semibold">{live}</p><p className="text-xs text-muted">active listings</p></div>
          <div><p className="num text-2xl font-semibold">{(p as { rating?: number | null } | undefined)?.rating ?? "—"}</p><p className="text-xs text-muted">rating</p></div>
          <div><p className="num text-2xl font-semibold">{p?.experience_years ?? "—"}</p><p className="text-xs text-muted">years</p></div>
        </Card>
      )}
      <Card className="p-5 md:p-6">
        <ProfileForm
          readOnly={impersonating}
          role={subject.role}
          cities={(await getCities()).map((c) => ({ id: c.id, name: c.name }))}
          initial={{
            name: s(subject.name), email: s(subject.email), company_name: s(p?.company_name), rera_number: s(p?.rera_number),
            experience_years: s(p?.experience_years), established_year: s(p?.established_year), about: s(p?.about), website: s(p?.website),
            gstin: s(p?.gstin), city_id: s(p?.city_id),
          }}
        />
      </Card>
      <p className="text-xs text-muted mt-4">Mobile number: <span className="num">+91 {subject.phone ?? "not added"}</span>. To change your login number, contact <Link href="/report" className="underline">support</Link>.</p>
    </div>
  );
}
