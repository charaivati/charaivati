"use client";

// CIVIC-1 — home-unit picker: lists ward/panchayat units, sets the caller's
// home location via POST /api/civic/home-unit. Manual pick is the fallback
// path per the civic design (geo-resolution is a later prompt). Used by the
// Society "Panchayat/Ward" tab (dark) and the /local index page (light).

import { useEffect, useMemo, useState } from "react";

const PALETTES = {
  light: {
    border: "#E5E7EB", text: "#111827", textMuted: "#6B7280", accent: "#6366f1",
    surface: "#FFFFFF", inputBg: "#F3F4F6", skeleton: "#E5E7EB",
    error: { bg: "#FEE2E2", border: "#FECACA", fg: "#991B1B" },
  },
  dark: {
    border: "rgba(255,255,255,0.12)", text: "#F9FAFB", textMuted: "#9CA3AF", accent: "#6366f1",
    surface: "rgba(255,255,255,0.05)", inputBg: "rgba(255,255,255,0.07)", skeleton: "rgba(255,255,255,0.10)",
    error: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", fg: "#FCA5A5" },
  },
};

type UnitRow = {
  id: string;
  type: string;
  name: string;
  parentName: string | null;
  grandparentName: string | null;
};

export default function UnitPicker({
  onSet,
  theme = "light",
}: {
  onSet: (unitId: string) => void;
  theme?: "light" | "dark";
}) {
  const C = PALETTES[theme];
  const [units, setUnits] = useState<UnitRow[] | null>(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/civic/units")
      .then((r) => (r.ok ? r.json() : { units: [] }))
      .then((d) => setUnits(d.units ?? []))
      .catch(() => setUnits([]));
  }, []);

  const filtered = useMemo(() => {
    if (!units) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return units;
    return units.filter(
      (u) =>
        u.name.toLowerCase().includes(needle) ||
        (u.parentName ?? "").toLowerCase().includes(needle)
    );
  }, [units, q]);

  async function pick(unitId: string) {
    if (saving) return;
    setSaving(unitId);
    setError(null);
    try {
      const res = await fetch("/api/civic/home-unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not set home location.");
        return;
      }
      onSet(unitId);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: C.text }}>
        Where do you live?
      </div>
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 10 }}>
        Pick your ward or panchayat. This is your home area — you can raise and
        support local issues there. It can be changed only once every 90 days.
      </div>

      {error && (
        <div
          style={{
            marginBottom: 10, padding: "10px 12px", borderRadius: 10, fontSize: 13,
            background: C.error.bg, border: `0.5px solid ${C.error.border}`, color: C.error.fg,
          }}
        >
          {error}
        </div>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search ward or area name…"
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
          border: `1px solid ${C.border}`, marginBottom: 10, background: C.inputBg, color: C.text,
        }}
      />

      {filtered === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 rounded-xl animate-pulse"
              style={{ background: C.skeleton }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 13, color: C.textMuted, padding: "16px 0", textAlign: "center" }}>
          No areas match. Coverage is expanding — check back soon.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((u) => (
            <div
              key={u.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "10px 12px",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{u.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>
                  {[u.parentName, u.grandparentName].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button
                onClick={() => pick(u.id)}
                disabled={saving === u.id}
                style={{
                  flexShrink: 0, background: C.accent, color: "#fff", border: "none",
                  borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600,
                  opacity: saving === u.id ? 0.5 : 1,
                }}
              >
                {saving === u.id ? "Saving…" : "This is my area"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
