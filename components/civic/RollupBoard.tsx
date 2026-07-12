"use client";

// CIVIC-2 — aggregate view over the wards under a higher unit (assembly /
// parliamentary / state / country) or planet-wide (scope="earth").
// Read-only by doctrine: demands are raised and supported only in home wards
// (/local boards); higher layers show sums, never their own issue lists.

import { useEffect, useState } from "react";
import Link from "next/link";

const C = {
  border: "rgba(255,255,255,0.12)",
  text: "#F9FAFB",
  textMuted: "#9CA3AF",
  accent: "#6366f1",
  surface: "rgba(255,255,255,0.05)",
  skeleton: "rgba(255,255,255,0.10)",
};

const CHIPS: Record<string, { label: string; bg: string; fg: string }> = {
  proposed: { label: "Proposed", bg: "rgba(251,191,36,0.15)", fg: "#FCD34D" },
  active: { label: "Active", bg: "rgba(16,185,129,0.15)", fg: "#6EE7B7" },
  complete: { label: "Done ✓", bg: "rgba(45,212,191,0.15)", fg: "#5EEAD4" },
};

type RollupIssue = {
  id: string;
  title: string;
  status: string;
  supporterCount: number;
  unitId: string;
  unitName: string;
  resolvedAt: string | null;
};

type Rollup = {
  unit: { id: string; type: string; name: string } | null;
  wardCount: number;
  residentCount: number;
  countryCount?: number;
  counts: Record<string, number>;
  topIssues: RollupIssue[];
  recentDone: RollupIssue[];
};

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div
      style={{
        flex: 1, minWidth: 90, textAlign: "center", padding: "10px 8px",
        background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function RollupBoard({
  unitId,
  scope,
  heading,
  subheading,
}: {
  unitId?: string;
  scope?: "earth";
  heading?: string;
  subheading?: string;
}) {
  const [data, setData] = useState<Rollup | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const qs = scope === "earth" ? "scope=earth" : `unitId=${unitId}`;
    fetch(`/api/civic/rollup?${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d ? setData(d) : setFailed(true)))
      .catch(() => setFailed(true));
  }, [unitId, scope]);

  if (failed) {
    return (
      <div style={{ fontSize: 13, color: C.textMuted, padding: "16px 0" }}>
        Could not load this view. Try again later.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <div className="h-6 rounded animate-pulse" style={{ width: "50%", background: C.skeleton }} />
        <div className="h-16 rounded-xl animate-pulse" style={{ background: C.skeleton }} />
        <div className="h-24 rounded-xl animate-pulse" style={{ background: C.skeleton }} />
      </div>
    );
  }

  const open = (data.counts.proposed ?? 0) + (data.counts.active ?? 0);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: C.text }}>
        {heading ?? data.unit?.name ?? "Local action"}
      </h2>
      <p style={{ fontSize: 13, color: C.textMuted, margin: "4px 0 14px" }}>
        {subheading ??
          "What the local areas here are demanding — raised and decided by the residents themselves."}
      </p>

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {typeof data.countryCount === "number" && <Stat value={data.countryCount} label="countries" />}
        <Stat value={data.wardCount} label="local areas" />
        <Stat value={open} label="open demands" />
        <Stat value={data.counts.complete ?? 0} label="completed" />
        <Stat value={data.residentCount} label="residents here" />
      </div>

      {/* Top demands */}
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: C.textMuted, marginBottom: 8 }}>
        TOP DEMANDS
      </div>
      {data.topIssues.length === 0 ? (
        <div
          style={{
            textAlign: "center", padding: "28px 16px", color: C.textMuted, fontSize: 13,
            background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 12, marginBottom: 16,
          }}
        >
          No demands raised yet in the local areas here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {data.topIssues.map((issue, idx) => {
            const chip = CHIPS[issue.status] ?? CHIPS.proposed;
            return (
              <div
                key={issue.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: C.textMuted, width: 26, flexShrink: 0 }}>
                  #{idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.35 }}>
                    {issue.title}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                    <Link href={`/local/${issue.unitId}`} style={{ textDecoration: "underline" }}>
                      {issue.unitName}
                    </Link>
                    {" · "}
                    {issue.supporterCount} supporter{issue.supporterCount === 1 ? "" : "s"}
                  </div>
                </div>
                <span
                  style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "3px 8px",
                    borderRadius: 999, background: chip.bg, color: chip.fg,
                  }}
                >
                  {chip.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Recently completed — the proof the mechanism works */}
      {data.recentDone.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: C.textMuted, marginBottom: 8 }}>
            RECENTLY COMPLETED
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {data.recentDone.map((issue) => (
              <div
                key={issue.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(45,212,191,0.06)", border: "0.5px solid rgba(45,212,191,0.25)",
                  borderRadius: 12, padding: "10px 12px",
                }}
              >
                <span style={{ flexShrink: 0 }}>✅</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{issue.title}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    <Link href={`/local/${issue.unitId}`} style={{ textDecoration: "underline" }}>
                      {issue.unitName}
                    </Link>
                    {issue.resolvedAt &&
                      ` · ${new Date(issue.resolvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>
        Demands are raised and supported in home areas only — this view is the sum of that local work.
      </p>
    </div>
  );
}
