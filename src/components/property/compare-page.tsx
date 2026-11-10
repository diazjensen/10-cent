"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { removeCompare, useCompare } from "@/lib/seeker/local";

/** Removes a column from the comparison (URL and the device's compare tray). */
export function CompareRemove({ id, ids, title }: { id: number; ids: number[]; title: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        removeCompare(id);
        const rest = ids.filter((x) => x !== id);
        router.push(rest.length ? `/compare?ids=${rest.join(",")}` : "/compare");
      }}
      aria-label={`Remove ${title} from comparison`}
      className="absolute right-1.5 top-1.5 w-7 h-7 grid place-items-center rounded-full bg-white/95 shadow-sm hover:bg-white"
    >
      <X size={14} />
    </button>
  );
}

/** When /compare is opened without ids, load the device's compare tray. */
export function CompareFromStorage() {
  const list = useCompare();
  const router = useRouter();
  useEffect(() => {
    if (list.length) router.replace(`/compare?ids=${list.map((c) => c.id).join(",")}`);
  }, [list, router]);
  return null;
}
