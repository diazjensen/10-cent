"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Megaphone } from "lucide-react";
import { toggleFeaturedAction } from "@/app/dashboard/projects/actions";
import { btnClass, cx } from "@/components/ui";

/** "Promote" control (PRD B6). Without a builder plan it links to builder plans. */
export function FeatureToggle({ id, featured, compact }: { id: number; featured: boolean; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; needPlan?: boolean } | null>(null);
  const router = useRouter();
  return (
    <div className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await toggleFeaturedAction(id);
            setMsg({ ok: r.ok, text: r.message, needPlan: !r.ok && r.message.includes("plan") });
            router.refresh();
          })
        }
        className={btnClass(featured ? "secondary" : "accent", compact ? "sm" : "md")}
      >
        <Megaphone size={15} aria-hidden /> {featured ? "Stop featuring" : "Promote"}
      </button>
      {msg && (
        <p role="status" className={cx("absolute right-0 top-full mt-1.5 w-64 text-xs bg-card border border-line rounded-[var(--radius-sm)] p-2.5 shadow-[var(--shadow-pop)] z-10", msg.ok ? "text-trust" : "text-danger")}>
          {msg.text}
          {msg.needPlan && <> <Link href="/plans#builder" className="underline font-medium">See builder plans</Link></>}
        </p>
      )}
    </div>
  );
}
