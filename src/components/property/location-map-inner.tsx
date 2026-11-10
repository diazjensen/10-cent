"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Tooltip, Circle } from "react-leaflet";
import type { Landmark } from "@/lib/seeker/search-params";

const KIND_LETTER: Record<string, string> = { metro: "M", school: "S", hospital: "H", mall: "R", it_park: "W", railway: "T", airport: "A" };

const homeIcon = L.divIcon({ className: "", html: '<span class="tc-pin is-active">Here</span>', iconSize: [0, 0] });
const lmIcon = (k: string) =>
  L.divIcon({
    className: "",
    html: `<span style="display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:#fff;border:1.5px solid #16181b;font:600 11px/1 var(--font-sans);color:#16181b;transform:translate(-50%,-50%)">${KIND_LETTER[k] ?? "•"}</span>`,
    iconSize: [0, 0],
  });

export default function LocationMapInner({ lat, lng, landmarks, approximate }: { lat: number; lng: number; landmarks: Landmark[]; approximate?: boolean }) {
  return (
    <MapContainer center={[lat, lng]} zoom={14} scrollWheelZoom={false} className="w-full h-full" attributionControl>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
      {approximate ? <Circle center={[lat, lng]} radius={400} pathOptions={{ color: "#d9481c", weight: 1.5, fillOpacity: 0.08 }} /> : null}
      <Marker position={[lat, lng]} icon={homeIcon} keyboard={false} />
      {landmarks.map((m) => (
        <Marker key={`${m.name}-${m.lat}-${m.lng}`} position={[m.lat, m.lng]} icon={lmIcon(m.kind)} title={m.name}>
          <Tooltip direction="top" offset={[0, -12]}>{m.name}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
