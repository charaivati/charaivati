"use client";

// CIVIC-1 — home-unit picker: lists ward/panchayat units, sets the caller's
// home location via POST /api/civic/home-unit. Used by the Society
// "Panchayat/Ward" tab (dark) and the /local index page (light).
//
// Address-based placement (CIVIC geo-resolution v1): on mount the picker also
// asks GET /api/civic/suggest-unit to rank units against the user's saved
// addresses. Matches render as a dropdown pre-selected to the best candidate;
// with `autoApply` and a unique high-confidence top match the picker places
// the user automatically ({ auto: true } — does not start the 90-day lock, so
// a wrong guess stays correctable via the change dropdown above the board).

import { useEffect, useMemo, useRef, useState } from "react";

const PALETTES = {
  light: {
    border: "#E5E7EB", text: "#111827", textMuted: "#6B7280", accent: "#6366f1",
    surface: "#FFFFFF", inputBg: "#F3F4F6", skeleton: "#E5E7EB",
    error: { bg: "#FEE2E2", border: "#FECACA", fg: "#991B1B" },
    hint: { bg: "#EEF2FF", border: "#C7D2FE", fg: "#3730A3" },
  },
  dark: {
    border: "rgba(255,255,255,0.12)", text: "#F9FAFB", textMuted: "#9CA3AF", accent: "#6366f1",
    surface: "rgba(255,255,255,0.05)", inputBg: "rgba(255,255,255,0.07)", skeleton: "rgba(255,255,255,0.10)",
    error: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", fg: "#FCA5A5" },
    hint: { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", fg: "#C7D2FE" },
  },
};

type UnitRow = {
  id: string;
  type: string;
  name: string;
  parentName: string | null;
  grandparentName: string | null;
};

type Suggestion = {
  id: string;
  type: string;
  name: string;
  parentName: string | null;
  score: number;
};

type SuggestResponse = {
  ok: boolean;
  address: { id: string; city: string; state: string; pincode: string } | null;
  suggestions: Suggestion[];
  autoPlaceScore: number;
};

export default function UnitPicker({
  onSet,
  theme = "light",
  autoApply = false,
}: {
  /** meta.auto is true when the unit was placed from a saved address without a click. */
  onSet: (unitId: string, meta?: { auto?: boolean }) => void;
  theme?: "light" | "dark";
  /** Place automatically on a unique high-confidence address match. */
  autoApply?: boolean;
}) {
  const C = PALETTES[theme];
  const [units, setUnits] = useState<UnitRow[] | null>(null);
  const [suggest, setSuggest] = useState<SuggestResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);

  useEffect(() => {
    fetch("/api/civic/units")
      .then((r) => (r.ok ? r.json() : { units: [] }))
      .then((d) => setUnits(d.units ?? []))
      .catch(() => setUnits([]));
    fetch("/api/civic/suggest-unit")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSuggest(d))
      .catch(() => setSuggest(null));
  }, []);

  // Pre-select the best suggestion; auto-place when allowed and unambiguous.
  useEffect(() => {
    if (!suggest?.suggestions?.length) return;
    const [top, second] = suggest.suggestions;
    setSelectedId((cur) => cur || top.id);

    if (
      autoApply &&
      !autoTried.current &&
      top.score >= suggest.autoPlaceScore &&
      (!second || second.score < top.score)
    ) {
      autoTried.current = true;
      (async () => {
        try {
          const res = await fetch("/api/civic/home-unit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ unitId: top.id, auto: true }),
          });
          // 409 = home unit already set elsewhere (race) — either way, done.
          if (res.ok) onSet(top.id, { auto: true });
        } catch { /* fall back to the manual picker below */ }
      })();
    }
  }, [suggest, autoApply, onSet]);

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
    if (saving || !unitId) return;
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

  const suggestions = suggest?.suggestions ?? [];
  const suggestedIds = new Set(suggestions.map((s) => s.id));
  const addr = suggest?.address;

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

      {/* Address-based suggestion — dropdown pre-selected to the best match */}
      {suggestions.length > 0 && units && (
        <div
          style={{
            marginBottom: 14, padding: "12px", borderRadius: 12,
            background: C.hint.bg, border: `0.5px solid ${C.hint.border}`,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: C.hint.fg, marginBottom: 8 }}>
            📍 Matched from your saved address
            {addr ? ` (${[addr.city, addr.state].filter(Boolean).join(", ")}${addr.pincode ? ` · ${addr.pincode}` : ""})` : ""}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{
                flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10, fontSize: 14,
                border: `1px solid ${C.border}`, background: C.inputBg, color: C.text,
              }}
            >
              <optgroup label="Suggested for you">
                {suggestions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.parentName ? ` — ${s.parentName}` : ""}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All areas">
                {units.filter((u) => !suggestedIds.has(u.id)).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}{u.parentName ? ` — ${u.parentName}` : ""}
                  </option>
                ))}
              </optgroup>
            </select>
            <button
              onClick={() => pick(selectedId)}
              disabled={!selectedId || saving !== null}
              style={{
                flexShrink: 0, background: C.accent, color: "#fff", border: "none",
                borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600,
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? "Saving…" : "This is my area"}
            </button>
          </div>
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
