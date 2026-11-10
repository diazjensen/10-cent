import type { ReactNode } from "react";

export function AccountHeading({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="font-display text-4xl md:text-5xl leading-[1]">{title}</h1>
        {sub && <p className="text-sm text-muted mt-2">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
