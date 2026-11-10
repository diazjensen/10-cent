"use client";

import dynamic from "next/dynamic";

/** Leaflet map loaded client-only (Leaflet touches window on import). */
export const LocationMap = dynamic(() => import("./location-map-inner"), {
  ssr: false,
  loading: () => <div className="w-full h-full grid place-items-center text-sm text-muted bg-paper-2">Loading map…</div>,
});
