"use client";

import dynamic from "next/dynamic";

/** Leaflet map pin picker, client-only (Leaflet touches window on import). */
export const MapPicker = dynamic(() => import("./map-picker-inner"), {
  ssr: false,
  loading: () => <div className="h-full w-full grid place-items-center text-sm text-muted bg-paper-2">Loading map…</div>,
});
