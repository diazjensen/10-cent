"use client";

import { useActionState, useState } from "react";
import { requestOtpAction, verifyOtpAction, type OtpState } from "@/app/actions/auth";
import { Button, Input, Label, Notice, Select, cx } from "@/components/ui";

export function LoginForm({ next, intent, devMode }: { next: string; intent: string; devMode: boolean }) {
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [reqState, requestAction, requesting] = useActionState<OtpState, FormData>(requestOtpAction, { step: "start" });
  const [verState, verifyAction, verifying] = useActionState<OtpState, FormData>(verifyOtpAction, { step: "verify" });
  const [restart, setRestart] = useState(0);
  const step = reqState.step === "verify" && restart === 0 ? "verify" : "start";
  const target = reqState.target;

  return (
    <div>
      <h2 className="font-display text-3xl">{step === "start" ? "Log in or sign up" : "Enter the code"}</h2>
      <p className="text-sm text-muted mt-1">
        {step === "start" ? "We'll send a 6-digit code. No passwords." : <>Sent to <strong className="text-ink">{reqState.isEmail ? target : `+91 ${target}`}</strong>.{" "}
          <button type="button" className="underline underline-offset-2" onClick={() => setRestart((r) => r + 1)}>Change</button></>}
      </p>

      {step === "start" ? (
        <form action={(fd) => { setRestart(0); return requestAction(fd); }} className="mt-6 space-y-4">
          <div role="tablist" aria-label="Sign in method" className="grid grid-cols-2 p-1 bg-paper-2 rounded-[var(--radius-sm)] text-sm">
            {(["phone", "email"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cx("h-8 rounded-[var(--radius-xs)] font-medium", mode === m ? "bg-card shadow-sm" : "text-muted")}>
                {m === "phone" ? "Mobile number" : "Email"}
              </button>
            ))}
          </div>
          {mode === "phone" ? (
            <div>
              <Label htmlFor="target">Mobile number</Label>
              <div className="flex">
                <span className="h-10 px-3 grid place-items-center border border-r-0 border-line-2 rounded-l-[var(--radius-sm)] bg-paper-2 text-sm text-ink-2">+91</span>
                <Input id="target" name="target" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" required className="rounded-l-none" autoFocus />
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="target">Email address</Label>
              <Input id="target" name="target" type="email" autoComplete="email" placeholder="you@example.com" required autoFocus />
            </div>
          )}
          {reqState.error && <Notice tone="danger">{reqState.error}</Notice>}
          <Button type="submit" className="w-full" size="lg" disabled={requesting}>{requesting ? "Sending…" : "Send code"}</Button>
          <div className="relative text-center text-xs text-muted py-1"><span className="bg-card px-2 relative z-10">or</span><span className="absolute left-0 right-0 top-1/2 h-px bg-line" /></div>
          <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} className="w-full h-11 inline-flex items-center justify-center gap-2 border border-line-2 rounded-[var(--radius-sm)] text-sm font-medium hover:border-ink">
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continue with Google
          </a>
          <p className="text-[11px] text-muted leading-relaxed">By continuing you agree to our <a className="underline" href="/terms">Terms</a> and <a className="underline" href="/privacy">Privacy policy</a>, and consent to receive OTPs and enquiry updates on this number.</p>
        </form>
      ) : (
        <form action={verifyAction} className="mt-6 space-y-4">
          <input type="hidden" name="target" value={target} />
          <input type="hidden" name="next" value={next} />
          {devMode && reqState.devCode && (
            <Notice tone="warn">
              <strong>Test mode:</strong> no SMS provider is connected yet, so here is your code: <span className="num font-semibold tracking-widest">{reqState.devCode}</span>
            </Notice>
          )}
          <div>
            <Label htmlFor="code">6-digit code</Label>
            <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" placeholder="••••••" required autoFocus className="text-center text-lg tracking-[0.5em] num h-12" />
          </div>
          <details className="text-sm" open={intent === "post"}>
            <summary className="cursor-pointer text-ink-2">New to 10cent? Tell us who you are</summary>
            <div className="mt-3 grid gap-3">
              <div>
                <Label htmlFor="name">Your name</Label>
                <Input id="name" name="name" autoComplete="name" placeholder="Full name" />
              </div>
              <div>
                <Label htmlFor="role">I am</Label>
                <Select id="role" name="role" defaultValue={intent === "post" ? "owner" : "seeker"}>
                  <option value="seeker">Looking to buy or rent</option>
                  <option value="owner">A property owner</option>
                  <option value="agent">An agent / broker</option>
                  <option value="builder">A builder / developer</option>
                </Select>
              </div>
            </div>
          </details>
          {verState.error && <Notice tone="danger">{verState.error}</Notice>}
          <Button type="submit" className="w-full" size="lg" disabled={verifying}>{verifying ? "Verifying…" : "Verify and continue"}</Button>
        </form>
      )}
      {step === "verify" && (
        <form action={requestAction} className="mt-4 text-center">
          <input type="hidden" name="target" value={target} />
          <button type="submit" disabled={requesting} className="text-sm text-ink-2 underline underline-offset-2">{requesting ? "Sending…" : "Didn't get it? Resend code"}</button>
        </form>
      )}
    </div>
  );
}
