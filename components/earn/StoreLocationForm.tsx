"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { lookupPincode, geocodePincode } from "@/lib/geo/geocode";

// Leaflet map — client-only, never SSR'd
const MapPicker = dynamic(() => import("../shared/MapPicker"), { ssr: false });

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const INPUT_CLS =
  "w-full text-sm px-3 py-2 rounded-md outline-none border border-gray-300 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-400";

export interface StoreLocationData {
  line1: string;
  city: string;
  state: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
}

export interface StoreLocationFormProps {
  initialValues?: Partial<StoreLocationData>;
  onSave: (data: StoreLocationData) => void;
  onCancel?: () => void;
  saving?: boolean;
}

export default function StoreLocationForm({ initialValues, onSave, onCancel, saving }: StoreLocationFormProps) {
  const [line1, setLine1] = useState(initialValues?.line1 ?? "");
  const [city, setCity] = useState(initialValues?.city ?? "");
  const [state, setState] = useState(initialValues?.state ?? "");
  const [pincode, setPincode] = useState(initialValues?.pincode ?? "");
  const [lat, setLat] = useState<number>(initialValues?.lat ?? INDIA_CENTER.lat);
  const [lng, setLng] = useState<number>(initialValues?.lng ?? INDIA_CENTER.lng);
  const [hasPin, setHasPin] = useState(initialValues?.lat != null && initialValues?.lng != null);
  const [error, setError] = useState("");

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");

  const geocodedForPin = useRef<string>("");

  useEffect(() => {
    if (pincode.length !== 6 || geocodedForPin.current === pincode) return;
    geocodedForPin.current = pincode;

    (async () => {
      const postal = await lookupPincode(pincode);
      if (postal) {
        if (!city) setCity(postal.city);
        if (!state) setState(postal.state);
      }

      const coords = await geocodePincode(pincode);
      if (coords) {
        setLat(coords.lat);
        setLng(coords.lng);
        setHasPin(true);
      } else {
        setHasPin(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode]);

  const showMap = hasPin || (initialValues?.lat != null && initialValues?.lng != null);

  function handleGps() {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setHasPin(true);
        setGpsLoading(false);
      },
      (err) => {
        const message =
          err.code === 1
            ? "Location permission was denied. Drag the pin to your store location."
            : err.code === 2
            ? "Location unavailable right now. Drag the pin to your store location."
            : "Location took too long to load. Drag the pin to your store location.";
        setGpsError(message);
        setGpsLoading(false);
        setHasPin(true);
      },
      { timeout: 15000, maximumAge: 60000, enableHighAccuracy: false }
    );
  }

  function handleSubmit() {
    setError("");
    if (!line1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      setError("Please fill in all address fields.");
      return;
    }
    onSave({
      line1: line1.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      lat: hasPin ? lat : null,
      lng: hasPin ? lng : null,
    });
  }

  return (
    <div className="space-y-3">
      <input
        value={line1}
        onChange={(e) => setLine1(e.target.value)}
        placeholder="Address line (building, street, area)"
        className={INPUT_CLS}
      />

      <div className="grid grid-cols-3 gap-2">
        <input
          value={pincode}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setPincode(v);
          }}
          placeholder="Pincode"
          inputMode="numeric"
          className={INPUT_CLS}
        />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={INPUT_CLS} />
        <input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" className={INPUT_CLS} />
      </div>

      <div className="pt-2 space-y-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">Pin your store location</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Used for delivery distance pricing and rider navigation.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGps}
          disabled={gpsLoading}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border border-indigo-300 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
        >
          {gpsLoading ? (
            <span className="w-3 h-3 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          ) : (
            <span>📍</span>
          )}
          {gpsLoading ? "Getting location…" : "Use my current location"}
        </button>

        {gpsError && (
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
            {gpsError}
          </p>
        )}

        {showMap && (
          <div className="space-y-1">
            <MapPicker lat={lat} lng={lng} onMove={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} />
            <p className="text-xs text-gray-400 text-center">
              📍 {lat.toFixed(5)}, {lng.toFixed(5)} — drag the pin to adjust
            </p>
          </div>
        )}

        {!showMap && pincode.length < 6 && (
          <p className="text-xs text-gray-400 italic">
            Enter a 6-digit pincode or click "Use my current location" to show the map.
          </p>
        )}
      </div>

      <div className="pt-1">
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Location"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-md text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
