"use client";

// Compact home-area control shown above the issue board: the current
// ward/panchayat with a dropdown to change it. When the area was placed
// automatically from a saved address (autoPlaced), it says so and asks the
// user to confirm or correct — confirming (or picking manually) starts the
// 90-day change lock; the auto-guess itself never does. Lock violations are
// surfaced from the server's 429 message.

import { useEffect, useState } from "react";

const PALETTES = {
  light: {
    border: "#E5E7EB", text: "#111827", textMuted: "#6B7280", accent: "#6366f1",
    inputBg: "#F3F4F6",
    error: { bg: "#FEE2E2", border: "#FECACA", fg: "#991B1B" },
    hint: { bg: "#EEF2FF", border: "#C7D2FE", fg: "#3730A3" },
  },
  dark: {
    border: "rgba(255,255,255,0.12)", text: "#F9FAFB", textMuted: "#9CA3AF", accent: "#6366f1",
    inputBg: "rgba(255,255,255,0.07)",
    error: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", fg: "#FCA5A5" },
    hint: { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", fg: "#C7D2FE" },
  },
};

type UnitRow = { id: string; name: string; parentName: string | null };

export default function HomeUnitSelect({
  homeUnitId,
  autoPlaced,
  onChanged,
  theme = "light",
}: {
  homeUnitId: string;
  /** true when the unit came from address auto-placement and was never confirmed */
  autoPlaced: boolean;
  onChanged: (unitId: string) => void;
  theme?: "light" | "dark";
}) {
  const C = PALETTES[theme];
  const [units, setUnits] = useState<UnitRow[] | null>(null);
  const [selectedId, setSelectedId] = useState(homeUnitId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => { setSelectedId(homeUnitId); }, [homeUnitId]);

  useEffect(() => {
    fetch("/api/civic/units")
      .then((r) => (r.ok ? r.json() : { units: [] }))
      .then((d) => setUnits(d.units ?? []))
      .catch(() => setUnits([]));
  }, []);

  async function save(unitId: string) {
    if (saving || !unitId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/civic/home-unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not change home area.");
        setSelectedId(homeUnitId);
        return;
      }
      setConfirmed(true);
      onChanged(unitId);
    } finally {
      setSaving(false);
    }
  }

  const dirty = selectedId !== homeUnitId;
  const showAutoHint = autoPlaced && !confirmed;

  return (
    <div style={{ marginBottom: 12 }}>
      {showAutoHint && (
        <div
          style={{
            marginBottom: 8, padding: "10px 12px", borderRadius: 10, fontSize: 13,
            background: C.hint.bg, border: `0.5px solid ${C.hint.border}`, color: C.hint.fg,
          }}
        >
          📍 We placed you here from your saved address. If it&apos;s wrong, change it
          below — once you confirm, changes lock for 90 days.
        </div>
      )}
      {error && (
        <div
          style={{
            marginBottom: 8, padding: "10px 12px", borderRadius: 10, fontSize: 13,
            background: C.error.bg, border: `0.5px solid ${C.error.border}`, color: C.error.fg,
          }}
        >
          {error}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: C.textMuted, flexShrink: 0 }}>Home area:</span>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={units === null || saving}
          style={{
            flex: 1, minWidth: 180, padding: "8px 10px", borderRadius: 10, fontSize: 13,
            border: `1px solid ${C.border}`, background: C.inputBg, color: C.text,
          }}
        >
          {units === null ? (
            <option value={homeUnitId}>Loading…</option>
          ) : (
            units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}{u.parentName ? ` — ${u.parentName}` : ""}
              </option>
            ))
          )}
        </select>
        {(dirty || showAutoHint) && (
          <button
            onClick={() => save(selectedId)}
            disabled={saving || !selectedId}
            style={{
              flexShrink: 0, background: C.accent, color: "#fff", border: "none",
              borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600,
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : dirty ? "Change area" : "Confirm"}
          </button>
        )}
      </div>
    </div>
  );
}
