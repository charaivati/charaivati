// components/transport/Broadcaster.tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { VehicleType } from "@/lib/types";

const VEHICLE_TYPES: VehicleType[] = ["Bus", "Auto", "Taxi", "Metro", "Other"];
const VEHICLE_EMOJI: Record<VehicleType, string> = {
  Bus: "🚌", Auto: "🛺", Taxi: "🚕", Metro: "🚇", Other: "🚐",
};

interface BroadcasterProps {
  onPositionUpdate?: (lat: number, lng: number) => void;
}

export default function Broadcaster({ onPositionUpdate }: BroadcasterProps) {
  const [busNumber, setBusNumber]     = useState("");
  const [route, setRoute]             = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("Bus");
  const [status, setStatus]           = useState<"idle" | "active" | "error">("idle");
  const [statusMsg, setStatusMsg]     = useState("Enter your vehicle details and start broadcasting.");
  const [accuracy, setAccuracy]       = useState<number | null>(null);

  const watchRef      = useRef<number | null>(null);
  const vehicleIdRef  = useRef<string | null>(null);

  const broadcast = useCallback(
    async (lat: number, lng: number, acc: number) => {
      try {
        const res = await fetch("/api/transport/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bus_number: busNumber.trim(),
            route,
            vehicle_type: vehicleType,
            lat,
            lng,
            accuracy: Math.round(acc),
          }),
        });
        const data = await res.json();
        if (data.id) vehicleIdRef.current = data.id;
        onPositionUpdate?.(lat, lng);
      } catch {
        setStatusMsg("Network error — retrying...");
      }
    },
    [busNumber, route, vehicleType, onPositionUpdate]
  );

  const start = () => {
    if (!busNumber.trim()) {
      alert("Please enter a bus / vehicle number.");
      return;
    }
    setStatus("active");
    setStatusMsg("Waiting for GPS...");

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        setAccuracy(Math.round(acc));
        setStatusMsg(`Live · ${busNumber} · ±${Math.round(acc)}m · ${new Date().toLocaleTimeString()}`);
        broadcast(latitude, longitude, acc);
      },
      (err) => {
        setStatus("error");
        setStatusMsg("GPS error: " + err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  };

  const stop = async () => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (vehicleIdRef.current) {
      await fetch(`/api/transport/broadcast?id=${vehicleIdRef.current}`, { method: "DELETE" });
      vehicleIdRef.current = null;
    }
    setStatus("idle");
    setAccuracy(null);
    setStatusMsg("Stopped. Your vehicle is no longer visible to others.");
  };

  const isActive = status === "active";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Vehicle number *</label>
          <input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
            placeholder="e.g. AC-47, S-11"
            value={busNumber}
            onChange={(e) => setBusNumber(e.target.value)}
            disabled={isActive}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Route</label>
          <input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
            placeholder="e.g. Esplanade → Salt Lake"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            disabled={isActive}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium">Vehicle type</label>
        <div className="flex gap-2 flex-wrap">
          {VEHICLE_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setVehicleType(t)}
              disabled={isActive}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                ${vehicleType === t
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "border-gray-200 text-gray-600 hover:border-emerald-400 disabled:opacity-50"
                }`}
            >
              {VEHICLE_EMOJI[t]} {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {!isActive ? (
          <button
            onClick={start}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
          >
            📡 Start broadcasting
          </button>
        ) : (
          <button
            onClick={stop}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
          >
            ⏹ Stop broadcasting
          </button>
        )}
      </div>

      <div
        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs
          ${isActive ? "bg-emerald-50 text-emerald-800" : status === "error" ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-500"}`}
      >
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0
            ${isActive ? "bg-emerald-500 animate-pulse" : status === "error" ? "bg-red-400" : "bg-gray-300"}`}
        />
        {statusMsg}
        {accuracy !== null && isActive && (
          <span className="ml-auto text-emerald-600 font-medium">±{accuracy}m</span>
        )}
      </div>
    </div>
  );
}