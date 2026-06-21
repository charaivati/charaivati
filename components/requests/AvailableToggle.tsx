"use client";

// FLEET-STATE-1b P1 — provider "Available / Receive work" toggle. Owns the
// foreground-only, adaptive, distance-gated presence loop. ON → start watching
// location and POST /api/presence (mode=available); OFF/unmount → stop + go offline.
//
// Doctrine: foreground ONLY. We pause capture when the tab is hidden
// (visibilitychange) and resume when visible. No background location, no service.
import { useCallback, useEffect, useRef, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversineKm } from "@/lib/geo/haversine";
import { useTranslations } from "@/hooks/useTranslations";

const SLUGS = "presence-available-label,presence-available-sub,presence-visible-note,presence-last-updated,presence-location-needed";

const MIN_INTERVAL_MS = 10_000; // ~10–15s cadence when foregrounded
const MIN_MOVE_KM = 0.25;       // distance gate: skip < ~250m from last report
const A = { border: "#E5E7EB", text: "#111827", muted: "#6B7280", accent: "#16A34A", off: "#CBD5E1" };

export default function AvailableToggle() {
  const t = useTranslations(SLUGS);
  const { startWatch, stopWatch } = useGeolocation();
  const [available, setAvailable] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastPos = useRef<{ lat: number; lng: number } | null>(null);
  const lastSentAt = useRef(0);

  const report = useCallback(async (lat: number, lng: number) => {
    const now = Date.now();
    if (lastPos.current) {
      const movedKm = haversineKm(lastPos.current.lat, lastPos.current.lng, lat, lng);
      if (movedKm < MIN_MOVE_KM && now - lastSentAt.current < MIN_INTERVAL_MS) return; // standing still → no spam
    }
    lastSentAt.current = now;
    lastPos.current = { lat, lng };
    try {
      await fetch("/api/presence", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "available", lat, lng }),
      });
      setLastUpdated(new Date());
    } catch {}
  }, []);

  const begin = useCallback(() => {
    setError(null);
    startWatch(
      (lat, lng) => report(lat, lng),
      (msg) => setError(msg),
    );
  }, [startWatch, report]);

  const goOffline = useCallback(() => {
    stopWatch();
    lastPos.current = null;
    fetch("/api/presence", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "offline" }),
    }).catch(() => {});
  }, [stopWatch]);

  // Foreground-only: pause capture when hidden, resume when visible (while available).
  useEffect(() => {
    if (!available) return;
    begin();
    function onVisibility() {
      if (document.visibilityState === "hidden") stopWatch();
      else begin();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopWatch();
    };
  }, [available, begin, stopWatch]);

  function toggle() {
    if (available) { setAvailable(false); setLastUpdated(null); goOffline(); }
    else setAvailable(true);
  }

  return (
    <div style={{ border: `1px solid ${A.border}`, borderRadius: 12, padding: 14, marginBottom: 16, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, color: A.text, fontSize: 14 }}>{t("presence-available-label", "Available")}</div>
          <div style={{ fontSize: 12, color: A.muted }}>{t("presence-available-sub", "Receive work")}</div>
        </div>
        <button
          onClick={toggle}
          aria-pressed={available}
          style={{ width: 46, height: 26, borderRadius: 99, border: "none", cursor: "pointer", position: "relative", background: available ? A.accent : A.off, transition: "background 0.15s" }}
        >
          <span style={{ position: "absolute", top: 3, left: available ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
        </button>
      </div>

      {available && (
        <div style={{ marginTop: 10, fontSize: 12, color: A.muted, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: A.accent, display: "inline-block" }} />
          {t("presence-visible-note", "You're visible to nearby requests")}
          {lastUpdated && <span> · {t("presence-last-updated", "Last updated")} {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
      )}
      {available && error && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#DC2626" }}>{t("presence-location-needed", "Location permission is needed to receive work.")}</div>
      )}
    </div>
  );
}
