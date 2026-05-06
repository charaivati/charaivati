// components/transport/VehicleList.tsx
"use client";

import { Vehicle } from "@/lib/types";

const VEHICLE_EMOJI: Record<string, string> = {
  Bus: "🚌", Auto: "🛺", Taxi: "🚕", Metro: "🚇", Other: "🚐",
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

interface VehicleListProps {
  vehicles: Vehicle[];
  selectedId: string | null;
  onSelect: (v: Vehicle) => void;
  busFilter: string;
  routeFilter: string;
  onBusFilterChange: (v: string) => void;
  onRouteFilterChange: (v: string) => void;
  loading: boolean;
}

export default function VehicleList({
  vehicles,
  selectedId,
  onSelect,
  busFilter,
  routeFilter,
  onBusFilterChange,
  onRouteFilterChange,
  loading,
}: VehicleListProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Filter by vehicle no.</label>
          <input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. AC-47"
            value={busFilter}
            onChange={(e) => onBusFilterChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Filter by route</label>
          <input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Salt Lake"
            value={routeFilter}
            onChange={(e) => onRouteFilterChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-0.5">
        {loading && vehicles.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Fetching vehicles...</p>
        ) : vehicles.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            No active vehicles found. Try broadcasting from the other tab.
          </p>
        ) : (
          vehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all
                ${selectedId === v.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-blue-300 bg-white"
                }`}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{VEHICLE_EMOJI[v.vehicle_type] ?? "🚐"}</span>
                  <span className="text-sm font-semibold text-gray-800">{v.bus_number}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {v.vehicle_type}
                  </span>
                </div>
                <p className="text-xs text-gray-500 pl-7">{v.route || "No route info"}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                {timeAgo(v.updated_at)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}