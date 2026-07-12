"use client";

// CIVIC-1 — reusable Local issue board for one unit (ward/panchayat/assembly).
// Ranked demands, raise-an-issue flow, resident-only upvotes, lifecycle tabs.
// Prop-driven (DiscoveryView precedent): standalone /local/[unitId] renders it
// light + full-page; the Society "Panchayat/Ward" tab embeds it dark.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Palette = {
  bg: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  surface: string;
  inputBg: string;
  skeleton: string;
  disabled: string;
  info: { bg: string; border: string; fg: string };
  error: { bg: string; border: string; fg: string };
  homeFg: string;
};

const PALETTES: Record<"light" | "dark", Palette> = {
  light: {
    bg: "#F3F4F6",
    border: "#E5E7EB",
    text: "#111827",
    textMuted: "#6B7280",
    accent: "#6366f1",
    surface: "#FFFFFF",
    inputBg: "#F3F4F6",
    skeleton: "#E5E7EB",
    disabled: "#D1D5DB",
    info: { bg: "#EEF2FF", border: "#C7D2FE", fg: "#3730A3" },
    error: { bg: "#FEE2E2", border: "#FECACA", fg: "#991B1B" },
    homeFg: "#065F46",
  },
  dark: {
    bg: "transparent",
    border: "rgba(255,255,255,0.12)",
    text: "#F9FAFB",
    textMuted: "#9CA3AF",
    accent: "#6366f1",
    surface: "rgba(255,255,255,0.05)",
    inputBg: "rgba(255,255,255,0.07)",
    skeleton: "rgba(255,255,255,0.10)",
    disabled: "rgba(255,255,255,0.15)",
    info: { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.35)", fg: "#C7D2FE" },
    error: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", fg: "#FCA5A5" },
    homeFg: "#6EE7B7",
  },
};

const STATUS_CHIPS: Record<
  "light" | "dark",
  Record<string, { label: string; bg: string; fg: string }>
> = {
  light: {
    proposed: { label: "Proposed", bg: "#FEF3C7", fg: "#92400E" },
    active: { label: "Active", bg: "#D1FAE5", fg: "#065F46" },
    complete: { label: "Done ✓", bg: "#CCFBF1", fg: "#115E59" },
    archived: { label: "Archived", bg: "#E5E7EB", fg: "#4B5563" },
  },
  dark: {
    proposed: { label: "Proposed", bg: "rgba(251,191,36,0.15)", fg: "#FCD34D" },
    active: { label: "Active", bg: "rgba(16,185,129,0.15)", fg: "#6EE7B7" },
    complete: { label: "Done ✓", bg: "rgba(45,212,191,0.15)", fg: "#5EEAD4" },
    archived: { label: "Archived", bg: "rgba(255,255,255,0.08)", fg: "#9CA3AF" },
  },
};

type UnitInfo = {
  unit: { id: string; type: string; name: string };
  parents: { id: string; type: string; name: string }[];
  residentCount: number;
  isHomeUnit: boolean;
  myHomeUnitId: string | null;
};

type IssueItem = {
  id: string;
  title: string;
  body: string;
  status: string;
  supporterCount: number;
  supportedByMe: boolean;
  authorName: string;
  createdAt: string;
};

type TabKey = "open" | "done" | "archived";
const TABS: { key: TabKey; label: string }[] = [
  { key: "open", label: "Active" },
  { key: "done", label: "Done" },
  { key: "archived", label: "Archived" },
];

function IssueSkeleton({ C }: { C: Palette }) {
  return (
    <div style={{ background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div className="h-4 rounded animate-pulse mb-2" style={{ width: "70%", background: C.skeleton }} />
      <div className="h-3 rounded animate-pulse mb-2" style={{ width: "90%", background: C.skeleton }} />
      <div className="h-3 rounded animate-pulse" style={{ width: "35%", background: C.skeleton }} />
    </div>
  );
}

export default function IssueBoard({
  unitId,
  standalone = false,
  theme = "light",
}: {
  unitId: string;
  standalone?: boolean;
  theme?: "light" | "dark";
}) {
  const C = PALETTES[theme];
  const CHIPS = STATUS_CHIPS[theme];

  const [info, setInfo] = useState<UnitInfo | null>(null);
  const [issues, setIssues] = useState<IssueItem[] | null>(null);
  const [tab, setTab] = useState<TabKey>("open");
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [supporting, setSupporting] = useState<string | null>(null);
  const [settingHome, setSettingHome] = useState(false);

  const loadInfo = useCallback(async () => {
    const res = await fetch(`/api/civic/units/${unitId}`);
    if (!res.ok) {
      setError(res.status === 404 ? "This area doesn't exist." : "Sign in to view this board.");
      return;
    }
    setInfo(await res.json());
  }, [unitId]);

  const loadIssues = useCallback(
    async (t: TabKey) => {
      setIssues(null);
      const res = await fetch(`/api/civic/issues?unitId=${unitId}&tab=${t}`);
      if (res.ok) setIssues((await res.json()).issues);
      else setIssues([]);
    },
    [unitId]
  );

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    loadIssues(tab);
  }, [tab, loadIssues]);

  const isResident = info?.isHomeUnit === true;

  async function toggleSupport(issueId: string) {
    if (supporting === issueId || !isResident) return;
    setSupporting(issueId);
    try {
      const res = await fetch(`/api/civic/issues/${issueId}/support`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setIssues((prev) =>
          prev
            ? prev.map((i) =>
                i.id === issueId
                  ? { ...i, supportedByMe: data.supported, supporterCount: data.supporterCount, status: data.status }
                  : i
              )
            : prev
        );
      }
    } finally {
      setSupporting(null);
    }
  }

  async function raiseIssue() {
    if (posting || !title.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/civic/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, title, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not post the issue.");
        return;
      }
      setTitle("");
      setBody("");
      setShowForm(false);
      loadIssues("open");
      if (tab !== "open") setTab("open");
    } finally {
      setPosting(false);
    }
  }

  async function makeHomeUnit() {
    if (settingHome) return;
    setSettingHome(true);
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
      loadInfo();
    } finally {
      setSettingHome(false);
    }
  }

  const content = (
    <>
      {/* Header */}
      {info ? (
        <div style={{ marginBottom: 16 }}>
          {info.parents.length > 0 && (
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
              {[...info.parents].reverse().map((p) => p.name).join(" › ")}
            </div>
          )}
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: C.text }}>{info.unit.name}</h1>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
            {info.residentCount} resident{info.residentCount === 1 ? "" : "s"} on Charaivati
            {isResident && <span style={{ color: C.homeFg }}> · 🏠 Your home area</span>}
          </div>
          {!isResident && (
            <div
              style={{
                marginTop: 10, padding: "10px 12px", borderRadius: 10, fontSize: 13,
                background: C.info.bg, border: `0.5px solid ${C.info.border}`, color: C.info.fg,
              }}
            >
              {info.myHomeUnitId ? (
                <>
                  You can raise and support issues only in your home area.{" "}
                  <Link href={`/local/${info.myHomeUnitId}`} style={{ fontWeight: 600, textDecoration: "underline" }}>
                    Go to your area →
                  </Link>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span>Live here? Set this as your home area to take part.</span>
                  <button
                    onClick={makeHomeUnit}
                    disabled={settingHome}
                    style={{
                      flexShrink: 0, background: C.accent, color: "#fff", border: "none",
                      borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600,
                      opacity: settingHome ? 0.5 : 1,
                    }}
                  >
                    {settingHome ? "Saving…" : "This is my area"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : !error ? (
        <div style={{ marginBottom: 16 }}>
          <div className="h-3 rounded animate-pulse mb-2" style={{ width: "40%", background: C.skeleton }} />
          <div className="h-6 rounded animate-pulse mb-2" style={{ width: "60%", background: C.skeleton }} />
          <div className="h-3 rounded animate-pulse" style={{ width: "45%", background: C.skeleton }} />
        </div>
      ) : null}

      {error && (
        <div
          style={{
            marginBottom: 12, padding: "10px 12px", borderRadius: 10, fontSize: 13,
            background: C.error.bg, border: `0.5px solid ${C.error.border}`, color: C.error.fg,
          }}
        >
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: `0.5px solid ${tab === t.key ? C.accent : C.border}`,
              background: tab === t.key ? C.accent : C.surface,
              color: tab === t.key ? "#fff" : C.textMuted,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Raise an issue */}
      {tab === "open" && (
        <div style={{ marginBottom: 14 }}>
          {!showForm ? (
            <button
              onClick={() => (isResident ? setShowForm(true) : undefined)}
              disabled={!isResident}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 15, fontWeight: 600,
                border: "none", background: isResident ? C.accent : C.disabled,
                color: "#fff", cursor: isResident ? "pointer" : "not-allowed",
              }}
            >
              + Raise an issue
            </button>
          ) : (
            <div style={{ background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: C.text }}>
                What does this area need?
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                placeholder="e.g. Drainage near the market floods every monsoon"
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                  border: `1px solid ${C.border}`, marginBottom: 8, background: C.inputBg, color: C.text,
                }}
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Add details — where exactly, who it affects, since when (optional)"
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                  border: `1px solid ${C.border}`, marginBottom: 10, background: C.inputBg, color: C.text,
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={raiseIssue}
                  disabled={posting || !title.trim()}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 14, fontWeight: 600,
                    border: "none", background: C.accent, color: "#fff",
                    opacity: posting || !title.trim() ? 0.5 : 1,
                  }}
                >
                  {posting ? "Posting…" : "Post issue"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  style={{
                    padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                    border: `0.5px solid ${C.border}`, background: C.surface, color: C.textMuted,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Issue list */}
      {issues === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <IssueSkeleton C={C} />
          <IssueSkeleton C={C} />
          <IssueSkeleton C={C} />
        </div>
      ) : issues.length === 0 ? (
        <div
          style={{
            textAlign: "center", padding: "40px 20px", color: C.textMuted, fontSize: 14,
            background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 12,
          }}
        >
          {tab === "open"
            ? "No issues yet. Be the first to raise what this area needs."
            : tab === "done"
            ? "Nothing completed yet — the Done list is this area's track record."
            : "No archived issues."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {issues.map((issue, idx) => {
            const chip = CHIPS[issue.status] ?? CHIPS.proposed;
            return (
              <div
                key={issue.id}
                style={{
                  background: C.surface, border: `0.5px solid ${C.border}`,
                  borderRadius: 12, padding: 14, display: "flex", gap: 12,
                }}
              >
                {/* Upvote */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <button
                    onClick={() => toggleSupport(issue.id)}
                    disabled={supporting === issue.id || !isResident || issue.status === "archived"}
                    title={!isResident ? "Only residents can support" : undefined}
                    style={{
                      width: 44, height: 44, borderRadius: 10, fontSize: 16, fontWeight: 700,
                      border: `1px solid ${issue.supportedByMe ? C.accent : C.border}`,
                      background: issue.supportedByMe ? C.info.bg : C.inputBg,
                      color: issue.supportedByMe ? C.accent : C.textMuted,
                      opacity: supporting === issue.id || (!isResident && issue.status !== "complete") ? 0.5 : 1,
                      cursor: isResident ? "pointer" : "not-allowed",
                    }}
                  >
                    ▲
                  </button>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: C.text }}>
                    {issue.supporterCount}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: C.text }}>
                      {tab === "open" && <span style={{ color: C.textMuted, fontWeight: 700 }}>#{idx + 1} </span>}
                      {issue.title}
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
                  {issue.body && (
                    <div
                      style={{
                        fontSize: 13, color: C.textMuted, marginTop: 4, lineHeight: 1.45,
                        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}
                    >
                      {issue.body}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>
                    {issue.supporterCount} of ~{info?.residentCount ?? "?"} residents on the platform
                    {" · "}
                    {new Date(issue.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  if (!standalone) return <div>{content}</div>;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 96px" }}>{content}</div>
    </div>
  );
}
