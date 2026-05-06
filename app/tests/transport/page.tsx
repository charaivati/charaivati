// app/tests/transport/page.tsx

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Broadcaster from "@/components/transport/broadcaster";
import VehicleList from "@/components/transport/VehicleList";
import { Vehicle } from "@/lib/types";

// Leaflet touches `window` — must be loaded client-side only
const TransportMap = dynamic(
  () => import("@/components/transport/TransportMap"),
  { ssr: false, loading: () => <div className="w-full h-72 bg-gray-100 rounded-xl animate-pulse" /> }
);

type Tab = "broadcast" | "view";

export default function TransportPage() {
  const [activeTab, setActiveTab] = useState<Tab>("broadcast");

  // --- Broadcast tab state ---
  const [selfPosition, setSelfPosition] = useState<{ lat: number; lng: number } | null>(null);

  // --- View tab state ---
  const [vehicles, setVehicles]         = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelected]  = useState<Vehicle | null>(null);
  const [busFilter, setBusFilter]       = useState("");
  const [routeFilter, setRouteFilter]   = useState("");
  const [loadingVehicles, setLoading]   = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busFilter)   params.set("bus",   busFilter);
      if (routeFilter) params.set("route", routeFilter);

      const res = await fetch(`/api/transport/vehicles?${params}`);
      const data = await res.json();
      const list: Vehicle[] = data.vehicles ?? [];
      setVehicles(list);

      // Keep selected vehicle's position in sync
      setSelected((prev) => {
        if (!prev) return prev;
        const updated = list.find((v) => v.id === prev.id);
        return updated ?? prev;
      });
    } finally {
      setLoading(false);
    }
  }, [busFilter, routeFilter]);

  // Poll every 3 seconds while on the View tab
  useEffect(() => {
    if (activeTab !== "view") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    fetchVehicles();
    pollRef.current = setInterval(fetchVehicles, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeTab, fetchVehicles]);

  const vehicleMapPin = selectedVehicle
    ? {
        lat: selectedVehicle.lat,
        lng: selectedVehicle.lng,
        label: `${selectedVehicle.bus_number} — ${selectedVehicle.route}`,
        type: selectedVehicle.vehicle_type,
      }
    : null;

  return (
    <main className="min-h-screen bg-gray-50 flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">🚌 Live Transport Tracker</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Share your ride live · friends can track you in real time
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(["broadcast", "view"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-medium transition-all border-b-2
                ${activeTab === tab
                  ? "border-emerald-500 text-emerald-700"
                  : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
            >
              {tab === "broadcast" ? "📡 Broadcast" : "👀 Track a vehicle"}
            </button>
          ))}
        </div>

        {/* Broadcast Tab */}
        {activeTab === "broadcast" && (
          <div className="p-5 flex flex-col gap-4">
            <Broadcaster onPositionUpdate={(lat, lng) => setSelfPosition({ lat, lng })} />
            <div className="rounded-xl overflow-hidden border border-gray-100 h-72">
              <TransportMap selfPosition={selfPosition} autoCenter />
            </div>
            <p className="text-xs text-gray-400 text-center">
              Your blue dot updates as you move. Share this page URL with friends — they open the <strong>Track</strong> tab.
            </p>
          </div>
        )}

        {/* View Tab */}
        {activeTab === "view" && (
          <div className="p-5 flex flex-col gap-4">
            <VehicleList
              vehicles={vehicles}
              selectedId={selectedVehicle?.id ?? null}
              onSelect={setSelected}
              busFilter={busFilter}
              routeFilter={routeFilter}
              onBusFilterChange={setBusFilter}
              onRouteFilterChange={setRouteFilter}
              loading={loadingVehicles}
            />

            {selectedVehicle && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                Tracking <strong className="mx-1">{selectedVehicle.bus_number}</strong> — updates every 3 seconds
              </div>
            )}

            <div className="rounded-xl overflow-hidden border border-gray-100 h-72">
              <TransportMap vehiclePosition={vehicleMapPin} autoCenter={!vehicleMapPin} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}