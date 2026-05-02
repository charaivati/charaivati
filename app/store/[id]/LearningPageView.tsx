"use client";

import React, { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LearningBlock = {
  id: string;
  title: string;
  description?: string | null;
  aspect?: string | null;
  lessonType?: string | null;
  blockStatus: string;
  mastery: number;
  order: number;
  mediaUrl?: string | null;
  mediaType?: string | null;
  access?: string | null;
  linkedPostId?: string | null;
};

export type LearningSection = {
  id: string;
  title: string;
  sectionType: string;
  prereqIds: string[];
  order: number;
  blocks: LearningBlock[];
};

export interface LearningPageViewProps {
  page: {
    id: string;
    title: string;
    description?: string | null;
    avatarUrl?: string | null;
  };
  course: {
    courseType: string;
    dominantAspect: string;
    aspectWeights: { physical: number; mental: number; emotional: number };
    aspectBenefits: Record<string, string | string[]>;
  };
  sections: LearningSection[];
  isOwner: boolean;
  studentProgress?: Record<string, { status: string; mastery: number }>;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  pageBg:  "#FAF8F5",
  card:    "#FFFFFF",
  border:  "#E8E4DE",
  text:    "#1A1714",
  muted:   "#888888",
  font:    "system-ui, -apple-system, sans-serif",
  mono:    "'DM Mono', 'Courier New', monospace",
};

const ASPECT: Record<string, { color: string; bg: string; label: string }> = {
  physical:  { color: "#E8633A", bg: "rgba(232,99,58,0.08)",   label: "Physical"  },
  mental:    { color: "#4A7FB5", bg: "rgba(74,127,181,0.08)",  label: "Mental"    },
  emotional: { color: "#7B5EA7", bg: "rgba(123,94,167,0.08)", label: "Emotional" },
};

const ASPECT_CONTEXT: Record<string, string> = {
  physical:  "This lesson develops physical awareness, coordination, and body intelligence.",
  mental:    "This lesson strengthens analytical reasoning, focus, and cognitive retention.",
  emotional: "This lesson builds emotional intelligence, empathy, and self-awareness.",
};

// ─── Media helpers ────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function isVideoFile(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function benefitLines(val: string | string[] | undefined): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val.filter(Boolean) : [String(val)];
}

// ─── AspectPill ───────────────────────────────────────────────────────────────

function AspectPill({ aspect, size = "sm" }: { aspect: string; size?: "sm" | "md" }) {
  const info = ASPECT[aspect] ?? { color: C.muted, bg: "#f3f3f3", label: aspect };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: size === "md" ? "6px 12px" : "3px 8px",
      borderRadius: 20, background: info.bg,
      color: info.color,
      fontSize: size === "md" ? 11 : 10,
      fontFamily: C.mono, fontWeight: 600, letterSpacing: "0.05em",
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: info.color, flexShrink: 0 }} />
      {info.label.toUpperCase()}
    </span>
  );
}

// ─── Check icon ───────────────────────────────────────────────────────────────

function Check() {
  return (
    <svg width="7" height="6" viewBox="0 0 7 6" fill="none">
      <path d="M1 3L2.8 5L6 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Content renderer ─────────────────────────────────────────────────────────

function LessonContent({
  block,
  reflection,
  setReflection,
}: {
  block: LearningBlock;
  reflection: string;
  setReflection: (v: string) => void;
}) {
  if (block.lessonType === "reflection") {
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ fontSize: 14, color: C.text, fontFamily: C.font, margin: 0, lineHeight: 1.65 }}>
          {block.description || "Take a moment to reflect on what you've learned in this lesson."}
        </p>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Write your reflection here…"
          rows={5}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 10,
            border: `1px solid ${C.border}`, background: C.pageBg,
            color: C.text, fontFamily: C.font, fontSize: 14,
            resize: "vertical", outline: "none", boxSizing: "border-box",
          }}
        />
      </div>
    );
  }

  const mediaUrl = block.mediaUrl ?? null;

  if (mediaUrl) {
    const ytId = extractYouTubeId(mediaUrl);
    if (ytId) {
      return (
        <div style={{ padding: 0, background: "#000" }}>
          <iframe
            width="100%"
            height="360"
            src={`https://www.youtube.com/embed/${ytId}`}
            frameBorder="0"
            allowFullScreen
            style={{ borderRadius: 10, display: "block" }}
          />
        </div>
      );
    }
    if (block.mediaType === "video" || isVideoFile(mediaUrl)) {
      return (
        <div style={{ padding: 0 }}>
          <video
            src={mediaUrl}
            controls
            style={{ width: "100%", borderRadius: 10, maxHeight: 360, display: "block", background: "#000" }}
          />
        </div>
      );
    }
    if (block.mediaType === "image") {
      return (
        <div style={{ padding: 24 }}>
          <img src={mediaUrl} alt={block.title} style={{ width: "100%", borderRadius: 10 }} />
        </div>
      );
    }
  }

  return (
    <div style={{ padding: 24 }}>
      {block.description ? (
        <p style={{ fontSize: 14, color: C.text, fontFamily: C.font, margin: 0, lineHeight: 1.7 }}>
          {block.description}
        </p>
      ) : (
        <p style={{ fontSize: 14, color: C.muted, fontFamily: C.font, margin: 0 }}>
          Content coming soon
        </p>
      )}
    </div>
  );
}

// ─── Block Detail Panel ───────────────────────────────────────────────────────

function BlockDetailPanel({
  block, section, prevBlock, nextBlock,
  isDone, isOwner, onMarkComplete, marking,
  onNavigate, onBack, pageId,
}: {
  block: LearningBlock;
  section: LearningSection;
  prevBlock: LearningBlock | null;
  nextBlock: LearningBlock | null;
  isDone: boolean;
  isOwner: boolean;
  onMarkComplete: () => void;
  marking: boolean;
  onNavigate: (b: LearningBlock) => void;
  onBack: () => void;
  pageId: string;
}) {
  const [reflection, setReflection] = useState("");
  const aspect = block.aspect ?? null;
  const aspectInfo = aspect ? (ASPECT[aspect] ?? null) : null;
  const isPremium = block.access === "premium" && !isOwner;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>

      {/* Back + status row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={onBack}
          style={{ fontSize: 12, color: C.muted, fontFamily: C.font, cursor: "pointer",
            background: "none", border: "none", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
        >
          ← Back
        </button>
        {aspect && <AspectPill aspect={aspect} size="sm" />}
        <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: C.mono, color: isDone ? "#E8633A" : C.muted, letterSpacing: "0.06em", fontWeight: 600 }}>
          {isDone ? "COMPLETED" : block.blockStatus.toUpperCase()}
        </span>
      </div>

      {/* Title + subtitle */}
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, fontFamily: C.font, margin: "0 0 6px", lineHeight: 1.25 }}>
          {block.title}
        </h1>
        <p style={{ fontSize: 13, color: C.muted, fontFamily: C.font, margin: 0 }}>
          {section.title}
        </p>
      </div>

      {/* Content card */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
        {isPremium ? (
          <div style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 32 }}>⭐</span>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: C.font, margin: 0 }}>
              Premium lesson
            </h3>
            <p style={{ fontSize: 14, color: C.muted, fontFamily: C.font, margin: 0 }}>
              Subscribe to unlock this lesson
            </p>
            <button style={{ marginTop: 8, padding: "10px 24px", background: "#F57F17", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>
              Subscribe
            </button>
          </div>
        ) : (
          <LessonContent block={block} reflection={reflection} setReflection={setReflection} />
        )}
      </div>

      {/* Aspect context card */}
      {aspectInfo && !isPremium && (
        <div style={{ borderLeft: `3px solid ${aspectInfo.color}`, background: aspectInfo.bg, padding: "12px 16px", borderRadius: "0 10px 10px 0" }}>
          <p style={{ fontSize: 10, fontFamily: C.mono, color: aspectInfo.color, fontWeight: 700, letterSpacing: "0.08em", margin: "0 0 5px" }}>
            {aspectInfo.label.toUpperCase()} DIMENSION
          </p>
          <p style={{ fontSize: 13, color: C.text, fontFamily: C.font, margin: 0, lineHeight: 1.55 }}>
            {aspect ? ASPECT_CONTEXT[aspect] : ""}
          </p>
        </div>
      )}

      {/* Action row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {isOwner ? (
          <a
            href={`/business/store/${pageId}`}
            style={{ fontSize: 13, color: C.text, fontFamily: C.font, fontWeight: 500,
              padding: "9px 18px", border: `1px solid ${C.border}`, borderRadius: 8,
              background: C.card, textDecoration: "none", display: "inline-block" }}
          >
            Edit in Studio →
          </a>
        ) : !isPremium ? (
          <button
            onClick={onMarkComplete}
            disabled={isDone || marking}
            style={{
              fontSize: 13, fontFamily: C.font, fontWeight: 600, cursor: isDone ? "default" : "pointer",
              padding: "9px 20px", borderRadius: 8, border: "none",
              background: isDone ? "#EEF8F4" : "#1A1714",
              color: isDone ? "#22a86b" : "#fff",
              opacity: marking ? 0.6 : 1, transition: "opacity 0.15s",
            }}
          >
            {isDone ? "✓  Completed" : marking ? "Saving…" : "Mark Complete →"}
          </button>
        ) : null}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => prevBlock && onNavigate(prevBlock)}
            disabled={!prevBlock}
            style={{ fontSize: 12, fontFamily: C.font, padding: "8px 14px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.card, cursor: prevBlock ? "pointer" : "default", color: prevBlock ? C.text : C.muted, opacity: prevBlock ? 1 : 0.4 }}
          >
            ← Prev
          </button>
          <button
            onClick={() => nextBlock && onNavigate(nextBlock)}
            disabled={!nextBlock}
            style={{ fontSize: 12, fontFamily: C.font, padding: "8px 14px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.card, cursor: nextBlock ? "pointer" : "default", color: nextBlock ? C.text : C.muted, opacity: nextBlock ? 1 : 0.4 }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LearningPageView({
  page, course, sections, isOwner, studentProgress = {},
}: LearningPageViewProps) {

  const [activeTab, setActiveTab]             = useState<"lessons" | "map">("lessons");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(sections[0]?.id ?? null);
  const [activeBlockId, setActiveBlockId]     = useState<string | null>(null);
  const [showWhy, setShowWhy]                 = useState(false);
  const [progress, setProgress]               = useState<Record<string, { status: string; mastery: number }>>(studentProgress);
  const [marking, setMarking]                 = useState(false);

  const allBlocks     = sections.flatMap((s) => s.blocks);
  const doneCount     = allBlocks.filter((b) => progress[b.id]?.status === "done").length;
  const progressPct   = allBlocks.length > 0 ? Math.round((doneCount / allBlocks.length) * 100) : 0;
  const dominantColor = ASPECT[course.dominantAspect]?.color ?? C.muted;
  const sectionLabel  = sections[0]?.sectionType === "chapter" ? "CHAPTERS" : "MODULES";

  const activeSection    = sections.find((s) => s.id === activeSectionId) ?? null;
  const blocks           = activeSection?.blocks ?? [];
  const activeBlockIndex = blocks.findIndex((b) => b.id === activeBlockId);
  const activeBlock      = activeBlockIndex >= 0 ? blocks[activeBlockIndex] : null;

  const benefits    = course.aspectBenefits ?? {};
  const hasBenefits = (["physical", "mental", "emotional"] as const).some(
    (a) => benefitLines(benefits[a]).length > 0
  );

  async function markComplete(blockId: string) {
    setMarking(true);
    try {
      await fetch("/api/course/progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ blockId, status: "done", mastery: 100 }),
      });
      setProgress((p) => ({ ...p, [blockId]: { status: "done", mastery: 100 } }));
    } finally {
      setMarking(false);
    }
  }

  return (
    <div style={{ background: C.pageBg, fontFamily: C.font, minHeight: "60vh" }}>

      {/* ── Learning header ─────────────────────────────────────────── */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 10, fontFamily: C.mono, color: C.muted, letterSpacing: "0.1em", margin: "0 0 4px", fontWeight: 500 }}>
                LEARNING · {course.courseType.toUpperCase()}
              </p>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.3 }}>
                {page.title}
              </h2>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: C.mono }}>Progress</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.text, fontFamily: C.mono }}>{progressPct}%</span>
              </div>
              <div style={{ width: 100, height: 3, background: C.border, borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${progressPct}%`, background: dominantColor, borderRadius: 2, transition: "width 0.4s ease" }} />
              </div>
            </div>
          </div>

          {hasBenefits && (
            <button
              onClick={() => setShowWhy((v) => !v)}
              style={{ marginTop: 12, fontSize: 12, color: C.muted, fontFamily: C.font, cursor: "pointer",
                background: "none", border: "none", padding: 0, display: "flex", alignItems: "center", gap: 6 }}
            >
              <span style={{ fontSize: 13 }}>◎</span>
              <span>Why this works</span>
              <span style={{ fontSize: 9, marginTop: 1 }}>{showWhy ? "▲" : "▼"}</span>
            </button>
          )}
        </div>

        {showWhy && hasBenefits && (
          <div style={{ background: "#1A1714", padding: "24px" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 28 }}>
              {(["physical", "mental", "emotional"] as const).map((a) => {
                const lines = benefitLines(benefits[a]);
                if (lines.length === 0) return null;
                return (
                  <div key={a}>
                    <AspectPill aspect={a} size="sm" />
                    <ul style={{ margin: "10px 0 0", padding: "0 0 0 14px" }}>
                      {lines.map((item, i) => (
                        <li key={i} style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", fontFamily: C.font, marginBottom: 6, lineHeight: 1.55 }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex" }}>
          {(["lessons", "map"] as const).map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  fontSize: 14, fontFamily: C.font, fontWeight: active ? 700 : 400,
                  color: active ? C.text : C.muted,
                  padding: "13px 20px", border: "none", background: "none", cursor: "pointer",
                  borderBottom: active ? `2px solid ${dominantColor}` : "2px solid transparent",
                  marginBottom: -1, textTransform: "capitalize" as const,
                }}
              >
                {tab === "map" ? "Map" : "Lessons"}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Map tab ─────────────────────────────────────────────────── */}
      {activeTab === "map" && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px" }}>
          <div style={{ background: "#EEEAE4", borderRadius: 16, padding: "64px 40px", textAlign: "center" }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: C.font, margin: "0 0 8px" }}>Knowledge map</p>
            <p style={{ fontSize: 14, color: C.muted, fontFamily: C.font, margin: "0 0 14px" }}>Coming in the next update</p>
            <p style={{ fontSize: 11, fontFamily: C.mono, color: C.muted, margin: 0, letterSpacing: "0.04em" }}>
              Concepts and their prerequisites will be visualised here
            </p>
          </div>
        </div>
      )}

      {/* ── Lessons tab ─────────────────────────────────────────────── */}
      {activeTab === "lessons" && (
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", minHeight: "calc(100vh - 240px)" }}>

          {/* ── Left sidebar ──────────────────────────────────────── */}
          <div style={{ width: 240, flexShrink: 0, background: C.card, borderRight: `1px solid ${C.border}`, overflowY: "auto", padding: "20px 0" }}>
            <p style={{ fontSize: 10, fontFamily: C.mono, color: C.muted, fontWeight: 600, letterSpacing: "0.1em", padding: "0 16px 12px", margin: 0 }}>
              {sectionLabel}
            </p>

            {sections.length === 0 ? (
              <p style={{ fontSize: 13, color: C.muted, fontFamily: C.font, padding: "0 16px" }}>No {sectionLabel.toLowerCase()} yet.</p>
            ) : sections.map((section) => {
              const sBlocks  = section.blocks;
              const sDone    = sBlocks.filter((b) => progress[b.id]?.status === "done").length;
              const sPct     = sBlocks.length > 0 ? (sDone / sBlocks.length) * 100 : 0;
              const isActive = activeSectionId === section.id;
              const isLocked = sBlocks.length > 0 && sBlocks.every((b) => b.blockStatus === "locked");

              return (
                <button
                  key={section.id}
                  disabled={isLocked}
                  onClick={() => { setActiveSectionId(section.id); setActiveBlockId(null); }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "10px 16px 12px",
                    background: isActive ? "#FAF8F5" : "transparent",
                    borderTop: "none", borderRight: "none", borderBottom: "none",
                    borderLeft: `3px solid ${isActive ? dominantColor : "transparent"}`,
                    cursor: isLocked ? "not-allowed" : "pointer",
                    opacity: isLocked ? 0.45 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: C.font, margin: 0, lineHeight: 1.3 }}>
                      {section.title}
                    </p>
                    <span style={{ fontSize: 10, fontFamily: C.mono, color: C.muted, flexShrink: 0 }}>
                      {sDone}/{sBlocks.length}
                    </span>
                  </div>
                  <div style={{ height: 2, background: C.border, borderRadius: 1, marginTop: 8 }}>
                    <div style={{ height: "100%", borderRadius: 1, transition: "width 0.3s", width: `${sPct}%`, background: sPct === 100 ? "#E8633A" : dominantColor }} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Content area ──────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", minWidth: 0 }}>

            {sections.length === 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.muted, fontSize: 14, fontFamily: C.font }}>
                No lessons yet.
              </div>
            )}

            {activeSection && activeBlock && (
              <BlockDetailPanel
                block={activeBlock}
                section={activeSection}
                prevBlock={activeBlockIndex > 0 ? blocks[activeBlockIndex - 1] : null}
                nextBlock={activeBlockIndex < blocks.length - 1 ? blocks[activeBlockIndex + 1] : null}
                isDone={progress[activeBlock.id]?.status === "done"}
                isOwner={isOwner}
                onMarkComplete={() => markComplete(activeBlock.id)}
                marking={marking}
                onNavigate={(b) => setActiveBlockId(b.id)}
                onBack={() => setActiveBlockId(null)}
                pageId={page.id}
              />
            )}

            {activeSection && !activeBlock && (
              blocks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: C.muted, fontSize: 14, fontFamily: C.font }}>
                  No lessons yet.
                </div>
              ) : (
                <div>
                  {blocks.map((block) => {
                    const done       = progress[block.id]?.status === "done";
                    const isActiveBl = block.id === activeBlockId;
                    const isLocked   = block.blockStatus === "locked";
                    const isPremium  = block.access === "premium" && !isOwner;
                    const isFriends  = block.access === "friends" && !isOwner;
                    const aspect     = block.aspect ?? null;
                    const aspectInfo = aspect ? (ASPECT[aspect] ?? null) : null;

                    return (
                      <button
                        key={block.id}
                        disabled={isLocked}
                        onClick={() => !isLocked && setActiveBlockId(block.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          width: "100%", textAlign: "left",
                          padding: "11px 14px", marginBottom: 2,
                          background: isActiveBl ? C.card : "transparent",
                          borderTop: "none", borderRight: "none", borderBottom: "none",
                          borderLeft: `3px solid ${isActiveBl && aspectInfo ? aspectInfo.color : "transparent"}`,
                          cursor: isLocked ? "not-allowed" : "pointer",
                          opacity: isLocked ? 0.4 : 1,
                          borderRadius: isActiveBl ? 8 : 0,
                        }}
                      >
                        {/* Completion circle */}
                        <div style={{
                          width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: done ? "#E8633A" : "transparent",
                          border: done ? "none" : isActiveBl ? "2px solid #4A7FB5" : `2px solid ${C.border}`,
                        }}>
                          {done && <Check />}
                        </div>

                        {/* Title + lesson type */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, color: C.text, fontFamily: C.font, margin: 0, lineHeight: 1.4, fontWeight: isActiveBl ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {block.title}
                          </p>
                          {block.lessonType && (
                            <p style={{ fontSize: 10, fontFamily: C.mono, color: C.muted, margin: "2px 0 0", letterSpacing: "0.05em" }}>
                              {block.lessonType.toUpperCase()}
                            </p>
                          )}
                        </div>

                        {/* Aspect dot */}
                        {aspectInfo && (
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: aspectInfo.color, flexShrink: 0 }} />
                        )}

                        {/* Access badges */}
                        {isFriends && (
                          <span style={{ fontSize: 10, flexShrink: 0 }} title="Friends only">👥</span>
                        )}
                        {isPremium && (
                          <span style={{ fontSize: 10, flexShrink: 0, color: "#F57F17" }} title="Premium">⭐</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
