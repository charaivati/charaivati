"use client";

import { useEffect, useRef } from "react";
import type { Map, LayerGroup, Marker } from "leaflet";

export interface DiscoveryMapStore {
  id: string;
  name: string;
  slug?: string | null;
  lat: number;
  lng: number;
}

interface DiscoveryMapProps {
  stores: DiscoveryMapStore[];
  selectedAddress: { lat: number; lng: number } | null;
}

const FALLBACK_CENTER: [number, number] = [22.5726, 88.3639]; // Kolkata

export default function DiscoveryMap({ stores, selectedAddress }: DiscoveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const storeLayerRef = useRef<LayerGroup | null>(null);
  const storeMarkersRef = useRef<Map<string, Marker> | null>(null);
  const addressMarkerRef = useRef<Marker | null>(null);

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
        center: FALLBACK_CENTER,
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      storeLayerRef.current = L.layerGroup().addTo(map);
      storeMarkersRef.current = new globalThis.Map();
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      storeLayerRef.current = null;
      storeMarkersRef.current = null;
      addressMarkerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once only

  // Diff store markers
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      if (!mapRef.current || !storeLayerRef.current || !storeMarkersRef.current) return;
      const markers = storeMarkersRef.current;
      const seen = new Set<string>();

      const icon = L.divIcon({
        html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35))">🏪</div>`,
        iconSize: [36, 36], iconAnchor: [18, 18], className: "",
      });

      for (const store of stores) {
        seen.add(store.id);
        const existing = markers.get(store.id);
        if (existing) {
          existing.setLatLng([store.lat, store.lng]);
        } else {
          const marker = L.marker([store.lat, store.lng], { icon })
            .addTo(storeLayerRef.current)
            .bindPopup(`<b>${store.name}</b>`);
          markers.set(store.id, marker);
        }
      }

      // Remove markers for stores no longer present
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          storeLayerRef.current.removeLayer(marker);
          markers.delete(id);
        }
      }
    });
  }, [stores]);

  // Selected address marker
  useEffect(() => {
    if (!mapRef.current || !selectedAddress) return;
    import("leaflet").then((L) => {
      if (!mapRef.current) return;
      const { lat, lng } = selectedAddress;
      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#2563EB;border:3px solid white;box-shadow:0 0 0 3px rgba(37,99,235,0.3)"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7], className: "",
      });
      if (!addressMarkerRef.current) {
        addressMarkerRef.current = L.marker([lat, lng], { icon })
          .addTo(mapRef.current)
          .bindPopup("Your address");
      } else {
        addressMarkerRef.current.setLatLng([lat, lng]);
      }
      mapRef.current.setView([lat, lng], 13);
    });
  }, [selectedAddress]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: 320 }}
    />
  );
}
