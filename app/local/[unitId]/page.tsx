"use client";

// CIVIC-1 — Local issue board for one unit (ward/panchayat/assembly).
// Ranked demands, raise-an-issue flow, resident-only upvotes, lifecycle tabs.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const C = {
  bg: "#F3F4F6",
  border: "#E5E7EB",
  text: "#111827",
  textMuted: "#6B7280",
  accent: "#6366f1",
  surface: "#FFFFFF",
};

const STATUS_CHIP: Record<string, { label: string; bg: string; fg: string }> = {
  proposed: { label: "Proposed", bg: "#FEF3C7", fg: "#92400E" },
  active: { label: "Active", bg: "#D1FAE5", fg: "#065F46" },
  complete: { label: "Done ✓", bg: "#CCFBF1", fg: "#115E59" },
  archived: { label: "Archived", bg: "#E5E7EB", fg: "#4B5563" },
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

function IssueSkeleton() {
  return (
    <div style={{ background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" style={{ width: "70%" }} />
      <div className="h-3 bg-gray-200 rounded animate-pulse mb-2" style={{ width: "90%" }} />
      <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: "35%" }} />
    </div>
  );
}

export default function LocalUnitPage() {
  const params = useParams<{ unitId: string }>();
  const unitId = params.unitId;

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

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 96px" }}>
        {/* Header */}
        {info ? (
          <div style={{ marginBottom: 16 }}>
            {info.parents.length > 0 && (
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
                {[...info.parents].reverse().map((p) => p.name).join(" › ")}
              </div>
            )}
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{info.unit.name}</h1>
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
              {info.residentCount} resident{info.residentCount === 1 ? "" : "s"} on Charaivati
              {isResident && <span style={{ color: "#065F46" }}> · 🏠 Your home area</span>}
            </div>
            {!isResident && (
              <div
                style={{
                  marginTop: 10, padding: "10px 12px", borderRadius: 10, fontSize: 13,
                  background: "#EEF2FF", border: "0.5px solid #C7D2FE", color: "#3730A3",
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
            <div className="h-3 bg-gray-200 rounded animate-pulse mb-2" style={{ width: "40%" }} />
            <div className="h-6 bg-gray-200 rounded animate-pulse mb-2" style={{ width: "60%" }} />
            <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: "45%" }} />
          </div>
        ) : null}

        {error && (
          <div
            style={{
              marginBottom: 12, padding: "10px 12px", borderRadius: 10, fontSize: 13,
              background: "#FEE2E2", border: "0.5px solid #FECACA", color: "#991B1B",
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
                  border: "none", background: isResident ? C.accent : "#D1D5DB",
                  color: "#fff", cursor: isResident ? "pointer" : "not-allowed",
                }}
              >
                + Raise an issue
              </button>
            ) : (
              <div style={{ background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>What does this area need?</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={140}
                  placeholder="e.g. Drainage near the market floods every monsoon"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                    border: `1px solid ${C.border}`, marginBottom: 8, background: C.bg,
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
                    border: `1px solid ${C.border}`, marginBottom: 10, background: C.bg, resize: "vertical",
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
            <IssueSkeleton />
            <IssueSkeleton />
            <IssueSkeleton />
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
              const chip = STATUS_CHIP[issue.status] ?? STATUS_CHIP.proposed;
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
                        background: issue.supportedByMe ? "#EEF2FF" : C.bg,
                        color: issue.supportedByMe ? C.accent : C.textMuted,
                        opacity: supporting === issue.id || (!isResident && issue.status !== "complete") ? 0.5 : 1,
                        cursor: isResident ? "pointer" : "not-allowed",
                      }}
                    >
                      ▲
                    </button>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{issue.supporterCount}</div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>
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
      </div>
    </div>
  );
}
