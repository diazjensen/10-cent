"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { listingAction, type ListingOp } from "@/app/dashboard/actions";
import { btnClass, cx } from "@/components/ui";

/** Row actions for a listing in My listings (PRD P5/P6). Every button calls a server action. */
export function ListingActions({ id, status, canRenew, txType, verificationRequested, verified }: { id: number; status: string; canRenew: boolean; txType: string; verificationRequested: boolean; verified: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [more, setMore] = useState(false);
  const router = useRouter();

  const run = (op: ListingOp, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setMore(false);
    start(async () => {
      const r = await listingAction(id, op);
      setMsg({ ok: r.ok, text: r.message });
      router.refresh();
    });
  };

  const closed = ["sold", "rented", "removed"].includes(status);
  const btn = btnClass("secondary", "sm", "h-8");

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-1.5 items-center">
        {canRenew && <button type="button" disabled={pending} onClick={() => run("renew")} className={btnClass("accent", "sm", "h-8")}>Renew</button>}
        {status === "live" && <button type="button" disabled={pending} onClick={() => run("pause")} className={btn}>Pause</button>}
        {status === "paused" && <button type="button" disabled={pending} onClick={() => run("unpause")} className={btnClass("primary", "sm", "h-8")}>Unpause</button>}
        {!closed && <Link href={`/dashboard/listings/${id}/edit`} className={btn}>Edit</Link>}
        {status === "live" && <Link href={`/property/${id}`} className={btnClass("ghost", "sm", "h-8")}>View</Link>}
        <div className="relative">
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} aria-label="More actions" className={btnClass("ghost", "sm", "h-8 w-8 px-0")}>
            <MoreHorizontal size={16} />
          </button>
          {more && (
            <div role="menu" className="absolute right-0 sm:left-0 sm:right-auto top-9 z-20 w-56 bg-card border border-line rounded-[var(--radius-md)] shadow-[var(--shadow-pop)] p-1">
              {!closed && (
                <MenuItem onClick={() => run(txType === "sell" ? "sold" : "rented", `Mark this listing as ${txType === "sell" ? "sold" : "rented"}? It will be removed from search.`)}>
                  Mark as {txType === "sell" ? "sold" : "rented"}
                </MenuItem>
              )}
              {!closed && !verified && !verificationRequested && ["live", "pending", "paused"].includes(status) && (
                <MenuItem onClick={() => run("verify")}>Request physical verification</MenuItem>
              )}
              <MenuItem danger onClick={() => run("delete", "Delete this listing permanently? Enquiries already received stay in your inbox.")}>Delete listing</MenuItem>
            </div>
          )}
        </div>
      </div>
      {msg && <p role="status" className={cx("text-xs", msg.ok ? "text-trust" : "text-danger")}>{msg.text}</p>}
    </div>
  );
}

function MenuItem({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={cx("w-full text-left px-3 py-2 text-sm rounded-[var(--radius-xs)] hover:bg-paper-2", danger ? "text-danger" : "text-ink")}>
      {children}
    </button>
  );
}
