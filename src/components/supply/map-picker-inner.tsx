"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#d9481c;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 6px rgb(0 0 0 / .35)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

function ClickToSet({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onChange(e.latlng.lat, e.latlng.lng) });
  return null;
}

/** Re-centres the map only when the locality changes (centerKey), not on every pin move. */
function Recenter({ lat, lng, centerKey }: { lat: number; lng: number; centerKey: string }) {
  const map = useMap();
  const pos = useRef({ lat, lng });
  useEffect(() => {
    pos.current = { lat, lng };
  });
  useEffect(() => {
    map.setView([pos.current.lat, pos.current.lng], Math.max(map.getZoom(), 15));
  }, [centerKey, map]);
  return null;
}

export default function MapPickerInner({ lat, lng, centerKey, onChange }: { lat: number; lng: number; centerKey: string; onChange: (lat: number, lng: number) => void }) {
  return (
    <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} className="h-full w-full" attributionControl>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
      <ClickToSet onChange={onChange} />
      <Recenter centerKey={centerKey} lat={lat} lng={lng} />
      <Marker
        position={[lat, lng]}
        icon={pinIcon}
        draggable
        keyboard
        title="Property location. Drag to adjust."
        eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onChange(p.lat, p.lng); } }}
      />
    </MapContainer>
  );
}
