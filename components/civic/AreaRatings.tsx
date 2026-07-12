"use client";

// Area quality card — fixed parameters (water, electricity, …) rated 1–5 by
// residents of a unit; everyone in the area sees the average. Residents get
// tappable dots to set/update their own score (optimistic, upsert on the
// server); non-residents see averages read-only. Used above the issue board
// (Society LocalTab, /local/[unitId]).

import { useEffect, useState } from "react";

const PALETTES = {
  light: {
    border: "#E5E7EB", text: "#111827", textMuted: "#6B7280", accent: "#6366f1",
    surface: "#FFFFFF", skeleton: "#E5E7EB", bar: "#E5E7EB",
  },
  dark: {
    border: "rgba(255,255,255,0.12)", text: "#F9FAFB", textMuted: "#9CA3AF", accent: "#6366f1",
    surface: "rgba(255,255,255,0.05)", skeleton: "rgba(255,255,255,0.10)", bar: "rgba(255,255,255,0.10)",
  },
};

type Param = { key: string; label: string; icon: string };
type Avg = { avg: number; count: number };

type RatingsData = {
  parameters: Param[];
  averages: Record<string, Avg>;
  mine: Record<string, number>;
  canRate: boolean;
};

function barColor(avg: number): string {
  if (avg >= 4) return "#34D399";   // good — green
  if (avg >= 3) return "#FBBF24";   // okay — amber
  return "#F87171";                 // poor — red
}

export default function AreaRatings({
  unitId,
  theme = "light",
}: {
  unitId: string;
  theme?: "light" | "dark";
}) {
  const C = PALETTES[theme];
  const [data, setData] = useState<RatingsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [savingParam, setSavingParam] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setFailed(false);
    fetch(`/api/civic/ratings?unitId=${encodeURIComponent(unitId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d ? setData(d) : setFailed(true)))
      .catch(() => setFailed(true));
  }, [unitId]);

  async function rate(parameter: string, score: number) {
    if (!data || savingParam) return;
    setSavingParam(parameter);
    const prev = data;
    // Optimistic: set my score immediately; average refreshes from the server.
    setData({ ...data, mine: { ...data.mine, [parameter]: score } });
    try {
      const res = await fetch("/api/civic/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, parameter, score }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setData(prev); // roll back
        return;
      }
      setData((cur) =>
        cur ? { ...cur, averages: { ...cur.averages, [parameter]: d.average } } : cur
      );
    } catch {
      setData(prev);
    } finally {
      setSavingParam(null);
    }
  }

  if (failed) return null; // quality card is additive — never block the board

  return (
    <div
      style={{
        background: C.surface, border: `0.5px solid ${C.border}`,
        borderRadius: 14, padding: "14px 14px 10px", marginBottom: 14,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
        Area quality
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
        {data?.canRate
          ? "Rate your area — averages come from residents like you."
          : "Averages rated by the residents of this area."}
      </div>

      {!data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 rounded-lg animate-pulse" style={{ background: C.skeleton }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {data.parameters.map((p) => {
            const avg = data.averages[p.key];
            const my = data.mine[p.key];
            return (
              <div
                key={p.key}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 0", borderTop: `0.5px solid ${C.border}`,
                }}
              >
                <div style={{ width: 20, flexShrink: 0, textAlign: "center" }}>{p.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.label}</div>
                  {avg ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <div style={{ flex: 1, maxWidth: 120, height: 4, borderRadius: 999, background: C.bar }}>
                        <div
                          style={{
                            width: `${(avg.avg / 5) * 100}%`, height: "100%",
                            borderRadius: 999, background: barColor(avg.avg),
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{avg.avg.toFixed(1)}</span>
                      <span style={{ fontSize: 11, color: C.textMuted }}>
                        ({avg.count} rating{avg.count === 1 ? "" : "s"})
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
                      {data.canRate ? "No ratings yet — be the first." : "No ratings yet."}
                    </div>
                  )}
                </div>

                {data.canRate && (
                  <div style={{ display: "flex", gap: 3, flexShrink: 0 }} aria-label={`Rate ${p.label}`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => rate(p.key, s)}
                        disabled={savingParam !== null}
                        title={`${s} / 5`}
                        style={{
                          width: 18, height: 18, borderRadius: 999, padding: 0,
                          border: `1px solid ${my && s <= my ? C.accent : C.border}`,
                          background: my && s <= my ? C.accent : "transparent",
                          cursor: "pointer",
                          opacity: savingParam === p.key ? 0.5 : 1,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
