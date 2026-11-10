"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker, Popup, Circle, Rectangle, useMap, useMapEvents } from "react-leaflet";
import { Crosshair, Square, X } from "lucide-react";
import { toQuery, type SearchParamsObj } from "@/lib/seeker/search-params";
import { cx } from "@/components/ui";

export type Pin = { id: number; lat: number; lng: number; price: number; label: string; title: string; place: string; cover: string | null };

const pinIcon = (label: string, active: boolean) =>
  L.divIcon({ className: "", html: `<span class="tc-pin${active ? " is-active" : ""}">${label.replace(/[<>&]/g, "")}</span>`, iconSize: [0, 0] });

function parseBounds(s?: string): L.LatLngBoundsExpression | null {
  const b = (s || "").split(",").map(Number);
  return b.length === 4 && b.every(Number.isFinite) ? [[b[0], b[1]], [b[2], b[3]]] : null;
}
const fmt = (n: number) => n.toFixed(5);
const boundsParam = (b: L.LatLngBounds) => [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map(fmt).join(",");

function FitOnce({ pins, bounds, center, near }: { pins: Pin[]; bounds: L.LatLngBoundsExpression | null; center: [number, number]; near: [number, number, number] | null }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (bounds) map.fitBounds(bounds, { padding: [8, 8] });
    else if (near) map.fitBounds(L.latLng(near[0], near[1]).toBounds(near[2] * 2000 + 400));
    else if (pins.length) map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [30, 30], maxZoom: 15 });
    else map.setView(center, 11);
  }, [map, pins, bounds, center, near]);
  return null;
}

/** Tracks user-initiated pans/zooms so "Search this area" only appears after the user moves the map. */
function MoveWatcher({ onMoved }: { onMoved: (b: L.LatLngBounds) => void }) {
  const ready = useRef(false);
  const map = useMapEvents({
    moveend: () => { if (ready.current) onMoved(map.getBounds()); },
  });
  useEffect(() => {
    const t = setTimeout(() => { ready.current = true; }, 800);
    return () => clearTimeout(t);
  }, []);
  return null;
}

/** Drag a rectangle on the map to search inside it (PRD S7). Uses pointer events so it works with touch too. */
function DrawRect({ active, onDone }: { active: boolean; onDone: (b: L.LatLngBounds) => void }) {
  const map = useMap();
  const [rect, setRect] = useState<L.LatLngBounds | null>(null);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);
  useEffect(() => {
    if (!active) return;
    const el = map.getContainer();
    map.dragging.disable();
    map.boxZoom.disable();
    el.style.cursor = "crosshair";
    el.style.touchAction = "none";
    let start: L.LatLng | null = null;
    const ll = (e: PointerEvent) => map.mouseEventToLatLng(e as unknown as MouseEvent);
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest(".leaflet-control")) return;
      start = ll(e);
      el.setPointerCapture(e.pointerId);
      setRect(L.latLngBounds(start, start));
    };
    const move = (e: PointerEvent) => { if (start) setRect(L.latLngBounds(start, ll(e))); };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const b = L.latLngBounds(start, ll(e));
      start = null;
      const sz = map.latLngToContainerPoint(b.getNorthEast()).subtract(map.latLngToContainerPoint(b.getSouthWest()));
      if (Math.abs(sz.x) > 12 && Math.abs(sz.y) > 12) doneRef.current(b);
      else setRect(null);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      setRect(null);
      map.dragging.enable();
      map.boxZoom.enable();
      el.style.cursor = "";
      el.style.touchAction = "";
    };
  }, [active, map]);
  return rect ? <Rectangle bounds={rect} pathOptions={{ color: "#d9481c", weight: 2, dashArray: "4 4", fillOpacity: 0.08 }} /> : null;
}

const clusterIcon = (n: number, label: string) =>
  L.divIcon({
    className: "",
    html: `<span title="from ${label.replace(/[<>&"]/g, "")}" style="display:grid;place-items:center;min-width:34px;height:34px;padding:0 6px;border-radius:999px;background:#fff;color:#16181b;border:2px solid #16181b;font:600 12px/1 var(--font-sans);box-shadow:0 2px 6px rgb(0 0 0/.25);transform:translate(-50%,-50%)">${n}</span>`,
    iconSize: [0, 0],
  });

/**
 * Price pins with simple screen-space clustering: pins closer than ~80×36 px are merged into a
 * "N homes" marker that zooms in on click, so dense localities stay readable.
 */
function PinLayer({ pins, active, setActive }: { pins: Pin[]; active: number | null; setActive: (id: number | null) => void }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const groups = useMemo(() => {
    const cells = new Map<string, Pin[]>();
    for (const p of pins) {
      const pt = map.project([p.lat, p.lng], zoom);
      const key = zoom >= 17 ? `p${p.id}` : `${Math.floor(pt.x / 96)}:${Math.floor(pt.y / 44)}`;
      cells.set(key, [...(cells.get(key) ?? []), p]);
    }
    return [...cells.values()];
  }, [pins, zoom, map]);
  return (
    <>
      {groups.map((g) => {
        if (g.length > 1) {
          const lat = g.reduce((s, p) => s + p.lat, 0) / g.length, lng = g.reduce((s, p) => s + p.lng, 0) / g.length;
          const cheapest = g.reduce((a, b) => (a.price <= b.price ? a : b));
          return (
            <Marker key={`c-${g[0].id}-${g.length}`} position={[lat, lng]} icon={clusterIcon(g.length, cheapest.label)} title={`${g.length} properties from ${cheapest.label}. Click to zoom in`}
              eventHandlers={{ click: () => map.fitBounds(L.latLngBounds(g.map((p) => [p.lat, p.lng] as [number, number])).pad(0.3), { maxZoom: 18 }) }} />
          );
        }
        const p = g[0];
        return (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p.label, active === p.id)} eventHandlers={{ click: () => setActive(p.id), popupclose: () => setActive(null) }} title={p.title}>
            <Popup closeButton={false} offset={[0, -18]} minWidth={220} maxWidth={240}>
              <Link href={`/property/${p.id}`} className="flex gap-2 text-ink! no-underline">
                {p.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover} alt="" className="w-16 h-14 object-cover rounded bg-paper-2 shrink-0" />
                ) : null}
                <span className="min-w-0 text-xs leading-snug">
                  <strong className="num block text-sm">{p.label}</strong>
                  <span className="block line-clamp-2">{p.title}</span>
                  <span className="block text-muted truncate">{p.place}</span>
                </span>
              </Link>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export default function SearchMapInner({ pins, params, center, total }: { pins: Pin[]; params: SearchParamsObj; center: [number, number]; total: number }) {
  const router = useRouter();
  const [moved, setMoved] = useState<L.LatLngBounds | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const bounds = useMemo(() => parseBounds(params.bounds), [params.bounds]);
  const near = useMemo(() => {
    const n = (params.near || "").split(",").map(Number);
    return n.length === 3 && n.every(Number.isFinite) ? (n as [number, number, number]) : null;
  }, [params.near]);

  const go = (b: L.LatLngBounds) => {
    const next: SearchParamsObj = { ...params, bounds: boundsParam(b), near: undefined, nearname: undefined, page: undefined, view: "map" };
    setMoved(null);
    setDrawing(false);
    router.push(`/search?${toQuery(next)}`, { scroll: false });
  };
  const clearArea = () => router.push(`/search?${toQuery({ ...params, bounds: undefined, page: undefined, view: "map" })}`, { scroll: false });

  return (
    <div className="relative w-full h-full">
      <MapContainer center={center} zoom={11} className="w-full h-full" scrollWheelZoom>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
        <FitOnce pins={pins} bounds={bounds} center={center} near={near} />
        <MoveWatcher onMoved={(b) => { if (!drawing) setMoved(b); }} />
        <DrawRect active={drawing} onDone={go} />
        {bounds && !drawing && <Rectangle bounds={bounds} pathOptions={{ color: "#16181b", weight: 1.5, dashArray: "4 4", fillOpacity: 0.03 }} />}
        {near && <Circle center={[near[0], near[1]]} radius={near[2] * 1000} pathOptions={{ color: "#d9481c", weight: 1.5, fillOpacity: 0.06 }} />}
        <PinLayer pins={pins} active={active} setActive={setActive} />
      </MapContainer>

      <div className="absolute z-[500] top-3 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
        {moved && !drawing && (
          <button type="button" onClick={() => go(moved)} className="pointer-events-auto inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-ink text-white text-[13px] font-medium shadow-[var(--shadow-pop)]">
            <Crosshair size={14} aria-hidden /> Search this area
          </button>
        )}
      </div>
      <div className="absolute z-[500] top-3 right-3 flex flex-col items-end gap-2">
        <button type="button" onClick={() => setDrawing((d) => !d)} aria-pressed={drawing}
          className={cx("inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-sm)] text-[13px] font-medium shadow-[var(--shadow-pop)] border", drawing ? "bg-accent text-white border-accent" : "bg-card border-line-2 hover:border-ink")}>
          {drawing ? <X size={14} aria-hidden /> : <Square size={14} aria-hidden />} {drawing ? "Cancel drawing" : "Draw area"}
        </button>
        {bounds && !drawing && (
          <button type="button" onClick={clearArea} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] text-[12px] bg-card border border-line-2 shadow-[var(--shadow-pop)] hover:border-ink">
            <X size={13} aria-hidden /> Clear map area
          </button>
        )}
      </div>
      {drawing && (
        <div className="absolute z-[500] bottom-3 left-1/2 -translate-x-1/2 bg-ink text-white text-xs px-3 py-1.5 rounded-full shadow-[var(--shadow-pop)] whitespace-nowrap">Drag on the map to draw the area you want</div>
      )}
      {!drawing && (
        <div className="absolute z-[500] bottom-3 left-3 bg-card/95 border border-line text-xs px-2.5 py-1 rounded-full num">
          {pins.length < total ? `Showing ${pins.length} of ${total} on map · zoom in or draw an area` : `${pins.length} on map`}
        </div>
      )}
    </div>
  );
}
