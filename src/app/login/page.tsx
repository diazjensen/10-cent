import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser, OTP_DEV_MODE } from "@/lib/auth";
import { Container } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in or sign up", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const intent = typeof sp.intent === "string" ? sp.intent : "";
  const error = typeof sp.error === "string" ? sp.error : "";
  const u = await getUser();
  if (u) redirect(next.startsWith("/") ? next : "/");
  return (
    <Container className="py-12 md:py-20">
      <div className="grid md:grid-cols-[1fr_420px] gap-12 items-start max-w-5xl mx-auto">
        <div className="hidden md:block pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">One account, every side of the deal</p>
          <h1 className="font-display text-6xl leading-[0.95] mt-3">Find it. List it.<br /><em>Close it.</em></h1>
          <ul className="mt-8 space-y-4 text-ink-2 max-w-md">
            <li className="flex gap-3"><span className="font-display text-2xl text-accent leading-none">01</span><span>Contact owners and agents directly. Numbers are only shared with signed-in users, so posters get fewer spam calls and you get faster replies.</span></li>
            <li className="flex gap-3"><span className="font-display text-2xl text-accent leading-none">02</span><span>Shortlist, compare up to 4 homes side by side, and get alerts when new matches are posted.</span></li>
            <li className="flex gap-3"><span className="font-display text-2xl text-accent leading-none">03</span><span>Owners post 3 listings free. No brokerage, ever, for seekers.</span></li>
          </ul>
        </div>
        <div className="bg-card border border-line rounded-[var(--radius-lg)] p-6 md:p-8">
          {error === "google" && <p role="alert" className="mb-4 text-sm text-warn bg-warn-soft rounded-[var(--radius-sm)] px-3 py-2">Google sign-in isn&apos;t configured yet. Please use your mobile number or email.</p>}
          <LoginForm next={next} intent={intent} devMode={OTP_DEV_MODE} />
        </div>
      </div>
    </Container>
  );
}
