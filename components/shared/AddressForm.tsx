"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// Leaflet map — client-only, never SSR'd
const MapPicker = dynamic(() => import("./MapPicker"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AddressFormData {
  name:      string;
  phone:     string;
  line1:     string;
  city:      string;
  state:     string;
  pincode:   string;
  isDefault: boolean;
  lat:       number | null;
  lng:       number | null;
}

export interface AddressFormProps {
  initialValues?: Partial<AddressFormData>;
  onSave:   (data: AddressFormData) => void;
  onCancel?: () => void;
  saving?:  boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const INPUT_CLS    = "w-full text-sm px-3 py-2 rounded-md outline-none border border-gray-300 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-400";

// ── Pincode → city/state lookup ───────────────────────────────────────────────

async function lookupPincode(pin: string): Promise<{ city: string; state: string } | null> {
  try {
    const res  = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await res.json();
    if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      return { city: po.District, state: po.State };
    }
  } catch {}
  return null;
}

// ── Nominatim geocode → lat/lng from pincode ─────────────────────────────────

async function geocodePincode(pin: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(pin)}&country=India&format=json&limit=1`;
    const res  = await fetch(url, { headers: { "User-Agent": "Charaivati/1.0" } });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {}
  return null;
}

// ── AddressForm ───────────────────────────────────────────────────────────────

export default function AddressForm({ initialValues, onSave, onCancel, saving }: AddressFormProps) {
  const [name,      setName]      = useState(initialValues?.name      ?? "");
  const [phone,     setPhone]     = useState(initialValues?.phone     ?? "");
  const [line1,     setLine1]     = useState(initialValues?.line1     ?? "");
  const [city,      setCity]      = useState(initialValues?.city      ?? "");
  const [state,     setState]     = useState(initialValues?.state     ?? "");
  const [pincode,   setPincode]   = useState(initialValues?.pincode   ?? "");
  const [isDefault, setIsDefault] = useState(initialValues?.isDefault ?? false);
  const [lat,       setLat]       = useState<number>(initialValues?.lat ?? INDIA_CENTER.lat);
  const [lng,       setLng]       = useState<number>(initialValues?.lng ?? INDIA_CENTER.lng);
  const [hasPin,    setHasPin]    = useState(false); // true once we have a real coordinate
  const [error,     setError]     = useState("");

  // GPS state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError,   setGpsError]   = useState("");

  const geocodedForPin = useRef<string>("");

  // ── Auto-geocode when pincode reaches 6 digits ──────────────────────────────
  useEffect(() => {
    if (pincode.length !== 6 || geocodedForPin.current === pincode) return;
    geocodedForPin.current = pincode;

    (async () => {
      // 1. Postalpincode for city/state auto-fill
      const postal = await lookupPincode(pincode);
      if (postal) {
        if (!city)  setCity(postal.city);
        if (!state) setState(postal.state);
      }

      // 2. Nominatim for map coordinates
      const coords = await geocodePincode(pincode);
      if (coords) {
        setLat(coords.lat);
        setLng(coords.lng);
        setHasPin(true);
      } else {
        setHasPin(true); // show map at India center if geocode fails
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode]);

  // Show map as soon as we have initial coordinates or after pincode geocode
  const showMap = hasPin || (initialValues?.lat != null && initialValues?.lng != null);

  // ── GPS current location ───────────────────────────────────────────────────
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
      () => {
        setGpsError("Could not get GPS location. Please drag the pin to your address.");
        setGpsLoading(false);
        setHasPin(true); // still show map so user can drag
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit() {
    setError("");
    if (!name.trim() || !phone.trim() || !line1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      setError("Please fill in all address fields.");
      return;
    }
    onSave({
      name:      name.trim(),
      phone:     phone.trim(),
      line1:     line1.trim(),
      city:      city.trim(),
      state:     state.trim(),
      pincode:   pincode.trim(),
      isDefault,
      lat:       hasPin ? lat : null,
      lng:       hasPin ? lng : null,
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── A: Standard fields ── */}
      <div className="grid grid-cols-2 gap-2">
        <input value={name}  onChange={(e) => setName(e.target.value)}
          placeholder="Full name" className={INPUT_CLS} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone" inputMode="tel" className={INPUT_CLS} />
      </div>

      <input value={line1} onChange={(e) => setLine1(e.target.value)}
        placeholder="Address line (house, street, area)" className={INPUT_CLS} />

      <div className="grid grid-cols-3 gap-2">
        <input
          value={pincode}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setPincode(v);
          }}
          placeholder="Pincode" inputMode="numeric" className={INPUT_CLS}
        />
        <input value={city}  onChange={(e) => setCity(e.target.value)}
          placeholder="City" className={INPUT_CLS} />
        <input value={state} onChange={(e) => setState(e.target.value)}
          placeholder="State" className={INPUT_CLS} />
      </div>

      {/* ── B: Location section ── */}
      <div className="pt-2 space-y-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">Confirm your location</p>
          <p className="text-xs text-gray-400 mt-0.5">
            We use your location to calculate delivery distance accurately.
          </p>
        </div>

        {/* GPS button */}
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
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            ⚠ {gpsError}
          </p>
        )}

        {/* Map — shown once we have a coordinate to center on */}
        {showMap && (
          <div className="space-y-1">
            <MapPicker
              lat={lat}
              lng={lng}
              onMove={(newLat, newLng) => { setLat(newLat); setLng(newLng); }}
            />
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

      {/* ── C: isDefault checkbox ── */}
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Set as default address
      </label>

      {/* Actions — sticky so the button stays visible when the map pushes content below the fold */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 pt-3 pb-1">
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Address"}
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
