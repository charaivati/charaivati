// components/transport/TransportMap.tsx
"use client";

import { useEffect, useRef } from "react";
import type { Map, Marker } from "leaflet";

interface TransportMapProps {
  vehiclePosition?: { lat: number; lng: number; label: string; type: string } | null;
  selfPosition?: { lat: number; lng: number } | null;
  autoCenter?: boolean;
}

const EMOJI: Record<string, string> = {
  Bus: "🚌", Auto: "🛺", Taxi: "🚕", Metro: "🚇", Other: "🚐",
};

export default function TransportMap({
  vehiclePosition,
  selfPosition,
  autoCenter = false,
}: TransportMapProps) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<Map | null>(null);
  const markerRef       = useRef<Marker | null>(null);
  const selfMarkerRef   = useRef<Marker | null>(null);

  // Boot Leaflet once — guard against double-init from React Strict Mode
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      // If Leaflet already stamped this container (hot reload), remove the old instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const container = containerRef.current as any;
      if (container._leaflet_id) {
        container._leaflet_id = null;
      }

      // Fix webpack-broken default icon paths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        center: [22.5726, 88.3639], // Kolkata fallback
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      if (autoCenter) {
        navigator.geolocation.getCurrentPosition(
          (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 15),
          () => {} // silently fall back to Kolkata
        );
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current     = null;
      markerRef.current  = null;
      selfMarkerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once only

  // Update vehicle marker
  useEffect(() => {
    if (!mapRef.current || !vehiclePosition) return;
    import("leaflet").then((L) => {
      const { lat, lng, label, type } = vehiclePosition;
      const icon = L.divIcon({
        html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35))">${EMOJI[type] ?? "🚐"}</div>`,
        iconSize: [36, 36], iconAnchor: [18, 18], className: "",
      });
      if (!markerRef.current) {
        markerRef.current = L.marker([lat, lng], { icon })
          .addTo(mapRef.current!)
          .bindPopup(`<b>${label}</b>`);
      } else {
        markerRef.current.setLatLng([lat, lng]);
        markerRef.current.setIcon(icon);
      }
      markerRef.current.openPopup();
      mapRef.current!.setView([lat, lng], 15);
    });
  }, [vehiclePosition]);

  // Update self (broadcaster) blue dot
  useEffect(() => {
    if (!mapRef.current || !selfPosition) return;
    import("leaflet").then((L) => {
      const { lat, lng } = selfPosition;
      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 0 0 3px rgba(37,99,235,0.3)"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7], className: "",
      });
      if (!selfMarkerRef.current) {
        selfMarkerRef.current = L.marker([lat, lng], { icon })
          .addTo(mapRef.current!)
          .bindPopup("Your location");
      } else {
        selfMarkerRef.current.setLatLng([lat, lng]);
      }
      mapRef.current!.setView([lat, lng], 15);
    });
  }, [selfPosition]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" style={{ minHeight: 280 }} />
    </>
  );
}