"use client";

import { useEffect, useRef } from "react";
import type { Map, LayerGroup, Marker } from "leaflet";

export interface DiscoveryMapStore {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  previewImage?: string | null;
  acceptingOrders?: boolean;
  distanceKm?: number | null;
  lat: number;
  lng: number;
}

interface DiscoveryMapProps {
  stores: DiscoveryMapStore[];
  selectedAddress: { lat: number; lng: number } | null;
  onStoreClick: (store: DiscoveryMapStore) => void;
}

const FALLBACK_CENTER: [number, number] = [22.5726, 88.3639]; // Kolkata

export default function DiscoveryMap({ stores, selectedAddress, onStoreClick }: DiscoveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const storeLayerRef = useRef<LayerGroup | null>(null);
  const addressMarkerRef = useRef<Marker | null>(null);
  // Keep latest onStoreClick in a ref so marker closures don't go stale
  const onStoreClickRef = useRef(onStoreClick);
  useEffect(() => { onStoreClickRef.current = onStoreClick; });

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
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      storeLayerRef.current = null;
      addressMarkerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once only

  // Rebuild store markers on every stores change (clear+add avoids stale-marker _leaflet_pos crash)
  useEffect(() => {
    let cancelled = false;
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current || !storeLayerRef.current) return;

      storeLayerRef.current.clearLayers();

      const icon = L.divIcon({
        html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35))">🏪</div>`,
        iconSize: [36, 36], iconAnchor: [18, 18], className: "",
      });

      for (const store of stores) {
        L.marker([store.lat, store.lng], { icon })
          .addTo(storeLayerRef.current!)
          .on("click", () => onStoreClickRef.current(store));
      }
    });
    return () => { cancelled = true; };
  }, [stores]);

  // Selected address marker
  useEffect(() => {
    let cancelled = false;
    if (!mapRef.current || !selectedAddress) return;
    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;
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
    return () => { cancelled = true; };
  }, [selectedAddress]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: 320 }}
    />
  );
}
