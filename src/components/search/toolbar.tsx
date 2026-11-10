"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SORTS } from "@/lib/constants";
import { SuggestInput } from "@/components/search-box";
import { toQuery, type SearchParamsObj } from "@/lib/seeker/search-params";

/** Sort dropdown (PRD S6). */
export function SortSelect({ params }: { params: SearchParamsObj }) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-muted hidden sm:inline">Sort</span>
      <select
        aria-label="Sort results"
        value={params.sort ?? "relevance"}
        onChange={(e) => {
          const next = { ...params, sort: e.target.value === "relevance" ? undefined : e.target.value };
          router.push(`/search?${toQuery(next, ["page"])}`, { scroll: false });
        }}
        className="h-9 pl-2.5 pr-7 rounded-[var(--radius-sm)] border border-line-2 bg-card text-sm appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2316181b%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-no-repeat bg-[right_8px_center]"
      >
        {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </label>
  );
}

/** Locality / project / landmark search box that refines the current query (PRD S1). */
export function SearchBar({ params }: { params: SearchParamsObj }) {
  const router = useRouter();
  const [q, setQ] = useState(params.q ?? "");
  const base: SearchParamsObj = { ...params, page: undefined, q: undefined, loc: undefined, near: undefined, nearname: undefined, bounds: undefined };
  return (
    <form
      role="search"
      className="relative flex-1 min-w-0"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/search?${toQuery({ ...base, q: q.trim() || undefined })}`);
      }}
    >
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10" aria-hidden />
      <SuggestInput
        city={params.city}
        value={q}
        onChange={setQ}
        onPick={(s) => {
          if (s.href) { router.push(s.href); return; }
          setQ(s.kind === "locality" || s.kind === "city" ? "" : s.label);
          const extra = s.params ?? {};
          const next: SearchParamsObj = { ...base, ...extra };
          if (extra.near) next.nearname = s.label;
          router.push(`/search?${toQuery(next)}`);
        }}
        placeholder="Search locality, project, builder or landmark"
        inputClassName="w-full h-10 pl-9 pr-3 rounded-[var(--radius-sm)] bg-card border border-line-2 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
      />
    </form>
  );
}
