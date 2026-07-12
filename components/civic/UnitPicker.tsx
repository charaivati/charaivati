"use client";

// CIVIC-1 — home-unit picker: lists ward/panchayat units, sets the caller's
// home location via POST /api/civic/home-unit. Used by the Society
// "Panchayat/Ward" tab (dark) and the /local index page (light).
//
// Address-based placement (geo-resolution v1): on mount the picker also asks
// GET /api/civic/suggest-unit to rank units against the user's saved
// addresses. Matches render as a dropdown pre-selected to the best candidate;
// with `autoApply` and a unique high-confidence VERIFIED top match the picker
// places the user automatically ({ auto: true } — does not start the 90-day
// lock, so a wrong guess stays correctable).
//
// Public-driven coverage: "Can't find your area? Add it" lets any user
// propose a missing ward/panchayat under an existing state/constituency.
// Proposed units start "pending" (labelled unverified) and verify
// automatically once UNIT_VERIFY_RESIDENTS users claim them as home.

import { useEffect, useMemo, useRef, useState } from "react";

const PALETTES = {
  light: {
    border: "#E5E7EB", text: "#111827", textMuted: "#6B7280", accent: "#6366f1",
    surface: "#FFFFFF", inputBg: "#F3F4F6", skeleton: "#E5E7EB",
    error: { bg: "#FEE2E2", border: "#FECACA", fg: "#991B1B" },
    hint: { bg: "#EEF2FF", border: "#C7D2FE", fg: "#3730A3" },
    pending: { bg: "rgba(251,191,36,0.15)", fg: "#B45309" },
  },
  dark: {
    border: "rgba(255,255,255,0.12)", text: "#F9FAFB", textMuted: "#9CA3AF", accent: "#6366f1",
    surface: "rgba(255,255,255,0.05)", inputBg: "rgba(255,255,255,0.07)", skeleton: "rgba(255,255,255,0.10)",
    error: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", fg: "#FCA5A5" },
    hint: { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", fg: "#C7D2FE" },
    pending: { bg: "rgba(251,191,36,0.15)", fg: "#FCD34D" },
  },
};

type UnitRow = {
  id: string;
  type: string;
  name: string;
  status?: string;
  parentName: string | null;
  grandparentName: string | null;
  residentCount?: number;
};

type Suggestion = {
  id: string;
  type: string;
  name: string;
  status?: string;
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
  const [verifyResidents, setVerifyResidents] = useState(3);
  const [suggest, setSuggest] = useState<SuggestResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);

  // Propose-a-unit form
  const [showPropose, setShowPropose] = useState(false);
  const [pName, setPName] = useState("");
  const [pType, setPType] = useState<"ward" | "panchayat">("panchayat");
  const [pStateId, setPStateId] = useState("");
  const [pAreaId, setPAreaId] = useState("");
  const [states, setStates] = useState<UnitRow[] | null>(null);
  const [areas, setAreas] = useState<UnitRow[] | null>(null);
  const [proposing, setProposing] = useState(false);

  useEffect(() => {
    fetch("/api/civic/units")
      .then((r) => (r.ok ? r.json() : { units: [] }))
      .then((d) => {
        setUnits(d.units ?? []);
        if (typeof d.verifyResidents === "number") setVerifyResidents(d.verifyResidents);
      })
      .catch(() => setUnits([]));
    fetch("/api/civic/suggest-unit")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSuggest(d))
      .catch(() => setSuggest(null));
  }, []);

  // Load states + constituencies lazily when the propose form opens.
  useEffect(() => {
    if (!showPropose || states !== null) return;
    fetch("/api/civic/units?type=state")
      .then((r) => (r.ok ? r.json() : { units: [] }))
      .then((d) => setStates(d.units ?? []))
      .catch(() => setStates([]));
    fetch("/api/civic/units?type=assembly")
      .then((r) => (r.ok ? r.json() : { units: [] }))
      .then((d) => setAreas(d.units ?? []))
      .catch(() => setAreas([]));
  }, [showPropose, states]);

  // Pre-select the best suggestion; auto-place when allowed, unambiguous and verified.
  useEffect(() => {
    if (!suggest?.suggestions?.length) return;
    const [top, second] = suggest.suggestions;
    setSelectedId((cur) => cur || top.id);

    if (
      autoApply &&
      !autoTried.current &&
      top.status !== "pending" && // never auto-place into an unverified area
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

  // States/constituency options for the propose form. Constituencies are
  // filtered to the chosen state via parent/grandparent names (chain: state →
  // parliamentary → assembly, so the state can be either of them).
  const stateName = states?.find((s) => s.id === pStateId)?.name ?? null;
  const areasForState = useMemo(() => {
    if (!areas || !stateName) return [];
    return areas.filter(
      (a) => a.parentName === stateName || a.grandparentName === stateName
    );
  }, [areas, stateName]);

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

  async function propose() {
    const name = pName.trim();
    const parentId = pAreaId || pStateId;
    if (!name || !parentId || proposing) return;
    setProposing(true);
    setError(null);
    try {
      const res = await fetch("/api/civic/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: pType, parentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.unitId) {
        // Already exists — just set it as home.
        await pick(data.unitId);
        return;
      }
      if (!res.ok || !data?.unit?.id) {
        setError(data.error || "Could not add this area.");
        return;
      }
      // Proposer becomes the first resident (manual pick — starts the lock).
      await pick(data.unit.id);
    } finally {
      setProposing(false);
    }
  }

  function pendingBadge(u: { status?: string; residentCount?: number }) {
    if (u.status !== "pending") return null;
    return (
      <span
        style={{
          fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999,
          background: C.pending.bg, color: C.pending.fg, marginLeft: 6, whiteSpace: "nowrap",
        }}
      >
        unverified · {Math.min(u.residentCount ?? 0, verifyResidents)} of {verifyResidents}
      </span>
    );
  }

  const suggestions = suggest?.suggestions ?? [];
  const suggestedIds = new Set(suggestions.map((s) => s.id));
  const addr = suggest?.address;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
    border: `1px solid ${C.border}`, background: C.inputBg, color: C.text,
  };

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
              style={{ ...inputStyle, flex: 1, minWidth: 0, width: undefined }}
            >
              <optgroup label="Suggested for you">
                {suggestions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.parentName ? ` — ${s.parentName}` : ""}{s.status === "pending" ? " (unverified)" : ""}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All areas">
                {units.filter((u) => !suggestedIds.has(u.id)).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}{u.parentName ? ` — ${u.parentName}` : ""}{u.status === "pending" ? " (unverified)" : ""}
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
        style={{ ...inputStyle, marginBottom: 10 }}
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
          No areas match — add yours below.
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
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                  {u.name}
                  {pendingBadge(u)}
                </div>
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

      {/* Public-driven coverage — propose a missing area */}
      <div style={{ marginTop: 14 }}>
        {!showPropose ? (
          <button
            onClick={() => setShowPropose(true)}
            style={{
              background: "transparent", border: "none", padding: 0,
              fontSize: 13, fontWeight: 600, color: C.accent, cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Can&apos;t find your area? Add it →
          </button>
        ) : (
          <div
            style={{
              padding: 12, borderRadius: 12,
              background: C.surface, border: `0.5px solid ${C.border}`,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>
              Add your area
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
              It starts as unverified and becomes a full area once {verifyResidents} residents join it.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={pType}
                  onChange={(e) => setPType(e.target.value as "ward" | "panchayat")}
                  style={{ ...inputStyle, width: 130, flexShrink: 0 }}
                >
                  <option value="panchayat">Panchayat</option>
                  <option value="ward">Ward</option>
                </select>
                <input
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder={pType === "ward" ? "Ward name / number…" : "Panchayat name…"}
                  maxLength={80}
                  style={{ ...inputStyle, flex: 1, width: undefined }}
                />
              </div>
              <select
                value={pStateId}
                onChange={(e) => { setPStateId(e.target.value); setPAreaId(""); }}
                style={inputStyle}
              >
                <option value="">Select state…</option>
                {(states ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {pStateId && areasForState.length > 0 && (
                <select
                  value={pAreaId}
                  onChange={(e) => setPAreaId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Constituency (optional)…</option>
                  {areasForState.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={propose}
                  disabled={!pName.trim() || !pStateId || proposing}
                  style={{
                    background: C.accent, color: "#fff", border: "none",
                    borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600,
                    opacity: !pName.trim() || !pStateId || proposing ? 0.5 : 1,
                  }}
                >
                  {proposing ? "Adding…" : "Add & make it my area"}
                </button>
                <button
                  onClick={() => setShowPropose(false)}
                  style={{
                    background: "transparent", border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: "9px 14px", fontSize: 13, color: C.textMuted,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
