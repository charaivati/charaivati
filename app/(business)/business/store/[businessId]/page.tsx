"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import SelectTabsModal from "@/components/SelectTabsModal";

// ─── Types ───────────────────────────────────────────────────────────────────

type MediaType = "image" | "video" | "link" | "none";
type ActionType = "view" | "buy" | "book" | "contact";
type SectionType = "grid" | "list" | "featured" | "carousel";
type AspectType = "physical" | "mental" | "emotional";
type LessonType = "video" | "reading" | "practice" | "reflection" | "quiz";

interface Block {
  id: string;
  title: string;
  description?: string | null;
  mediaType: MediaType;
  mediaUrl?: string | null;
  actionType: ActionType;
  price?: number | null;
  aspect?: AspectType | null;
  lessonType?: LessonType | null;
  blockStatus?: string;
  lessonTags?: string[];
}

interface Section {
  id: string;
  title: string;
  type: SectionType;
  sectionType?: string;
  prereqIds?: string[];
  blocks: Block[];
}

interface Store {
  id: string;
  name: string;
  description?: string | null;
}

interface CourseData {
  id: string;
  courseType: string;
  dominantAspect: string;
  aspectWeights: { physical: number; mental: number; emotional: number };
  aspectBenefits: Record<string, string>;
  courseTags?: string[];
}

// ─── Shared constants ─────────────────────────────────────────────────────────

const ASPECT_META: Record<AspectType, { label: string; color: string }> = {
  physical:  { label: "Physical",  color: "#E8633A" },
  mental:    { label: "Mental",    color: "#4A7FB5" },
  emotional: { label: "Emotional", color: "#7B5EA7" },
};

const LESSON_TYPES: LessonType[] = ["video", "reading", "practice", "reflection", "quiz"];

// ─── Bulk import types & parsers ──────────────────────────────────────────────

type ParsedLesson = { title: string; aspect: string; lessonType: string; duration: string };
type ParsedChapter = { title: string; lessons: ParsedLesson[] };

const VALID_ASPECTS = ["physical", "mental", "emotional"];
const VALID_TYPES   = ["video", "reading", "practice", "reflection", "quiz"];

function parsePlainText(text: string): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];
  let current: ParsedChapter | null = null;
  for (const raw of text.split("\n")) {
    const line = raw;
    if (!line.trim()) continue;
    const chapterMatch = line.match(/^(?:Chapter|Module|Practice|Section):\s*(.+)/i);
    if (chapterMatch) { current = { title: chapterMatch[1].trim(), lessons: [] }; chapters.push(current); continue; }
    const lessonMatch = line.match(/^\s*(?:Lesson|Concept):\s*(.+)/i);
    if (lessonMatch && current) {
      const parts = lessonMatch[1].split("|").map((p) => p.trim());
      const title      = parts[0] ?? "";
      const aspectRaw  = (parts[1] ?? "").toLowerCase();
      const typeRaw    = (parts[2] ?? "").toLowerCase();
      const duration   = parts[3] ?? "";
      current.lessons.push({
        title,
        aspect:     VALID_ASPECTS.includes(aspectRaw) ? aspectRaw : "mental",
        lessonType: VALID_TYPES.includes(typeRaw) ? typeRaw : "reading",
        duration,
      });
    }
  }
  return chapters;
}

function parseJSONImport(text: string): ParsedChapter[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("Expected a JSON array");
  return data.map((item: any) => ({
    title: String(item.chapter ?? item.title ?? "Untitled"),
    lessons: (item.lessons ?? item.blocks ?? []).map((l: any) => ({
      title:      String(l.title ?? ""),
      aspect:     VALID_ASPECTS.includes(String(l.aspect ?? "").toLowerCase()) ? String(l.aspect).toLowerCase() : "mental",
      lessonType: VALID_TYPES.includes(String(l.type ?? l.lessonType ?? "").toLowerCase()) ? String(l.type ?? l.lessonType).toLowerCase() : "reading",
      duration:   String(l.duration ?? ""),
    })),
  }));
}

function buildAIPrompt(courseTags?: string[]): string {
  const tagsLine = courseTags && courseTags.length > 0
    ? `- Tags: use these course tags where relevant: ${courseTags.join(", ")}\n  You may also add specific lesson tags alongside these.`
    : `- Tags: comma-separated keywords that describe each lesson (optional)`;
  return `I have a [subject] course I want to structure.
Convert the following content into this exact plain text format:

Chapter: [Chapter title]
  Lesson: [Lesson title] | [Aspect] | [Type] | [Duration]
  Lesson: [Lesson title] | [Aspect] | [Type] | [Duration]

Chapter: [Next chapter title]
  Lesson: [Lesson title] | [Aspect] | [Type] | [Duration]

Rules:
- Aspect must be one of: Mental, Physical, Emotional
  Mental = thinking, understanding, reasoning, memory
  Physical = body, movement, hands-on, spatial
  Emotional = feelings, motivation, confidence, reflection
- Type must be one of: Video, Reading, Practice, Reflection, Quiz
- Duration is estimated time e.g. "10 min", "30 min"
${tagsLine}
- One lesson per line, indented under its chapter
- No extra text, just the formatted structure

Here is my content:
[PASTE YOUR CONTENT HERE]`;
}

// ─── Course label helper ──────────────────────────────────────────────────────

function getCourseLabels(courseType: string) {
  switch (courseType) {
    case "academic":
      return { sectionType: "chapter", sectionLabel: "Chapter", blockLabel: "Concept", addBtnLabel: "+ Add Chapter", accentColor: "#4A7FB5", badge: "◉ ACADEMIC" };
    case "art":
      return { sectionType: "module",  sectionLabel: "Module",  blockLabel: "Lesson",  addBtnLabel: "+ Add Module",  accentColor: "#E8633A", badge: "◈ ART" };
    case "growth":
      return { sectionType: "branch",  sectionLabel: "Practice",blockLabel: "Lesson",  addBtnLabel: "+ Add Practice",accentColor: "#E8633A", badge: "◈ GROWTH" };
    default:
      return { sectionType: "module",  sectionLabel: "Module",  blockLabel: "Lesson",  addBtnLabel: "+ Add Module",  accentColor: "#E8633A", badge: "◈ SKILL" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEARNING EDITOR COMPONENTS (new, only rendered for pageType === "learning")
// ─────────────────────────────────────────────────────────────────────────────

function LearningOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

// ── Course banner (replaces dark CourseMetaBar for learning pages) ─────────────

function LearningCourseBanner({
  course, sections, courseTags, onTagsChange, onOpenTagModal,
}: {
  course: CourseData;
  sections: Section[];
  courseTags: string[];
  onTagsChange: (tags: string[]) => void;
  onOpenTagModal: () => void;
}) {
  const allBlocks = sections.flatMap((s) => s.blocks);
  const counts = {
    physical:  allBlocks.filter((b) => b.aspect === "physical").length,
    mental:    allBlocks.filter((b) => b.aspect === "mental").length,
    emotional: allBlocks.filter((b) => b.aspect === "emotional").length,
  };
  const total = Math.max(counts.physical + counts.mental + counts.emotional, 1);
  const { badge, accentColor } = getCourseLabels(course.courseType);

  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #E8E4DE", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", padding: "4px 10px", borderRadius: 20, background: `${accentColor}18`, color: accentColor, fontFamily: "monospace" }}>
          {badge}
        </span>
        <div>
          <div style={{ width: 120, height: 6, borderRadius: 3, background: "#E8E4DE", display: "flex", overflow: "hidden" }}>
            {(["physical", "mental", "emotional"] as AspectType[]).map((a) => (
              <div key={a} style={{ width: `${(counts[a] / total) * 100}%`, background: ASPECT_META[a].color, minWidth: counts[a] > 0 ? 3 : 0 }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {(["physical", "mental", "emotional"] as AspectType[]).map((a) =>
              counts[a] > 0 ? (
                <span key={a} style={{ fontSize: 9, color: "#888", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 2 }}>
                  <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: ASPECT_META[a].color }} />
                  {counts[a]}
                </span>
              ) : null
            )}
          </div>
        </div>
      </div>
      <button
        onClick={() => alert("Course Settings coming soon")}
        style={{ fontSize: 12, color: "#888", padding: "6px 14px", border: "1px solid #E8E4DE", borderRadius: 8, background: "transparent", cursor: "pointer", flexShrink: 0, fontFamily: "system-ui, sans-serif" }}
      >
        Course Settings
      </button>

      {/* Course tags row */}
      <div style={{ width: "100%", borderTop: "1px solid #E8E4DE", marginTop: 10, paddingTop: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "#aaa", fontFamily: "monospace", letterSpacing: "0.08em", flexShrink: 0 }}>COURSE TAGS</span>
        {courseTags.length === 0 ? (
          <span style={{ fontSize: 11, color: "#bbb", fontFamily: "system-ui, sans-serif" }}>No tags yet</span>
        ) : (
          courseTags.map((tag) => (
            <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#F5F2EE", color: "#555", fontFamily: "system-ui, sans-serif" }}>
              {tag}
              <button onClick={() => onTagsChange(courseTags.filter((t) => t !== tag))}
                style={{ cursor: "pointer", background: "none", border: "none", color: "#999", lineHeight: 1, padding: 0, fontSize: 13 }}>×</button>
            </span>
          ))
        )}
        <button onClick={onOpenTagModal}
          style={{ fontSize: 11, color: "#4A7FB5", border: "1px solid #E8E4DE", borderRadius: 6, padding: "3px 10px", background: "transparent", cursor: "pointer", fontFamily: "system-ui, sans-serif", flexShrink: 0 }}>
          Browse Tags ▸
        </button>
      </div>
    </div>
  );
}

// ── Add section modal ─────────────────────────────────────────────────────────

function LearningAddSectionModal({
  storeId, sections, course, onCreated, onClose,
}: {
  storeId: string;
  sections: Section[];
  course: CourseData;
  onCreated: (section: Section) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [prereqIds, setPrereqIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { sectionType, sectionLabel, accentColor } = getCourseLabels(course.courseType);

  function togglePrereq(id: string) {
    setPrereqIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    const res = await fetch("/api/section", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ storeId, title: title.trim(), sectionType, prereqIds }),
    });
    if (res.ok) {
      const section = await res.json();
      onCreated({ ...section, blocks: [] });
      onClose();
    }
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #E8E4DE", fontSize: 14, color: "#1A1714", outline: "none", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" };

  return (
    <LearningOverlay onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1A1714", margin: 0, fontFamily: "system-ui, sans-serif" }}>
          New {sectionLabel}
        </h3>

        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${sectionLabel} title`} style={inputStyle} />

        <div style={{ padding: "8px 12px", borderRadius: 8, background: "#FAF8F5", fontSize: 12, color: "#888", fontFamily: "system-ui, sans-serif" }}>
          Type: <strong style={{ color: "#1A1714" }}>{sectionLabel}</strong>
        </div>

        {course.courseType === "academic" && sections.length > 0 && (
          <div>
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px", fontFamily: "system-ui, sans-serif" }}>Prerequisites (optional)</p>
            {sections.map((s) => (
              <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer" }}>
                <input type="checkbox" checked={prereqIds.includes(s.id)} onChange={() => togglePrereq(s.id)} style={{ accentColor: "#4A7FB5", width: 14, height: 14 }} />
                <span style={{ fontSize: 13, color: "#1A1714", fontFamily: "system-ui, sans-serif" }}>{s.title}</span>
              </label>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={loading || !title.trim()}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: accentColor, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading || !title.trim() ? 0.5 : 1, fontFamily: "system-ui, sans-serif" }}>
            {loading ? "Creating…" : `Create ${sectionLabel}`}
          </button>
          <button type="button" onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #E8E4DE", background: "transparent", fontSize: 13, color: "#888", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
            Cancel
          </button>
        </div>
      </form>
    </LearningOverlay>
  );
}

// ── Add block modal ───────────────────────────────────────────────────────────

function LearningAddBlockModal({
  sectionId, courseType, onCreated, onClose,
}: {
  sectionId: string;
  courseType: string;
  onCreated: (block: Block) => void;
  onClose: () => void;
}) {
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [aspect, setAspect]         = useState<AspectType | "">("");
  const [lessonType, setLessonType] = useState<LessonType | "">("");
  const [duration, setDuration]     = useState("");
  const [loading, setLoading]       = useState(false);

  const { blockLabel, accentColor } = getCourseLabels(courseType);

  const ASPECT_STYLES: Record<AspectType, { bg: string; color: string }> = {
    physical:  { bg: "rgba(232,99,58,0.1)",   color: "#E8633A" },
    mental:    { bg: "rgba(74,127,181,0.1)",  color: "#4A7FB5" },
    emotional: { bg: "rgba(123,94,167,0.1)", color: "#7B5EA7" },
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    const res = await fetch("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionId,
        title: title.trim(),
        description: description.trim() || null,
        aspect: aspect || null,
        lessonType: lessonType || null,
        blockStatus: "unlocked",
        mastery: 0,
        actionType: "view",
        mediaType: "none",
      }),
    });
    if (res.ok) {
      onCreated(await res.json());
      onClose();
    }
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #E8E4DE", fontSize: 14, color: "#1A1714", outline: "none", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" };
  const labelStyle: React.CSSProperties = { fontSize: 10, color: "#888", marginBottom: 8, fontFamily: "monospace", letterSpacing: "0.07em", display: "block" };

  return (
    <LearningOverlay onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1A1714", margin: 0, fontFamily: "system-ui, sans-serif" }}>
          New {blockLabel}
        </h3>

        <div>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${blockLabel} title`} style={inputStyle} />
        </div>

        <div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2}
            style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        {/* Aspect */}
        <div>
          <span style={labelStyle}>ASPECT</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["physical", "mental", "emotional"] as AspectType[]).map((a) => {
              const s = ASPECT_STYLES[a];
              const selected = aspect === a;
              return (
                <button key={a} type="button" onClick={() => setAspect(aspect === a ? "" : a)}
                  style={{ padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "system-ui, sans-serif", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5, background: selected ? s.color : s.bg, color: selected ? "#fff" : s.color }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: selected ? "#fff" : s.color, display: "inline-block" }} />
                  {ASPECT_META[a].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lesson type */}
        <div>
          <span style={labelStyle}>LESSON TYPE</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {LESSON_TYPES.map((lt) => (
              <button key={lt} type="button" onClick={() => setLessonType(lessonType === lt ? "" : lt)}
                style={{ padding: "6px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontFamily: "system-ui, sans-serif", border: lessonType === lt ? "none" : "1px solid #E8E4DE", background: lessonType === lt ? "#1A1714" : "transparent", color: lessonType === lt ? "#fff" : "#888", textTransform: "capitalize" }}>
                {lt}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div>
          <span style={labelStyle}>DURATION</span>
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder='e.g. "15 min"' style={inputStyle} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={loading || !title.trim()}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: accentColor, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading || !title.trim() ? 0.5 : 1, fontFamily: "system-ui, sans-serif" }}>
            {loading ? "Adding…" : `Add ${blockLabel}`}
          </button>
          <button type="button" onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #E8E4DE", background: "transparent", fontSize: 13, color: "#888", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
            Cancel
          </button>
        </div>
      </form>
    </LearningOverlay>
  );
}

// ── Bulk import modal ─────────────────────────────────────────────────────────

function BulkImportModal({
  storeId, courseType, courseTags, onSectionCreated, onClose, onOpenTagModal,
}: {
  storeId: string;
  courseType: string;
  courseTags?: string[];
  onSectionCreated: (s: Section) => void;
  onClose: () => void;
  onOpenTagModal?: () => void;
}) {
  const [tab, setTab]               = useState<"text" | "json">("text");
  const [rawText, setRawText]       = useState("");
  const [parsed, setParsed]         = useState<ParsedChapter[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting]   = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [showAIHelper, setShowAIHelper] = useState(true);
  const [copied, setCopied]         = useState(false);

  const { sectionType, sectionLabel } = getCourseLabels(courseType);
  const totalLessons  = parsed?.reduce((s, c) => s + c.lessons.length, 0) ?? 0;
  const totalChapters = parsed?.length ?? 0;

  // Debounced parse
  useEffect(() => {
    if (!rawText.trim()) { setParsed(null); setParseError(null); return; }
    const t = setTimeout(() => {
      try {
        const result = tab === "json" ? parseJSONImport(rawText) : parsePlainText(rawText);
        setParsed(result.length > 0 ? result : null);
        setParseError(result.length === 0 ? "No chapters found — check the format." : null);
      } catch (e: any) {
        setParsed(null);
        setParseError(e.message ?? "Parse error");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [rawText, tab]);

  async function doImport() {
    if (!parsed || parsed.length === 0) return;
    setImporting(true);
    for (let i = 0; i < parsed.length; i++) {
      const chapter = parsed[i];
      setImportProgress(`Creating ${sectionLabel.toLowerCase()} ${i + 1} of ${parsed.length}…`);
      const sRes = await fetch("/api/section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ storeId, title: chapter.title, sectionType, prereqIds: [] }),
      });
      if (!sRes.ok) continue;
      const section = await sRes.json();
      const blocks: Block[] = [];
      for (const lesson of chapter.lessons) {
        if (!lesson.title.trim()) continue;
        const bRes = await fetch("/api/block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sectionId: section.id,
            title: lesson.title,
            aspect: lesson.aspect,
            lessonType: lesson.lessonType,
            blockStatus: "unlocked",
            mastery: 0,
            actionType: "view",
            mediaType: "none",
          }),
        });
        if (bRes.ok) blocks.push(await bRes.json());
      }
      onSectionCreated({ ...section, blocks });
    }
    setImporting(false);
    onClose();
  }

  const aiPrompt = buildAIPrompt(courseTags);

  function copyPrompt() {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(aiPrompt).then(done).catch(() => fallbackCopy());
    } else {
      fallbackCopy();
    }
    function fallbackCopy() {
      const ta = document.createElement("textarea");
      ta.value = aiPrompt;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try { document.execCommand("copy"); done(); } catch {}
      document.body.removeChild(ta);
    }
  }

  const IS = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #E8E4DE", fontSize: 13, color: "#1A1714", outline: "none", boxSizing: "border-box" as const, fontFamily: "monospace" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 640, background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 24px 64px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto", fontFamily: "system-ui, sans-serif" }}>

        {/* Header */}
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1A1714", margin: "0 0 4px" }}>Import course structure</h3>
        <p style={{ fontSize: 13, color: "#888", margin: "0 0 20px" }}>
          Paste JSON or plain text. You can use AI to convert any syllabus into this format.
        </p>

        {/* AI helper toggle */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowAIHelper(v => !v)}
            style={{ fontSize: 12, color: "#4A7FB5", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <span>{showAIHelper ? "▾" : "▸"}</span>
            <span>✦ Get AI to format your content</span>
          </button>
          {showAIHelper && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, color: "#888", margin: "0 0 8px" }}>
                Copy this prompt → open ChatGPT, Claude, or Gemini → paste your textbook or notes after it → paste the result below
              </p>
              <div style={{ background: "#F5F2EE", borderRadius: 8, padding: 14, fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap", color: "#333", lineHeight: 1.6 }}>
                {aiPrompt}
              </div>
              <button onClick={copyPrompt}
                style={{ marginTop: 8, padding: "5px 12px", borderRadius: 5, background: "#1A1714", color: "#fff", fontSize: 11, border: "none", cursor: "pointer" }}>
                {copied ? "Copied ✓" : "Copy prompt"}
              </button>
            </div>
          )}
        </div>

        {/* Course tags context */}
        {courseTags && courseTags.length > 0 ? (
          <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 8, background: "rgba(74,127,181,0.08)", border: "1px solid rgba(74,127,181,0.2)" }}>
            <p style={{ fontSize: 12, color: "#4A7FB5", margin: 0, fontFamily: "system-ui, sans-serif" }}>
              ✦ Your course tags: <strong>{courseTags.join(", ")}</strong>
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 8, background: "#FAF8F5", border: "1px solid #E8E4DE" }}>
            <p style={{ fontSize: 12, color: "#888", margin: 0, fontFamily: "system-ui, sans-serif" }}>
              💡 Set course tags first for better AI suggestions →{" "}
              {onOpenTagModal && (
                <button onClick={() => { onClose(); onOpenTagModal(); }}
                  style={{ fontSize: 12, color: "#4A7FB5", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                  Browse Tags
                </button>
              )}
            </p>
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid #E8E4DE", marginBottom: 14 }}>
          {(["text", "json"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setRawText(""); setParsed(null); setParseError(null); }}
              style={{ padding: "8px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 13, color: tab === t ? "#1A1714" : "#888", fontWeight: tab === t ? 700 : 400, borderBottom: tab === t ? "2px solid #1A1714" : "2px solid transparent", marginBottom: -1 }}>
              {t === "text" ? "Plain text" : "JSON"}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          style={{ ...IS, minHeight: 280, resize: "vertical", display: "block", marginBottom: 14, lineHeight: 1.6 }}
          placeholder={tab === "text"
            ? `Chapter: Laws of Motion\n  Lesson: What is force? | Mental | Video | 10 min\n  Lesson: Newton's First Law | Mental | Reading | 8 min\n\nChapter: Work and Energy\n  Lesson: Definition of work | Mental | Video | 12 min`
            : `[\n  {\n    "chapter": "Laws of Motion",\n    "lessons": [\n      { "title": "What is force?", "aspect": "mental", "type": "video", "duration": "10 min" }\n    ]\n  }\n]`
          }
        />

        {/* Preview */}
        {(parsed || parseError) && (
          <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: parseError ? "#FEF2F2" : "#F0FDF4", border: `1px solid ${parseError ? "#FCA5A5" : "#86EFAC"}` }}>
            {parseError ? (
              <p style={{ fontSize: 13, color: "#EF4444", margin: 0 }}>{parseError}</p>
            ) : parsed && (
              <>
                <p style={{ fontSize: 13, color: "#16A34A", margin: "0 0 6px", fontWeight: 600 }}>
                  Will create: {totalChapters} {totalChapters === 1 ? sectionLabel.toLowerCase() : sectionLabel.toLowerCase() + "s"}, {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
                </p>
                {parsed.map((c, i) => (
                  <p key={i} style={{ fontSize: 12, color: "#15803D", margin: "2px 0", fontFamily: "monospace" }}>
                    {c.title} ({c.lessons.length} lesson{c.lessons.length !== 1 ? "s" : ""})
                  </p>
                ))}
              </>
            )}
          </div>
        )}

        {/* Progress */}
        {importing && (
          <p style={{ fontSize: 13, color: "#4A7FB5", margin: "0 0 14px", fontFamily: "monospace" }}>{importProgress}</p>
        )}

        {/* Footer */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={doImport} disabled={importing || !parsed || totalLessons === 0}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#4A7FB5", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: importing || !parsed || totalLessons === 0 ? 0.5 : 1 }}>
            {importing ? importProgress || "Importing…" : `Import ${totalLessons} lesson${totalLessons !== 1 ? "s" : ""}`}
          </button>
          <button onClick={onClose} disabled={importing}
            style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #E8E4DE", background: "transparent", fontSize: 13, color: "#888", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Block edit modal (with media upload) ──────────────────────────────────────

function LearningBlockEditModal({
  block, sectionId, courseType, courseTags, onUpdated, onClose,
}: {
  block: Block;
  sectionId: string;
  courseType: string;
  courseTags?: string[];
  onUpdated: (b: Block) => void;
  onClose: () => void;
}) {
  const [title, setTitle]           = useState(block.title);
  const [description, setDescription] = useState(block.description ?? "");
  const [aspect, setAspect]         = useState<AspectType | "">(block.aspect ?? "");
  const [lessonType, setLessonType] = useState<LessonType | "">(block.lessonType ?? "");
  const [duration, setDuration]     = useState("");
  const [mediaUrl, setMediaUrl]     = useState(block.mediaUrl ?? "");
  const [mediaType, setMediaType]   = useState<MediaType>(block.mediaType ?? "none");
  const [lessonTags, setLessonTags] = useState<string[]>(block.lessonTags ?? []);
  const [access, setAccess]         = useState<"free" | "friends" | "premium">((block as any).access ?? "free");
  const [showTagModal, setShowTagModal] = useState(false);
  const [linkInput, setLinkInput]   = useState("");
  const [saving, setSaving]         = useState(false);
  const fileRef                     = useRef<HTMLInputElement>(null);
  const cloudinary                  = useCloudinaryUpload();

  const { blockLabel, accentColor } = getCourseLabels(courseType);

  const ASPECT_STYLES: Record<AspectType, { bg: string; color: string }> = {
    physical:  { bg: "rgba(232,99,58,0.1)",   color: "#E8633A" },
    mental:    { bg: "rgba(74,127,181,0.1)",  color: "#4A7FB5" },
    emotional: { bg: "rgba(123,94,167,0.1)", color: "#7B5EA7" },
  };

  async function handleFile(file: File) {
    const isVideo = file.type.startsWith("video/");
    try {
      const result = isVideo
        ? await cloudinary.uploadFiles([], file)
        : await cloudinary.uploadFiles([file], null);
      if (isVideo && result.videoUrl) { setMediaUrl(result.videoUrl); setMediaType("video"); }
      else if (!isVideo && result.imageUrls.length > 0) { setMediaUrl(result.imageUrls[0]); setMediaType("image"); }
    } catch (e) { console.error("Upload failed", e); }
  }

  function applyLink() {
    const url = linkInput.trim();
    if (!url) return;
    setMediaUrl(url);
    setMediaType("link");
    setLinkInput("");
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/block", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        blockId: block.id,
        title: title.trim(),
        description: description.trim() || null,
        aspect: aspect || null,
        lessonType: lessonType || null,
        mediaType: mediaUrl ? mediaType : "none",
        mediaUrl: mediaUrl || null,
        lessonTags,
        access,
      }),
    });
    if (res.ok) { onUpdated(await res.json()); onClose(); }
    setSaving(false);
  }

  const IS: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #E8E4DE", fontSize: 14, color: "#1A1714", outline: "none", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" };
  const LS: React.CSSProperties = { fontSize: 10, color: "#888", marginBottom: 8, fontFamily: "monospace", letterSpacing: "0.07em", display: "block" };

  return (
    <>
    <LearningOverlay onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1A1714", margin: 0, fontFamily: "system-ui, sans-serif" }}>
          Edit {blockLabel}
        </h3>

        <div><input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder={`${blockLabel} title`} style={IS} /></div>
        <div><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} style={{ ...IS, resize: "vertical" }} /></div>

        {/* Aspect */}
        <div>
          <span style={LS}>ASPECT</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["physical", "mental", "emotional"] as AspectType[]).map(a => {
              const s = ASPECT_STYLES[a]; const selected = aspect === a;
              return (
                <button key={a} type="button" onClick={() => setAspect(aspect === a ? "" : a)}
                  style={{ padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: 5, background: selected ? s.color : s.bg, color: selected ? "#fff" : s.color }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: selected ? "#fff" : s.color, display: "inline-block" }} />
                  {ASPECT_META[a].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lesson type */}
        <div>
          <span style={LS}>LESSON TYPE</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {LESSON_TYPES.map(lt => (
              <button key={lt} type="button" onClick={() => setLessonType(lessonType === lt ? "" : lt)}
                style={{ padding: "6px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontFamily: "system-ui, sans-serif", border: lessonType === lt ? "none" : "1px solid #E8E4DE", background: lessonType === lt ? "#1A1714" : "transparent", color: lessonType === lt ? "#fff" : "#888", textTransform: "capitalize" }}>
                {lt}
              </button>
            ))}
          </div>
        </div>

        {/* Duration (UI only — no schema field) */}
        <div>
          <span style={LS}>DURATION</span>
          <input value={duration} onChange={e => setDuration(e.target.value)} placeholder='e.g. "15 min"' style={IS} />
        </div>

        {/* Media */}
        <div>
          <span style={LS}>VIDEO OR IMAGE</span>
          {mediaUrl ? (
            <div style={{ position: "relative" }}>
              {mediaType === "image" ? (
                <img src={mediaUrl} alt="media" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8 }} />
              ) : mediaType === "video" ? (
                <div style={{ width: "100%", height: 90, background: "#1A1714", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontSize: 28 }}>▶</span>
                </div>
              ) : (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#F5F2EE", fontSize: 12, fontFamily: "monospace", color: "#555", wordBreak: "break-all" }}>{mediaUrl}</div>
              )}
              <button onClick={() => { setMediaUrl(""); setMediaType("none"); }}
                style={{ position: "absolute", top: 6, right: 6, fontSize: 11, padding: "3px 8px", borderRadius: 5, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer" }}>
                Remove
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={cloudinary.uploading}
                  style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px dashed #E8E4DE", background: "#FAF8F5", color: "#888", fontSize: 12, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
                  {cloudinary.uploading ? `Uploading ${cloudinary.progress}%…` : "↑ Upload file"}
                </button>
                {cloudinary.uploading && (
                  <div style={{ marginTop: 4, height: 3, background: "#E8E4DE", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${cloudinary.progress}%`, background: "#4A7FB5", borderRadius: 2, transition: "width 0.3s" }} />
                  </div>
                )}
              </div>
              <input value={linkInput} onChange={e => setLinkInput(e.target.value)}
                onBlur={applyLink} onKeyDown={e => e.key === "Enter" && applyLink()}
                placeholder="YouTube / link URL"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #E8E4DE", fontSize: 13, color: "#1A1714", outline: "none", fontFamily: "system-ui, sans-serif" }} />
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <span style={LS}>TAGS</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {lessonTags.length === 0 && (
              <span style={{ fontSize: 12, color: "#bbb", fontFamily: "system-ui, sans-serif" }}>No tags yet</span>
            )}
            {lessonTags.map((tag) => (
              <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#F5F2EE", color: "#555", fontFamily: "system-ui, sans-serif" }}>
                {tag}
                <button onClick={() => setLessonTags((t) => t.filter((x) => x !== tag))}
                  style={{ cursor: "pointer", background: "none", border: "none", color: "#999", lineHeight: 1, padding: 0, fontSize: 13 }}>×</button>
              </span>
            ))}
          </div>
          <button type="button" onClick={() => setShowTagModal(true)}
            style={{ fontSize: 12, color: "#4A7FB5", border: "1px solid #E8E4DE", borderRadius: 6, padding: "5px 12px", background: "transparent", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
            Add tags ▸
          </button>
        </div>

        {/* Access / Privacy */}
        <div>
          <span style={LS}>ACCESS</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {([
              { value: "free",    label: "🌐 Free",    bg: "#E8F5E9", color: "#2E7D32" },
              { value: "friends", label: "👥 Friends", bg: "#E3F2FD", color: "#1565C0" },
              { value: "premium", label: "⭐ Premium", bg: "#FFF8E1", color: "#F57F17" },
            ] as const).map(({ value, label, bg, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => setAccess(value)}
                style={{
                  padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, fontFamily: "system-ui, sans-serif",
                  background: access === value ? bg : "#F5F2EE",
                  color: access === value ? color : "#888",
                  outline: access === value ? `2px solid ${color}44` : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} disabled={saving || !title.trim() || cloudinary.uploading}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: accentColor, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving || !title.trim() || cloudinary.uploading ? 0.5 : 1, fontFamily: "system-ui, sans-serif" }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #E8E4DE", background: "transparent", fontSize: 13, color: "#888", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
            Cancel
          </button>
        </div>
      </div>
    </LearningOverlay>

    {showTagModal && (
      <SelectTabsModal
        initialSelected={lessonTags.length > 0 ? lessonTags : (courseTags ?? [])}
        onClose={(sel) => {
          if (sel !== undefined) setLessonTags(sel);
          setShowTagModal(false);
        }}
      />
    )}
    </>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function LearningSectionCard({
  section, sections, courseType, courseTags, onBlockCreated, onBlockRemoved, onSectionRemoved, onBlockUpdated,
}: {
  section: Section;
  sections: Section[];
  courseType: string;
  courseTags?: string[];
  onBlockCreated: (sectionId: string, block: Block) => void;
  onBlockRemoved: (sectionId: string, blockId: string) => void;
  onSectionRemoved: (sectionId: string) => void;
  onBlockUpdated: (sectionId: string, block: Block) => void;
}) {
  const [addingBlock, setAddingBlock]   = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const { blockLabel, accentColor } = getCourseLabels(courseType);

  const aspectCounts = {
    physical:  section.blocks.filter((b) => b.aspect === "physical").length,
    mental:    section.blocks.filter((b) => b.aspect === "mental").length,
    emotional: section.blocks.filter((b) => b.aspect === "emotional").length,
  };

  const prereqNames = (section.prereqIds ?? [])
    .map((id) => sections.find((s) => s.id === id)?.title)
    .filter((t): t is string => !!t);

  async function deleteBlock(blockId: string) {
    const res = await fetch("/api/block", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ blockId }),
    });
    if (res.ok) onBlockRemoved(section.id, blockId);
  }

  async function deleteSection() {
    if (!confirm(`Delete "${section.title}" and all its lessons? This cannot be undone.`)) return;
    const res = await fetch("/api/section", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sectionId: section.id }),
    });
    if (res.ok) onSectionRemoved(section.id);
  }

  const btnBase: React.CSSProperties = { fontSize: 11, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "system-ui, sans-serif", flexShrink: 0, lineHeight: 1 };

  return (
    <div style={{ background: "#fff", border: "1px solid #E8E4DE", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
      {/* Card header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #E8E4DE", flexWrap: "wrap" }}>
        <span style={{ color: "#ccc", cursor: "grab", fontSize: 16, flexShrink: 0, userSelect: "none" }}>⠿</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#1A1714", margin: 0, lineHeight: 1.3, fontFamily: "system-ui, sans-serif" }}>
            {section.title}
          </p>
          {prereqNames.length > 0 && (
            <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0", fontFamily: "system-ui, sans-serif" }}>
              Needs: {prereqNames.join(", ")}
            </p>
          )}
        </div>

        {/* Aspect dot summary */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {(["physical", "mental", "emotional"] as AspectType[]).map((a) =>
            aspectCounts[a] > 0 ? (
              <div key={a} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: ASPECT_META[a].color }} />
                <span style={{ fontSize: 10, color: "#888", fontFamily: "monospace" }}>{aspectCounts[a]}</span>
              </div>
            ) : null
          )}
        </div>

        <button onClick={() => setAddingBlock(true)} style={{ ...btnBase, border: `1px solid ${accentColor}44`, background: `${accentColor}12`, color: accentColor }}>
          + {blockLabel}
        </button>
        <button onClick={() => alert("Section editing coming soon")} style={{ ...btnBase, border: "1px solid #E8E4DE", background: "transparent", color: "#888" }}>
          Edit
        </button>
        <button onClick={deleteSection} style={{ ...btnBase, border: "1px solid #fca5a5", background: "rgba(239,68,68,0.06)", color: "#ef4444" }}>
          Delete
        </button>
      </div>

      {/* Block rows */}
      {section.blocks.length === 0 ? (
        <div style={{ padding: "14px 20px", textAlign: "center", fontSize: 13, color: "#bbb", fontFamily: "system-ui, sans-serif" }}>
          No {blockLabel.toLowerCase()}s yet
        </div>
      ) : (
        section.blocks.map((block, idx) => {
          const aspectColor = block.aspect ? (ASPECT_META[block.aspect]?.color ?? "#E8E4DE") : "#E8E4DE";
          const isLast = idx === section.blocks.length - 1;
          return (
            <div key={block.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: isLast ? "none" : "1px solid #F5F3F0", flexWrap: "wrap" }}>
              <span style={{ color: "#ccc", cursor: "grab", fontSize: 14, flexShrink: 0, userSelect: "none" }}>⠿</span>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: aspectColor, flexShrink: 0 }} />
              <p style={{ flex: 1, fontSize: 13, color: "#1A1714", margin: 0, lineHeight: 1.4, fontFamily: "system-ui, sans-serif", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {block.title}
              </p>
              {block.lessonType && (
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                  {block.lessonType}
                </span>
              )}
              {(block as any).blockStatus === "media_deleted" && (
                <span title="Video was deleted from your feed post" style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid #fca5a5", flexShrink: 0, fontFamily: "system-ui, sans-serif", cursor: "default" }}>
                  ⚠ video removed
                </span>
              )}
              <button onClick={() => setEditingBlock(block)} style={{ ...btnBase, border: "1px solid #E8E4DE", background: "transparent", color: "#888" }}>
                Edit
              </button>
              <button onClick={() => deleteBlock(block.id)} style={{ ...btnBase, border: "1px solid #fca5a5", background: "rgba(239,68,68,0.06)", color: "#ef4444" }}>
                Delete
              </button>
            </div>
          );
        })
      )}

      {/* Inline add button */}
      <div style={{ padding: "10px 16px" }}>
        <button onClick={() => setAddingBlock(true)}
          style={{ width: "100%", fontSize: 12, color: "#888", border: "1px dashed #E8E4DE", borderRadius: 8, padding: "8px", background: "transparent", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}>
          + Add {blockLabel}
        </button>
      </div>

      {addingBlock && (
        <LearningAddBlockModal
          sectionId={section.id}
          courseType={courseType}
          onCreated={(block) => { onBlockCreated(section.id, block); setAddingBlock(false); }}
          onClose={() => setAddingBlock(false)}
        />
      )}

      {editingBlock && (
        <LearningBlockEditModal
          block={editingBlock}
          sectionId={section.id}
          courseType={courseType}
          courseTags={courseTags}
          onUpdated={(updated) => { onBlockUpdated(section.id, updated); setEditingBlock(null); }}
          onClose={() => setEditingBlock(null)}
        />
      )}
    </div>
  );
}

// ── Learning editor content area ──────────────────────────────────────────────

function LearningEditorContent({
  store, sections, course, pageId, onSectionCreated, onSectionRemoved, onBlockCreated, onBlockRemoved, onBlockUpdated,
}: {
  store: Store;
  sections: Section[];
  course: CourseData;
  pageId: string;
  onSectionCreated: (s: Section) => void;
  onSectionRemoved: (id: string) => void;
  onBlockCreated: (sectionId: string, block: Block) => void;
  onBlockRemoved: (sectionId: string, blockId: string) => void;
  onBlockUpdated: (sectionId: string, block: Block) => void;
}) {
  const [addingSection, setAddingSection] = useState(false);
  const [importing, setImporting]         = useState(false);
  const [showTagModal, setShowTagModal]   = useState(false);
  const [courseTags, setCourseTags]       = useState<string[]>(course.courseTags ?? []);
  const { addBtnLabel, accentColor, sectionLabel } = getCourseLabels(course.courseType);

  async function saveCourseTags(tags: string[]) {
    setCourseTags(tags);
    await fetch(`/api/course/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ courseTags: tags }),
    }).catch(() => {});
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Course metadata banner */}
      <LearningCourseBanner
        course={course}
        sections={sections}
        courseTags={courseTags}
        onTagsChange={saveCourseTags}
        onOpenTagModal={() => setShowTagModal(true)}
      />

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 20px" }}>
      {/* Primary add + import buttons */}
      <div style={{ marginBottom: 20, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => setAddingSection(true)}
          style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: accentColor, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
        >
          {addBtnLabel}
        </button>
        <button
          onClick={() => setImporting(true)}
          style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #E8E4DE", background: "#fff", color: "#666", fontSize: 12, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
        >
          ↑ Import
        </button>
      </div>

      {/* Empty state */}
      {sections.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px", border: "2px dashed #E8E4DE", borderRadius: 12, color: "#888" }}>
          <p style={{ fontSize: 14, marginBottom: 6, color: "#1A1714", fontWeight: 600 }}>No {sectionLabel}s yet</p>
          <p style={{ fontSize: 13, margin: 0 }}>Create your first {sectionLabel.toLowerCase()} to start adding lessons.</p>
        </div>
      )}

      {/* Section cards */}
      {sections.map((section) => (
        <LearningSectionCard
          key={section.id}
          section={section}
          sections={sections}
          courseType={course.courseType}
          courseTags={courseTags}
          onBlockCreated={onBlockCreated}
          onBlockRemoved={onBlockRemoved}
          onSectionRemoved={onSectionRemoved}
          onBlockUpdated={onBlockUpdated}
        />
      ))}

      {/* Add section modal */}
      {addingSection && (
        <LearningAddSectionModal
          storeId={store.id}
          sections={sections}
          course={course}
          onCreated={(section) => { onSectionCreated(section); setAddingSection(false); }}
          onClose={() => setAddingSection(false)}
        />
      )}

      {/* Bulk import modal */}
      {importing && (
        <BulkImportModal
          storeId={store.id}
          courseType={course.courseType}
          courseTags={courseTags}
          onSectionCreated={(section) => { onSectionCreated(section); }}
          onClose={() => setImporting(false)}
          onOpenTagModal={() => { setImporting(false); setShowTagModal(true); }}
        />
      )}

      {/* Course tag modal */}
      {showTagModal && (
        <SelectTabsModal
          initialSelected={courseTags}
          onClose={(sel) => {
            if (sel !== undefined) saveCourseTags(sel);
            setShowTagModal(false);
          }}
        />
      )}
      </div>{/* end inner max-width div */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING STORE EDITOR COMPONENTS (unchanged — non-learning path only)
// ─────────────────────────────────────────────────────────────────────────────

function actionLabel(a: ActionType) {
  return { view: "View", buy: "Buy Now", book: "Book", contact: "Contact" }[a];
}

function BlockCard({
  block,
  onRemove,
}: {
  block: Block;
  onRemove: () => void;
}) {
  return (
    <div className="group relative bg-[#0F0F0F] border border-[#1E1E1E] rounded-xl overflow-hidden hover:border-[#2E2E2E] transition-all">
      <div className="h-36 bg-[#0A0A0A] flex items-center justify-center overflow-hidden">
        {block.mediaType === "image" && block.mediaUrl ? (
          <img src={block.mediaUrl} alt={block.title} className="w-full h-full object-cover" />
        ) : block.mediaType === "video" && block.mediaUrl ? (
          <video src={block.mediaUrl} className="w-full h-full object-cover" muted playsInline />
        ) : (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-[#2A2A2A]">
            <rect x="3" y="3" width="22" height="22" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 19L9 13L13 17L18 11L25 19" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className="p-3">
        <p className="text-[#EAEAEA] text-sm font-medium leading-snug line-clamp-1">{block.title}</p>
        {block.price != null && (
          <p className="text-[#818CF8] text-sm font-semibold mt-0.5">
            ₹{block.price.toLocaleString("en-IN")}
          </p>
        )}
        {block.description && (
          <p className="text-[#6B7280] text-xs mt-1 line-clamp-2">{block.description}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1E1E1E] text-[#6B7280] border border-[#2A2A2A] uppercase tracking-wider">
            {actionLabel(block.actionType)}
          </span>
          <button onClick={onRemove} className="text-[10px] text-[#4B5563] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function AddBlockPanel({
  sectionId, onCreated, onCancel,
}: {
  sectionId: string;
  onCreated: (block: Block) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: "", description: "", mediaType: "image" as MediaType,
    mediaUrl: "", actionType: "buy" as ActionType, price: "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    const res = await fetch("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionId, title: form.title, description: form.description || null,
        mediaType: form.mediaType, mediaUrl: form.mediaUrl || null,
        actionType: form.actionType, price: form.price ? parseFloat(form.price) : null,
      }),
    });
    if (res.ok) onCreated(await res.json());
    setLoading(false);
  }

  const inputCls = "w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#1E1E1E] text-[#EAEAEA] text-sm placeholder-[#3A3A3A] focus:outline-none focus:border-[#818CF8] transition-colors";

  return (
    <form onSubmit={submit} className="mt-3 p-4 rounded-xl bg-[#0A0A0A] border border-[#1E1E1E] space-y-3">
      <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">New Item</p>
      <input autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Item name" className={inputCls} />
      <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Description (optional)" rows={2} className={inputCls + " resize-none"} />
      <input value={form.mediaUrl} onChange={(e) => set("mediaUrl", e.target.value)} placeholder="Image or video URL (optional)" className={inputCls} />
      <input value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="Price in ₹ (optional)" inputMode="decimal" className={inputCls} />
      <div className="flex gap-1.5 flex-wrap">
        {(["image", "video", "none"] as MediaType[]).map((m) => (
          <button type="button" key={m} onClick={() => set("mediaType", m)}
            className={`text-xs px-3 py-1 rounded-lg border capitalize transition-colors ${form.mediaType === m ? "bg-[#818CF8]/20 border-[#818CF8]/50 text-[#818CF8]" : "border-[#1E1E1E] text-[#6B7280] hover:border-[#2E2E2E]"}`}>
            {m}
          </button>
        ))}
        <span className="text-[#2A2A2A] self-center">|</span>
        {(["buy", "view", "book", "contact"] as ActionType[]).map((a) => (
          <button type="button" key={a} onClick={() => set("actionType", a)}
            className={`text-xs px-3 py-1 rounded-lg border capitalize transition-colors ${form.actionType === a ? "bg-[#818CF8]/20 border-[#818CF8]/50 text-[#818CF8]" : "border-[#1E1E1E] text-[#6B7280] hover:border-[#2E2E2E]"}`}>
            {a}
          </button>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={loading || !form.title.trim()}
          className="flex-1 py-2 rounded-lg bg-[#818CF8] hover:bg-[#6366F1] text-white text-xs font-semibold disabled:opacity-40 transition-colors">
          {loading ? "Adding…" : "Add Item"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[#1E1E1E] text-[#6B7280] hover:text-[#9CA3AF] text-xs transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

function SectionRow({
  section, onBlockCreated, onBlockRemoved,
}: {
  section: Section;
  onBlockCreated: (sectionId: string, block: Block) => void;
  onBlockRemoved: (sectionId: string, blockId: string) => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[#EAEAEA] font-semibold text-sm">{section.title}</h3>
        <button onClick={() => setAdding((v) => !v)}
          className="text-xs px-3 py-1 rounded-lg border border-[#1E1E1E] text-[#9CA3AF] hover:text-white hover:border-[#2E2E2E] transition-colors">
          {adding ? "Cancel" : "+ Add Item"}
        </button>
      </div>
      {adding && (
        <AddBlockPanel
          sectionId={section.id}
          onCreated={(block) => { onBlockCreated(section.id, block); setAdding(false); }}
          onCancel={() => setAdding(false)}
        />
      )}
      {section.blocks.length === 0 && !adding ? (
        <div className="py-8 rounded-xl border border-dashed border-[#1E1E1E] text-center">
          <p className="text-[#3A3A3A] text-xs">No items yet — add your first one above</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {section.blocks.map((block) => (
            <BlockCard key={block.id} block={block} onRemove={() => onBlockRemoved(section.id, block.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AddSectionForm({
  storeId, onCreated, onCancel,
}: {
  storeId: string;
  onCreated: (section: Section) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<SectionType>("grid");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    const res = await fetch("/api/section", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, title, type }),
    });
    if (res.ok) {
      const section = await res.json();
      onCreated({ ...section, blocks: [] });
    }
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="p-4 rounded-xl bg-[#0A0A0A] border border-[#1E1E1E] space-y-3 mb-6">
      <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">New Section</p>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Section name"
        className="w-full px-3 py-2 rounded-lg bg-black border border-[#1E1E1E] text-[#EAEAEA] text-sm placeholder-[#3A3A3A] focus:outline-none focus:border-[#818CF8] transition-colors" />
      <div className="flex gap-1.5 flex-wrap">
        {(["grid", "list", "featured", "carousel"] as SectionType[]).map((t) => (
          <button type="button" key={t} onClick={() => setType(t)}
            className={`text-xs px-3 py-1 rounded-lg border capitalize transition-colors ${type === t ? "bg-[#818CF8]/20 border-[#818CF8]/50 text-[#818CF8]" : "border-[#1E1E1E] text-[#6B7280] hover:border-[#2E2E2E]"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={loading || !title.trim()}
          className="flex-1 py-2 rounded-lg bg-[#818CF8] hover:bg-[#6366F1] text-white text-xs font-semibold disabled:opacity-40 transition-colors">
          {loading ? "Creating…" : "Create Section"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-[#1E1E1E] text-[#6B7280] hover:text-[#9CA3AF] text-xs transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StoreSetupPage() {
  const params = useParams();
  const businessId = params?.businessId as string;

  const [store, setStore]           = useState<Store | null>(null);
  const [sections, setSections]     = useState<Section[]>([]);
  const [businessName, setBusinessName] = useState("Your Store");
  const [phase, setPhase]           = useState<"loading" | "ready" | "error">("loading");
  const [addingSection, setAddingSection] = useState(false);
  const [pageType, setPageType]     = useState<string>("store");
  const [course, setCourse]         = useState<CourseData | null>(null);

  const isLearning = pageType === "learning";

  const loadStore = useCallback(async () => {
    try {
      const forPageRes = await fetch(`/api/store/for-page/${businessId}`);
      if (!forPageRes.ok) throw new Error("Could not load store");
      const { storeId } = await forPageRes.json();

      const storeRes = await fetch(`/api/store/${storeId}`);
      if (!storeRes.ok) throw new Error("Could not load store data");
      const data = await storeRes.json();

      setStore({ id: data.id, name: data.name, description: data.description });
      setBusinessName(data.name);
      setSections((data.sections ?? []).map((s: any) => ({ ...s, blocks: s.blocks ?? [] })));
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [businessId]);

  useEffect(() => {
    fetch(`/api/pages/${businessId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.title) setBusinessName(d.title);
        if (d?.pageType) setPageType(d.pageType);
      })
      .catch(() => {});
    loadStore();
  }, [businessId, loadStore]);

  useEffect(() => {
    if (pageType !== "learning") return;
    fetch(`/api/course/${businessId}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setCourse(d); })
      .catch(() => {});
  }, [businessId, pageType]);

  function onSectionCreated(section: Section) {
    setSections((prev) => [...prev, section]);
    setAddingSection(false);
  }

  function onSectionRemoved(sectionId: string) {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  }

  function onBlockCreated(sectionId: string, block: Block) {
    setSections((prev) =>
      prev.map((s) => s.id === sectionId ? { ...s, blocks: [...s.blocks, block] } : s)
    );
  }

  function onBlockRemoved(sectionId: string, blockId: string) {
    setSections((prev) =>
      prev.map((s) => s.id === sectionId ? { ...s, blocks: s.blocks.filter((b) => b.id !== blockId) } : s)
    );
  }

  function onBlockUpdated(sectionId: string, updated: Block) {
    setSections((prev) =>
      prev.map((s) => s.id === sectionId ? { ...s, blocks: s.blocks.map((b) => b.id === updated.id ? updated : b) } : s)
    );
  }

  const initial    = businessName.charAt(0).toUpperCase();
  const totalItems = sections.reduce((n, s) => n + s.blocks.length, 0);

  return (
    <div className="min-h-screen bg-[#080808] text-white">

      {/* ── Top nav ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[#080808]/90 backdrop-blur border-b border-[#111111] px-4 sm:px-8">
        <div className="max-w-5xl mx-auto h-12 flex items-center gap-2">
          <span className="text-[#EAEAEA] text-xs font-medium">{businessName}</span>
          <span className="text-[#2A2A2A]">/</span>
          <span className="text-[#6B7280] text-xs">{isLearning ? "Course Studio" : "Store Setup"}</span>
          <div className="ml-auto flex items-center gap-2">
            {!isLearning && (
              <>
                <a href="/business/idea" className="text-xs px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-[#6B7280] hover:text-white hover:border-[#2E2E2E] transition-colors">Evaluate</a>
                <a href="/business/plan/new" className="text-xs px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-[#6B7280] hover:text-white hover:border-[#2E2E2E] transition-colors">Business Plan</a>
              </>
            )}
            <a href="/self?tab=earn" className="text-xs px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-[#6B7280] hover:text-white hover:border-[#2E2E2E] transition-colors">
              ← Businesses
            </a>
            {store && (
              isLearning ? (
                <a href={`/store/${store.id}`}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[#818CF8]/30 bg-[#818CF8]/10 text-[#818CF8] hover:bg-[#818CF8]/20 hover:text-white transition-colors">
                  ← View Course
                </a>
              ) : (
                <a href={`/store/${store.id}`} target="_blank" rel="noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#818CF8]/10 border border-[#818CF8]/30 text-[#818CF8] hover:bg-[#818CF8]/20 hover:text-white transition-colors">
                  View Public Store ↗
                </a>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Hero header ──────────────────────────────────────────────────── */}
      <div className="border-b border-[#111111] px-4 sm:px-8 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-[#111111] border border-[#1E1E1E] flex items-center justify-center text-lg font-bold text-[#EAEAEA] select-none shrink-0">
              {initial}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#EAEAEA] tracking-tight">{businessName}</h1>
              <p className="text-[#6B7280] text-sm mt-0.5">
                {sections.length} {isLearning ? "module" : "section"}{sections.length !== 1 ? "s" : ""} · {totalItems} {isLearning ? "lesson" : "item"}{totalItems !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {/* Add button only shown in hero for non-learning pages */}
          {!isLearning && (
            <button
              onClick={() => setAddingSection(true)}
              className="px-4 py-2 rounded-lg text-sm border border-[#1E1E1E] text-[#9CA3AF] hover:text-white hover:border-[#2E2E2E] transition-colors"
            >
              + Add Section
            </button>
          )}
        </div>
      </div>

      {/* ── Learning banner (learning only) ──────────────────────────────── */}
      {/* Banner is now rendered inside LearningEditorContent so it shares tag state */}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      {isLearning ? (
        <>
          {phase === "loading" && (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 rounded-full border-2 border-[#818CF8] border-t-transparent animate-spin" />
            </div>
          )}
          {phase === "error" && (
            <div className="text-center py-20">
              <p className="text-[#6B7280] text-sm">Could not load course. Make sure you&apos;re logged in.</p>
              <button onClick={loadStore} className="mt-4 text-xs text-[#818CF8] hover:underline">Try again</button>
            </div>
          )}
          {phase === "ready" && store && course && (
            <LearningEditorContent
              store={store}
              sections={sections}
              course={course}
              pageId={businessId}
              onSectionCreated={onSectionCreated}
              onSectionRemoved={onSectionRemoved}
              onBlockCreated={onBlockCreated}
              onBlockRemoved={onBlockRemoved}
              onBlockUpdated={onBlockUpdated}
            />
          )}
          {phase === "ready" && store && !course && (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 rounded-full border-2 border-[#818CF8] border-t-transparent animate-spin" />
            </div>
          )}
        </>
      ) : (
        <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
          {phase === "loading" && (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 rounded-full border-2 border-[#818CF8] border-t-transparent animate-spin" />
            </div>
          )}
          {phase === "error" && (
            <div className="text-center py-20">
              <p className="text-[#6B7280] text-sm">Could not load store. Make sure you&apos;re logged in.</p>
              <button onClick={loadStore} className="mt-4 text-xs text-[#818CF8] hover:underline">Try again</button>
            </div>
          )}
          {phase === "ready" && (
            <>
              {addingSection && store && (
                <AddSectionForm storeId={store.id} onCreated={onSectionCreated} onCancel={() => setAddingSection(false)} />
              )}
              {sections.length === 0 && !addingSection ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#0F0F0F] border border-[#1E1E1E] flex items-center justify-center mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#3A3A3A]">
                      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p className="text-[#EAEAEA] font-medium mb-1">No sections yet</p>
                  <p className="text-[#6B7280] text-sm mb-6">Create a section to start adding products or services.</p>
                  <button
                    onClick={() => setAddingSection(true)}
                    className="px-5 py-2.5 rounded-lg bg-[#818CF8] hover:bg-[#6366F1] text-white text-sm font-semibold transition-colors"
                  >
                    Create First Section
                  </button>
                </div>
              ) : (
                sections.map((section) => (
                  <SectionRow
                    key={section.id}
                    section={section}
                    onBlockCreated={onBlockCreated}
                    onBlockRemoved={onBlockRemoved}
                  />
                ))
              )}
            </>
          )}
        </main>
      )}
    </div>
  );
}
