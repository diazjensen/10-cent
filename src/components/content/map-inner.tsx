"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";

export type MapPoint = { lat: number; lng: number; label: string; active?: boolean };

function icon(label: string, active?: boolean) {
  const safe = label.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return L.divIcon({ className: "", html: `<span class="tc-pin${active ? " is-active" : ""}">${safe}</span>`, iconSize: [0, 0] });
}

export default function MapInner({ center, points, zoom = 14 }: { center: [number, number]; points: MapPoint[]; zoom?: number }) {
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="w-full h-full">
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points.map((p, i) => (
        <Marker key={i} position={[p.lat, p.lng]} icon={icon(p.active ? p.label : p.label.length > 22 ? p.label.slice(0, 21) + "…" : p.label, p.active)}>
          <Tooltip>{p.label}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
