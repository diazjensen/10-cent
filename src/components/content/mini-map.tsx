"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "./map-inner";

const Inner = dynamic(() => import("./map-inner"), {
  ssr: false,
  loading: () => <div className="w-full h-full grid place-items-center text-xs text-muted">Loading map…</div>,
});

/** Small Leaflet map with labelled pins. Tiles may be blocked offline; pins still render. */
export function MiniMap({ center, points, zoom, className = "h-72" }: { center: [number, number]; points: MapPoint[]; zoom?: number; className?: string }) {
  return (
    <div className={`relative z-0 overflow-hidden rounded-[var(--radius-md)] border border-line bg-paper-2 ${className}`}>
      <Inner center={center} points={points} zoom={zoom} />
    </div>
  );
}
