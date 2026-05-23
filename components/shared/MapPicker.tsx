"use client";

// Loaded only client-side via dynamic() in AddressForm.tsx — never SSR'd.
import { useEffect, useRef } from "react";
import type { Map, Marker } from "leaflet";

interface MapPickerProps {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
}

export default function MapPicker({ lat, lng, onMove }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<Map | null>(null);
  const markerRef    = useRef<Marker | null>(null);

  // Boot Leaflet once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      // Fix webpack-broken default icon paths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, { center: [lat, lng], zoom: 15, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onMove(pos.lat, pos.lng);
      });

      mapRef.current    = map;
      markerRef.current = marker;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current    = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker + map center when lat/lng props change externally (GPS or geocode result)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    mapRef.current.setView([lat, lng], 15);
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: 250, borderRadius: 8, overflow: "hidden", border: "1px solid #E5E7EB" }}
    />
  );
}
