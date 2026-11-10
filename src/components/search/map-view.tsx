"use client";

import dynamic from "next/dynamic";

/** Search results map (PRD S6/S7). Leaflet is loaded client-only. */
export const SearchMap = dynamic(() => import("./map-inner"), {
  ssr: false,
  loading: () => <div className="w-full h-full grid place-items-center text-sm text-muted bg-paper-2">Loading map…</div>,
});
