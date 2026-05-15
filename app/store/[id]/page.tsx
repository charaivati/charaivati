"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ConsentModal from "@/components/health/ConsentModal";
import { useParams, useRouter } from "next/navigation";
import LearningPageView, { type LearningSection } from "./LearningPageView";
import InitiativePostsBlock from "@/components/initiative/InitiativePostsBlock";
import FilterBar, { type StoreFilterItem } from "@/components/store/FilterBar";
import BannerZone, { type StoreBannerData } from "@/components/store/BannerZone";
import ManageFiltersPanel from "@/components/store/ManageFiltersPanel";
import { resilientFetch } from "@/lib/writeQueue";
import { useStoreShell } from "./StoreShellContext";
import ImageLibraryPicker from "@/components/store/ImageLibraryPicker";
import { uploadStoreImage } from "@/lib/store/uploadImage";

type CourseApiData = {
  courseType: string;
  dominantAspect: string;
  aspectWeights: { physical: number; mental: number; emotional: number };
  aspectBenefits: Record<string, string | string[]>;
  page: { id: string; title: string; description?: string | null };
};
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

// --- TYPE DEFINITIONS ---
type MediaType = "image" | "video" | "link" | "none";
type ActionType = "view" | "buy" | "book" | "contact" | "subscribe";
type SectionType = "grid" | "list" | "featured" | "carousel";

type Block = {
  id: string;
  title: string;
  description?: string | null;
  mediaType: MediaType;
  mediaUrl?: string | null;
  actionType: ActionType;
  price?: number | null;
};

type Tile = {
  id: string;
  label: string;
  imageUrl?: string | null;
  imageKey?: string | null;
  order: number;
};

type Section = {
  id: string;
  title: string;
  type: SectionType;
  columns?: number;
  rows?: number;
  rowIndex?: number;
  blocks: Block[];
  tiles?: Tile[];
  subsections?: Section[];
};

type Store = {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  pageId?: string | null;
  pageType?: string;
  isOwner: boolean;
  sections: Section[];
};



type CartItem = {
  id: string;
  blockId: string;
  quantity: number;
  block: {
    id: string;
    title: string;
    price: number | null;
    mediaUrl: string | null;
    mediaType: string;
  };
};

type Address = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};
// --- THEME & STYLES ---
const A = {
  bg: "#E3E6E6",
  nav: "#131921",
  nav2: "#232F3E",
  surface: "#FFFFFF",
  border: "#DDDDDD",
  text: "#0F1111",
  textMuted: "#565959",
  accent: "#6366f1",
  accentHover: "#4f46e5",
  link: "#007185",
  deal: "#CC0C39",
};

const inputCls = "w-full text-sm px-3 py-2 rounded-md outline-none placeholder:text-zinc-500";
const inputStyle = { background: "#fff", color: A.text, border: `1px solid ${A.border}` };

// --- LAYOUT CONSTANTS ---
const SCREEN = 1334;
const GAP = 8;
const TILE_H = 180;

type LayoutSec = { cols: number; colSpan: number };
type LayoutConfig = { label: string; sections: LayoutSec[]; tileW: number };

const LAYOUT_CONFIGS: Record<string, LayoutConfig> = {
  "1":       { label: "1 section",  sections: [{ cols: 1, colSpan: 1 }], tileW: 220 },
  "1-1":     { label: "2 sections", sections: [{ cols: 1, colSpan: 1 }, { cols: 1, colSpan: 1 }], tileW: 220 },
  "1-1-1":   { label: "3 sections", sections: [{ cols: 1, colSpan: 1 }, { cols: 1, colSpan: 1 }, { cols: 1, colSpan: 1 }], tileW: 220 },
  "1-1-1-1": { label: "4 sections", sections: [{ cols: 1, colSpan: 1 }, { cols: 1, colSpan: 1 }, { cols: 1, colSpan: 1 }, { cols: 1, colSpan: 1 }], tileW: 220 },
  "1x5":     { label: "5 sections", sections: [{ cols: 1, colSpan: 1 }, { cols: 1, colSpan: 1 }, { cols: 1, colSpan: 1 }, { cols: 1, colSpan: 1 }, { cols: 1, colSpan: 1 }], tileW: 220 },
  "1-1-1-2": { label: "3+wide",     sections: [{ cols: 1, colSpan: 1 }, { cols: 1, colSpan: 1 }, { cols: 1, colSpan: 1 }, { cols: 2, colSpan: 2 }], tileW: 220 },
  "1-2-2":   { label: "1+2+2",      sections: [{ cols: 1, colSpan: 1 }, { cols: 2, colSpan: 2 }, { cols: 2, colSpan: 2 }], tileW: 220 },
  "2-3":     { label: "2+3",        sections: [{ cols: 2, colSpan: 2 }, { cols: 3, colSpan: 3 }], tileW: 220 },
  "3-3":     { label: "3+3",        sections: [{ cols: 3, colSpan: 3 }, { cols: 3, colSpan: 3 }], tileW: 220 },
};

// --- SECTION CARD ---
function SortableSection({
  section,
  storeId,
  editMode,
  tileW,
  tileH,
  cardW,
  onBlocksReorder,
  onAddTile,
  onTileDeleted,
  onTitleChanged,
}: {
  section: Section;
  storeId: string;
  editMode: boolean;
  tileW: number;
  tileH: number;
  cardW: number;
  onBlocksReorder: (sectionId: string, newBlocks: Block[]) => void;
  onAddTile: (sectionId: string) => void;
  onTileDeleted: (sectionId: string, tileId: string) => void;
  onTitleChanged: (sectionId: string, newTitle: string) => void;
}) {
  const setNodeRef = (_el: HTMLElement | null) => {};
  const style: React.CSSProperties = {};
  const attributes: React.HTMLAttributes<HTMLElement> = {};
  const listeners: React.HTMLAttributes<HTMLElement> = {};
  const deletingTiles = useRef<Set<string>>(new Set());
  const sensorsBlocks = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Editable title state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    setEditingTitle(false);
    if (trimmed === section.title) return;
    // Optimistic update
    onTitleChanged(section.id, trimmed);
    await resilientFetch(
      "/api/section",
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sectionId: section.id, title: trimmed }) },
      { label: `Rename section to "${trimmed}"` }
    );
  }

  function handleBlockDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = section.blocks.findIndex((b) => b.id === active.id);
    const newIndex = section.blocks.findIndex((b) => b.id === over.id);
    onBlocksReorder(section.id, arrayMove(section.blocks, oldIndex, newIndex));
  }

  const renderBlocks = () => {
    const cols = section.columns ?? 1;
    const rowCount = section.rows ?? 1;
    const IMG_H = Math.round(tileH * 0.72);
    const LBL_H = Math.round(tileH * 0.28);
    const maxVisible = cols * rowCount;
    const tiles = section.tiles ?? [];
    const visibleTiles = tiles.slice(0, maxVisible);
    const emptySlots = Math.max(0, maxVisible - visibleTiles.length);
    // CHANGE: section is full when tiles >= maxVisible
    const isFull = tiles.length >= maxVisible;

    // Edit mode, completely empty — dashed placeholder grid
    if (tiles.length === 0 && editMode) {
      return (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${tileW}px)`, gap: 6 }}>
          {Array.from({ length: maxVisible }).map((_, i) => (
            <button key={i} type="button" onClick={() => onAddTile(section.id)}
              style={{ width: tileW, height: tileH, border: "2px dashed #D1D5DB", borderRadius: 8, background: "#F9FAFB", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 4 }}>
              <span style={{ fontSize: 22, color: "#9CA3AF", lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>Add tile</span>
            </button>
          ))}
        </div>
      );
    }

    // Customer view, no tiles — show grid icon placeholder if products exist
    if (tiles.length === 0 && !editMode) {
      if (section.blocks.length === 0) return null;
      return (
        <>
          <a href={`/store/${storeId}/section/${section.id}`}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: tileW, height: tileH, background: "linear-gradient(135deg, #F3F4F6, #E5E7EB)", borderRadius: 8, textDecoration: "none", border: `1px solid ${A.border}` }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ color: "#C0C0C0", marginBottom: 6 }}>
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span style={{ fontSize: 12, color: A.textMuted, fontWeight: 500, marginBottom: 4 }}>{section.title}</span>
            <span style={{ fontSize: 11, color: "#6366f1" }}>View all →</span>
          </a>
          <a href={`/store/${storeId}/section/${section.id}`} className="mt-2 block text-xs hover:underline" style={{ color: "#6366f1" }}>
            See all {section.blocks.length} products →
          </a>
        </>
      );
    }

    // Has tiles
    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${tileW}px)`, gap: 6 }}>
          {visibleTiles.map((t) => {
            const spanFull = visibleTiles.length === 1 && cols > 1;
            return (
            <div key={t.id} style={{ width: spanFull ? "100%" : tileW, height: tileH, position: "relative", flexShrink: 0, ...(spanFull ? { gridColumn: "1 / -1" } : {}) }}>
              <a href={`/store/${storeId}/section/${section.id}`}
                style={{ display: "block", width: "100%", height: "100%", borderRadius: 8, overflow: "hidden", border: `1px solid ${A.border}`, textDecoration: "none", background: "#fff" }}>
                <div style={{ height: IMG_H, overflow: "hidden", background: "#F5F5F5" }}>
                  {t.imageUrl
                    ? <img src={t.imageUrl} alt={t.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: A.textMuted }}>No image</div>
                  }
                </div>
                <div style={{ height: LBL_H, display: "flex", alignItems: "center", padding: "0 8px" }}>
                  <p style={{ fontSize: 11, color: A.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", margin: 0 }}>{t.label}</p>
                </div>
              </a>
              {editMode && (
                <button type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (deletingTiles.current.has(t.id)) return;
                    deletingTiles.current.add(t.id);
                    const tileResult = await resilientFetch(
                      `/api/store/${storeId}/sections/${section.id}/tiles/${t.id}`,
                      { method: "DELETE" },
                      { label: `Delete tile "${t.label}"`, onSuccess: () => onTileDeleted(section.id, t.id) }
                    );
                    deletingTiles.current.delete(t.id);
                    if (tileResult.queued) onTileDeleted(section.id, t.id);
                  }}
                  style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  ×
                </button>
              )}
            </div>
            );
          })}
          {/* Remaining empty slots in edit mode — only if not full */}
          {editMode && !isFull && Array.from({ length: emptySlots }).map((_, i) => (
            <button key={`empty-${i}`} type="button" onClick={() => onAddTile(section.id)}
              style={{ width: tileW, height: tileH, border: "2px dashed #D1D5DB", borderRadius: 8, background: "#F9FAFB", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 4 }}>
              <span style={{ fontSize: 22, color: "#9CA3AF", lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>Add tile</span>
            </button>
          ))}
        </div>
        {editMode ? (
          <a href={`/store/${storeId}/section/${section.id}`} style={{ display: "block", marginTop: 8, fontSize: 11, color: "#6366f1", textDecoration: "none" }}>
            {section.blocks.length > 0 ? `See all ${section.blocks.length} products →` : "+ Add products →"}
          </a>
        ) : (
          section.blocks.length > 0 && (
            <a href={`/store/${storeId}/section/${section.id}`} style={{ display: "block", marginTop: 8, fontSize: 11, color: "#6366f1", textDecoration: "none" }}>
              See all {section.blocks.length} products →
            </a>
          )
        )}
      </>
    );
  };

  const cols = section.columns ?? 1;
  const rowCount = section.rows ?? 1;
  const maxVisible = cols * rowCount;
  const tiles = section.tiles ?? [];
  const isFull = tiles.length >= maxVisible;

  const content = renderBlocks();
  if (content === null && !editMode) return null;

  return (
    <section
      ref={setNodeRef}
      style={{ ...style, background: "#fff", border: `1px solid ${A.border}`, borderRadius: 12, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", width: cardW, minWidth: cardW, maxWidth: cardW, position: "relative" }}
      className="mb-0 shrink-0"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 0 }}>
          {editMode && (
            <button className="cursor-grab text-xs px-2 py-1 rounded shrink-0"
              style={{ color: A.textMuted, border: `1px solid ${A.border}`, background: "#f9f9f9" }}
              {...attributes} {...listeners} title="Drag section">
              ☰
            </button>
          )}
          {/* CHANGE: editable title — click pencil to edit, or click title itself in edit mode */}
          {editMode && editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(section.title); } }}
              style={{ fontSize: 15, fontWeight: 600, color: A.text, border: `1px solid ${A.accent}`, borderRadius: 6, padding: "2px 8px", outline: "none", minWidth: 0, flex: 1 }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
              <h2 className="text-lg font-semibold truncate" style={{ color: A.text, margin: 0 }}>{section.title}</h2>
              {editMode && (
                <button
                  onClick={() => { setTitleDraft(section.title); setEditingTitle(true); }}
                  title="Edit section name"
                  style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 4, border: `1px solid ${A.border}`, background: "#f9f9f9", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: A.textMuted }}>
                  ✎
                </button>
              )}
            </div>
          )}
        </div>
        {/* CHANGE: only show "+ Add tile" button if section is not full */}
        {editMode && !isFull && (
          <button onClick={() => onAddTile(section.id)}
            className="text-xs font-semibold px-3 py-1.5 rounded-md shrink-0"
            style={{ background: "#fff", color: A.text, border: `1px solid ${A.border}` }}>
            + Add tile
          </button>
        )}
        {/* CHANGE: show "Full" badge when all slots are filled */}
        {editMode && isFull && (
          <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 10, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0", flexShrink: 0 }}>
            ✓ Full
          </span>
        )}
      </div>

      {content}

      {editMode && section.blocks.length > 0 && (
        <DndContext sensors={sensorsBlocks} collisionDetection={closestCenter} onDragEnd={handleBlockDragEnd}>
          <SortableContext items={section.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="hidden">{section.blocks.map((b) => <div key={b.id} id={b.id} />)}</div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function LearningTopNav({ pageName, isOwner, onEditClick }: { pageName: string; isOwner: boolean; onEditClick: () => void }) {
  return (
    <header style={{ width: "100%", background: "#FFFFFF", borderBottom: "1px solid #E8E4DE", padding: "14px 28px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 50, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: "#888", fontFamily: "monospace", letterSpacing: "0.1em", flexShrink: 0 }}>charaivati</span>
        <div style={{ width: 1, height: 16, background: "#E8E4DE", flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: "#1A1714", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pageName}</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {isOwner && <a href="/self?tab=earn" style={{ padding: "7px 14px", borderRadius: 7, background: "transparent", color: "#888", fontSize: 12, fontWeight: 500, border: "1px solid #E8E4DE", cursor: "pointer", textDecoration: "none", fontFamily: "system-ui, sans-serif" }}>← Initiatives</a>}
        {isOwner
          ? <button onClick={onEditClick} style={{ padding: "7px 16px", borderRadius: 7, background: "#1A1714", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>Edit Course</button>
          : <button style={{ padding: "7px 16px", borderRadius: 7, background: "#4A7FB5", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>Enroll</button>
        }
      </div>
    </header>
  );
}

// ─── Bulk Image Upload Modal ──────────────────────────────────────────────────

type LibraryImage = { id: string; fileName: string | null; url: string; cloudinaryId: string | null; fileHash: string; uploadedAt: string };
type UploadEntry = { file: File; preview: string; name: string; status: "idle" | "uploading" | "done" | "error"; url?: string; dupReused?: boolean };

function BulkImageUploadModal({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [library, setLibrary] = useState<LibraryImage[]>([]);
  const [loadingLib, setLoadingLib] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/store/images/list?storeId=${storeId}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setLibrary(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingLib(false));
  }, [storeId]);

  function onFilesSelected(files: FileList | null) {
    if (!files) return;
    const newEntries: UploadEntry[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name.replace(/\.[^.]+$/, ""),
      status: "idle",
    }));
    setEntries((prev) => [...prev, ...newEntries]);
  }

  function updateEntry(idx: number, patch: Partial<UploadEntry>) {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));
  }

  async function uploadAll() {
    setUploading(true);
    const pending = entries.filter((e) => e.status === "idle");
    await Promise.all(pending.map(async (entry) => {
      const idx = entries.indexOf(entry);
      updateEntry(idx, { status: "uploading" });
      try {
        const result = await uploadStoreImage(entry.file, storeId);
        setLibrary((prev) => prev.some((i) => i.id === result.id) ? prev : [result, ...prev]);
        updateEntry(idx, { status: "done", url: result.url, dupReused: result.alreadyExisted });
      } catch {
        updateEntry(idx, { status: "error" });
      }
    }));
    setUploading(false);
    setEntries((prev) => prev.filter((e) => e.status !== "done"));
  }

  async function deleteImage(imageId: string) {
    await fetch(`/api/store/${storeId}/images/${imageId}`, { method: "DELETE", credentials: "include" });
    setLibrary((prev) => prev.filter((img) => img.id !== imageId));
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const pendingCount = entries.filter((e) => e.status === "idle").length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid #EEEEEE" }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F1111", margin: 0 }}>📸 Image Library</h2>
            <p style={{ fontSize: 12, color: "#565959", margin: "2px 0 0" }}>{library.length} saved image{library.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: "#F3F4F6", color: "#111827", border: "none", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px" }}>
          {/* Upload zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFilesSelected(e.dataTransfer.files); }}
            style={{ border: "2px dashed #6366f1", borderRadius: 12, padding: "24px 16px", textAlign: "center", cursor: "pointer", background: "#F5F5FF", marginBottom: 16 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", margin: "0 0 2px" }}>Click or drag & drop images here</p>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>Select multiple files at once</p>
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFilesSelected(e.target.files)} />
          </div>

          {/* Staged entries */}
          {entries.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0F1111" }}>
                  {pendingCount} ready to upload
                </span>
                {pendingCount > 0 && (
                  <button onClick={uploadAll} disabled={uploading}
                    style={{ padding: "7px 16px", borderRadius: 20, background: "#6366f1", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.7 : 1 }}>
                    {uploading ? "Uploading…" : `Upload ${pendingCount} image${pendingCount !== 1 ? "s" : ""}`}
                  </button>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                {entries.map((entry, idx) => (
                  <div key={idx} style={{ background: "#F9FAFB", borderRadius: 10, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                    <div style={{ position: "relative", height: 90 }}>
                      <img src={entry.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {entry.status === "uploading" && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #fff", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
                        </div>
                      )}
                      {entry.status === "done" && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(16,185,129,0.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                          <span style={{ fontSize: 22 }}>✓</span>
                          {entry.dupReused && <span style={{ fontSize: 9, color: "#fff", background: "rgba(0,0,0,0.3)", padding: "1px 4px", borderRadius: 4 }}>Reused</span>}
                        </div>
                      )}
                      {entry.status === "error" && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(239,68,68,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>✗</div>
                      )}
                      <button onClick={() => setEntries((p) => p.filter((_, i) => i !== idx))}
                        style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                    <div style={{ padding: "6px 8px" }}>
                      <input
                        value={entry.name}
                        onChange={(e) => updateEntry(idx, { name: e.target.value })}
                        placeholder="Image name"
                        style={{ width: "100%", fontSize: 11, padding: "3px 6px", border: "1px solid #E5E7EB", borderRadius: 5, outline: "none", color: "#0F1111", background: "#fff", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Library */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#565959", margin: "0 0 8px" }}>Saved images</p>
            {loadingLib ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #6366f1", borderTopColor: "transparent" }} className="animate-spin" />
              </div>
            ) : library.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", padding: "16px 0" }}>No images yet — upload some above</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                {library.map((img) => (
                  <div key={img.id} style={{ background: "#F9FAFB", borderRadius: 10, border: "1px solid #E5E7EB", overflow: "hidden" }}>
                    <img src={img.url} alt={img.fileName ?? ""} style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} />
                    <div style={{ padding: "6px 8px" }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#0F1111", margin: "0 0 5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.fileName ?? "image"}</p>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => copyUrl(img.url)}
                          style={{ flex: 1, fontSize: 10, padding: "3px 0", borderRadius: 5, border: "1px solid #E5E7EB", background: copied === img.url ? "#DCFCE7" : "#fff", color: copied === img.url ? "#16A34A" : "#565959", cursor: "pointer" }}>
                          {copied === img.url ? "Copied!" : "Copy URL"}
                        </button>
                        <button onClick={() => deleteImage(img.id)}
                          style={{ padding: "3px 6px", borderRadius: 5, border: "1px solid #FCA5A5", background: "#fff", color: "#EF4444", fontSize: 10, cursor: "pointer" }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileMenu({ isOwner, editMode, onToggleEdit, userName, storeId, onAddressClick, deliveryLabel }: {
  isOwner: boolean; editMode: boolean; onToggleEdit: () => void;
  userName?: string | null; storeId: string; onAddressClick: () => void; deliveryLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ width: 30, height: 30, borderRadius: "50%", background: "#6366f1", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {userName?.[0]?.toUpperCase() ?? "👤"}
      </button>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />}
      {open && (
        <div style={{ position: "absolute", right: 0, top: 36, zIndex: 50, background: "#fff", borderRadius: 10, border: "1px solid #DDDDDD", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", minWidth: 190, overflow: "hidden" }}>
          <button onClick={() => { onAddressClick(); setOpen(false); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 13, border: "none", background: "#f9fafb", color: "#565959", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}>
            📍 {deliveryLabel}
          </button>
          <a href="/store/account" style={{ display: "block", padding: "10px 16px", fontSize: 13, color: "#0F1111", textDecoration: "none", borderBottom: "1px solid #f0f0f0" }}>
            👤 {userName ? `Hello, ${userName.split(" ")[0]}` : "Sign in"}
          </a>
          <a href="/store/account?tab=orders" style={{ display: "block", padding: "10px 16px", fontSize: 13, color: "#0F1111", textDecoration: "none", borderBottom: "1px solid #f0f0f0" }}>
            📦 My Orders
          </a>
          {isOwner && (
            <>
              <a href="/self?tab=earn" style={{ display: "block", padding: "10px 16px", fontSize: 13, color: "#0F1111", textDecoration: "none", borderBottom: "1px solid #f0f0f0" }}>
                🏪 My Businesses
              </a>
              <button onClick={() => { onToggleEdit(); setOpen(false); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 13, border: "none", background: editMode ? "#EEF2FF" : "#fff", color: editMode ? "#6366f1" : "#0F1111", cursor: "pointer" }}>
                ✏️ {editMode ? "Done Editing" : "Edit Store"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TopNav({ editMode, onToggleEdit, isOwner, editLabel, onCartOpen, cartCount, onAddressClick, deliveryLabel, storeId, searchQuery, onSearch, userName, onAccountClick }: { editMode: boolean; onToggleEdit: () => void; isOwner: boolean; editLabel?: string; onCartOpen: () => void; cartCount: number; onAddressClick: () => void; deliveryLabel: string; storeId: string; searchQuery: string; onSearch: (q: string) => void; userName?: string | null; onAccountClick?: () => void }) {
  return (
    <header className="w-full sticky top-0 z-50">
      <div className="w-full" style={{ background: A.nav }}>
        <div className="max-w-7xl mx-auto px-2 md:px-3 h-12 md:h-14 flex items-center gap-2 md:gap-3">
          {/* Desktop: delivery address */}
          <button onClick={onAddressClick} className="hidden md:flex flex-col text-white text-xs leading-tight pr-3 text-left hover:opacity-80">
            <span className="opacity-80">Deliver to</span>
            <span className="font-bold underline">{deliveryLabel}</span>
          </button>

          {/* Search bar — compact on mobile */}
          <div className="flex flex-1">
            <select className="hidden sm:block h-8 md:h-10 rounded-l-md px-2 text-sm" style={{ border: `1px solid ${A.border}`, background: "#f3f3f3", color: A.text }}><option>All</option></select>
            <input value={searchQuery} onChange={(e) => onSearch(e.target.value)} placeholder="Search Store"
              className="flex-1 h-8 md:h-10 px-2 text-sm outline-none"
              style={{ borderTop: `1px solid ${A.border}`, borderBottom: `1px solid ${A.border}`, borderLeft: `1px solid ${A.border}` }} />
            <button className="h-8 md:h-10 px-2 md:px-4 rounded-r-md" style={{ background: "#FEBD69", border: "1px solid #FEBD69" }}>🔍</button>
          </div>

          {/* Mobile-only: cart + profile */}
          <div className="flex md:hidden items-center gap-2 shrink-0">
            <button onClick={onCartOpen} className="relative text-white" style={{ lineHeight: 1 }}>
              <span className="text-xl">🛒</span>
              {cartCount > 0 && (
                <span style={{ position: "absolute", top: -4, right: -6, background: "#6366f1", color: "#fff", borderRadius: "50%", width: 14, height: 14, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {cartCount}
                </span>
              )}
            </button>
            <MobileMenu isOwner={isOwner} editMode={editMode} onToggleEdit={onToggleEdit} userName={userName} storeId={storeId} onAddressClick={onAddressClick} deliveryLabel={deliveryLabel} />
          </div>

          {/* Desktop-only: full nav links */}
          <div className="hidden md:flex items-center gap-5 text-white text-xs pl-3">
            {isOwner ? (
              <a href="/self?tab=earn" className="leading-tight text-white text-xs hover:opacity-80">
                <div className="opacity-80">Manage</div>
                <div className="font-bold">Your Stores ▾</div>
              </a>
            ) : (
              <a href="/store/account" style={{ textDecoration: "none" }} className="leading-tight text-white text-xs hover:opacity-80">
                <div className="opacity-80">{userName ? `Hello, ${userName.split(" ")[0]}` : "Hello, Sign in"}</div>
                <div className="font-bold">My Account ▾</div>
              </a>
            )}
            <a href="/store/account?tab=orders" style={{ textDecoration: "none" }} className="leading-tight text-white text-xs hover:opacity-80">
              <div className="opacity-80">Returns &amp;</div>
              <div className="font-bold">Orders</div>
            </a>
            <button onClick={onCartOpen} className="flex items-center gap-1 relative">
              <span className="text-lg">🛒</span>
              <span className="font-bold">Cart</span>
              {cartCount > 0 && (<span style={{ position: "absolute", top: -6, right: -8, background: "#6366f1", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>)}
            </button>
            {isOwner && (
              <>
                <a href="/self?tab=earn" className="text-xs font-semibold px-3 py-1.5 rounded-md" style={{ background: "transparent", color: "#ccc", border: "1px solid #848688" }}>← My Businesses</a>
                <button onClick={onToggleEdit} className="text-xs font-semibold px-3 py-1.5 rounded-md"
                  style={editMode ? { background: A.accent, color: "#111", border: `1px solid #FCD200` } : { background: "transparent", color: "#fff", border: `1px solid #848688` }}>
                  {editLabel ?? (editMode ? "Done Editing" : "Edit Store")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function StoreHero({ store, totalBlocks, isPinned, onPin, isOwner }: {
  store: Store; totalBlocks: number;
  isPinned: boolean; onPin: () => void; isOwner: boolean;
}) {
  return (
    <div className="w-full" style={{ background: A.surface, borderBottom: `1px solid ${A.border}` }}>
      {store.bannerUrl && <img src={store.bannerUrl} alt="banner" className="w-full h-40 sm:h-56 object-cover" />}
      <div className="max-w-7xl mx-auto px-3 py-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden" style={{ background: "#fff", border: `1px solid ${A.border}` }}>
          {store.avatarUrl && <img src={store.avatarUrl} alt="avatar" className="w-full h-full object-cover" />}
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold truncate" style={{ color: A.text }}>{store.name}</h1>
          <p className="text-sm" style={{ color: A.textMuted }}>{store.sections.length} section{store.sections.length !== 1 ? "s" : ""} · {totalBlocks} item{totalBlocks !== 1 ? "s" : ""}</p>
        </div>
        <div className="ml-auto hidden md:flex items-center gap-2">
          <span className="text-sm" style={{ color: A.link }}>Visit the {store.name} Store</span>
          {!isOwner && (
            <button onClick={onPin} title={isPinned ? "Unpin store" : "Pin store"}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: isPinned ? "#EEF2FF" : "#fff",
                border: `1px solid ${isPinned ? "#6366f1" : "#DDDDDD"}`,
                cursor: "pointer", fontSize: 16,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {isPinned ? "📌" : "🔖"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddSectionModal({ storeId, existingSections, onClose, onCreated }: {
  storeId: string; existingSections: Section[]; onClose: () => void; onCreated: (section: Section) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mobileCols, setMobileCols] = useState(2);
  const maxExistingRow = existingSections.reduce((m, s) => Math.max(m, s.rowIndex ?? 0), -1);
  const newRowIndex = maxExistingRow + 1;

  const pill = (active: boolean) => ({
    background: active ? A.accent : "#fff", color: active ? "#fff" : A.text,
    border: `1px solid ${active ? A.accent : A.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
  });

  async function createSections() {
    const cfg = selectedId ? LAYOUT_CONFIGS[selectedId] : null;
    if (!cfg || loading) return;
    setLoading(true);
    const currentMaxOrder = existingSections.reduce((m, s) => Math.max(m, (s as any).order ?? 0), -1);
    try {
      for (let i = 0; i < cfg.sections.length; i++) {
        const sec = cfg.sections[i];
        const sectionTitle = `Section ${existingSections.length + i + 1}`;
        await resilientFetch(
          "/api/section",
          {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storeId, title: sectionTitle,
              columns: sec.cols, rows: 1, rowIndex: newRowIndex, order: currentMaxOrder + 1 + i,
              mobileColumns: Math.min(sec.cols, mobileCols),
            }),
          },
          {
            label: `Create section "${sectionTitle}"`,
            onSuccess: (data) => onCreated({ ...(data as any), blocks: [], tiles: [], subsections: [] }),
          }
        );
      }
      onClose();
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: `1px solid ${A.border}` }}>
        <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 12 }}>Step {step} of 2</p>
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: A.text, margin: "0 0 2px" }}>Choose layout</h3>
              <p style={{ fontSize: 12, color: A.textMuted, margin: 0 }}>Pick how many sections to add in this row.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {Object.entries(LAYOUT_CONFIGS).map(([id, cfg]) => {
                const active = selectedId === id;
                return (
                  <button key={id} type="button" onClick={() => setSelectedId(id)}
                    style={{ padding: "10px 8px 8px", borderRadius: 8, border: active ? "2px solid #6366f1" : `1px solid ${A.border}`, background: active ? "#eef2ff" : "#fafafa", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                      {cfg.sections.map((sec: LayoutSec, i: number) => (
                        <div key={i} style={{ width: sec.colSpan * 20, height: 20, borderRadius: 3, background: active ? "#818cf8" : "#d1d5db" }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: active ? "#6366f1" : A.textMuted }}>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
            {selectedId && LAYOUT_CONFIGS[selectedId].sections.some((s) => s.cols > 2) && (
              <div>
                <p style={{ fontSize: 12, color: A.textMuted, margin: "0 0 6px" }}>
                  📱 Mobile layout (max 2 columns on small screens)
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setMobileCols(1)}
                    style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, border: mobileCols === 1 ? "2px solid #6366f1" : "1px solid #DDDDDD", background: mobileCols === 1 ? "#EEF2FF" : "#fafafa", cursor: "pointer" }}>
                    ▬ 1 column
                  </button>
                  <button type="button" onClick={() => setMobileCols(2)}
                    style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, border: mobileCols === 2 ? "2px solid #6366f1" : "1px solid #DDDDDD", background: mobileCols === 2 ? "#EEF2FF" : "#fafafa", cursor: "pointer" }}>
                    ▬▬ 2 columns
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} style={{ ...pill(false), color: A.textMuted }}>Cancel</button>
              <button type="button" disabled={!selectedId} onClick={() => setStep(2)}
                style={{ ...pill(true), opacity: selectedId ? 1 : 0.4, cursor: selectedId ? "pointer" : "default" }}>Next →</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: A.text, margin: "0 0 2px" }}>Confirm</h3>
              <p style={{ fontSize: 12, color: A.textMuted, margin: 0 }}>
                Creating {selectedId ? LAYOUT_CONFIGS[selectedId].sections.length : 0} section{(selectedId && LAYOUT_CONFIGS[selectedId].sections.length !== 1) ? "s" : ""} in a new row.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <button type="button" onClick={() => setStep(1)} style={pill(false)}>← Back</button>
              <button type="button" disabled={loading} onClick={createSections}
                style={{ ...pill(true), opacity: loading ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                {loading ? <><span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #fff", borderTopColor: "transparent", display: "inline-block" }} />Creating…</> : "Create"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddBlockModal({ sectionId, onClose, onCreated }: { sectionId: string; onClose: () => void; onCreated: (block: Block) => void }) {
  const [form, setForm] = useState({ title: "", description: "", mediaType: "image" as MediaType, mediaUrl: "", actionType: "view" as ActionType, price: "" });
  const [loading, setLoading] = useState(false);
  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    const res = await fetch("/api/block", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sectionId, title: form.title, description: form.description || null, mediaType: form.mediaType, mediaUrl: form.mediaUrl || null, actionType: form.actionType, price: form.price ? parseFloat(form.price) : null }) });
    if (res.ok) { onCreated(await res.json()); onClose(); }
    setLoading(false);
  }
  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div><h3 className="text-sm font-semibold mb-0.5" style={{ color: A.text }}>New block</h3><p className="text-xs" style={{ color: A.textMuted }}>Add a product, service, or piece of content.</p></div>
        <input autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Title" className={inputCls} style={inputStyle} />
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Description (optional)" rows={2} className={inputCls} style={inputStyle} />
        <input value={form.mediaUrl} onChange={(e) => set("mediaUrl", e.target.value)} placeholder="Media URL (image or video)" className={inputCls} style={inputStyle} />
        <div className="flex gap-2">{(["image","video","link","none"] as MediaType[]).map((m) => <button type="button" key={m} onClick={() => set("mediaType", m)} className="text-xs px-3 py-1.5 rounded-md capitalize" style={{ background: form.mediaType===m?"#FFF4CC":"#fff", color: A.text, border: `1px solid ${A.border}` }}>{m}</button>)}</div>
        <div className="flex gap-2">{(["view","buy","book","contact"] as ActionType[]).map((a) => <button type="button" key={a} onClick={() => set("actionType", a)} className="text-xs px-3 py-1.5 rounded-md capitalize" style={{ background: form.actionType===a?"#FFF4CC":"#fff", color: A.text, border: `1px solid ${A.border}` }}>{a}</button>)}</div>
        <input value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="Price (optional)" inputMode="decimal" className={inputCls} style={inputStyle} />
        <button type="submit" disabled={loading || !form.title.trim()} className="py-2 rounded-md text-xs font-semibold disabled:opacity-40" style={{ background: A.accent, border: `1px solid #FCD200` }}>{loading ? "Adding…" : "Add block"}</button>
      </form>
    </Overlay>
  );
}

function AddTileModal({ sectionId, storeId, onClose, onCreated }: { sectionId: string; storeId: string; onClose: () => void; onCreated: (tile: Tile) => void }) {
  const [label, setLabel] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const result = await uploadStoreImage(file, storeId);
      setImageUrl(result.url);
      setImageKey(result.cloudinaryId ?? null);
    } catch {
      alert("Upload failed — please try again.");
    } finally { setUploading(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const tileLabel = label.trim() || "Untitled";
    const tilePostResult = await resilientFetch(
      `/api/store/${storeId}/sections/${sectionId}/tiles`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: tileLabel, imageUrl, imageKey }) },
      { label: `Add tile "${tileLabel}"`, onSuccess: (data) => { onCreated((data as any).tile); onClose(); } }
    );
    if (tilePostResult.queued) onClose();
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div><h3 className="text-sm font-semibold mb-0.5" style={{ color: A.text }}>New tile</h3><p className="text-xs" style={{ color: A.textMuted }}>Add an image and label for this category.</p></div>
        <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Jeans under ₹500" className={inputCls} style={inputStyle} />
        {imageUrl ? (
          <div className="relative">
            <img src={imageUrl} alt="" className="w-full max-h-24 object-cover rounded-md" />
            <button type="button" onClick={() => { setImageUrl(null); setImageKey(null); }} className="absolute top-1 right-1 text-xs px-2 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>Remove</button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs cursor-pointer px-3 py-2 rounded-md" style={{ border: `1px solid ${A.border}`, color: A.textMuted, background: "#fff" }}>
              {uploading ? "Uploading…" : "Upload image"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
            </label>
            <ImageLibraryPicker
              storeId={storeId}
              onSelect={(url, key) => { setImageUrl(url); setImageKey(key); }}
            />
          </div>
        )}
        <button type="submit" disabled={loading} className="py-2 rounded-md text-xs font-semibold disabled:opacity-40" style={{ background: A.accent, color: "#fff", border: `1px solid ${A.accentHover}` }}>{loading ? "Adding…" : "Add tile"}</button>
      </form>
    </Overlay>
  );
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-xl p-5 shadow-2xl" style={{ background: "#fff", border: `1px solid ${A.border}` }}>
        {children}
        <button onClick={onClose} className="mt-3 w-full text-xs py-2 rounded-md" style={{ color: A.textMuted, border: `1px solid ${A.border}`, background: "#fff" }}>Cancel</button>
      </div>
    </div>
  );
}


function CartDrawer({ open, onClose, items, onRemove, storeName, onCheckout }: { open: boolean; onClose: () => void; items: CartItem[]; onRemove: (blockId: string) => void; storeId: string; storeName: string; onCheckout: () => void; }) {
  const total = items.reduce((s, i) => s + (i.block.price ?? 0) * i.quantity, 0);
  return <div className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
    <div onClick={onClose} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)", opacity: open ? 1 : 0, transition: "opacity 0.2s" }} />
    <div className="absolute right-0 top-0 h-full" style={{ width: 380, maxWidth: "92vw", background: "#fff", borderLeft: `1px solid ${A.border}`, boxShadow: "-10px 0 30px rgba(0,0,0,0.16)", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s" }}>
      <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: A.border }}><h3 className="font-semibold" style={{ color: A.text }}>Cart — {storeName}</h3><button onClick={onClose}>✕</button></div>
      <div className="p-4" style={{ height: "calc(100% - 130px)", overflowY: "auto" }}>{items.length===0 ? <div className="h-full flex items-center justify-center text-sm" style={{ color: A.textMuted }}>Your cart is empty</div> : items.map((i)=><div key={i.id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: "#f0f0f0" }}><div style={{ width:48,height:48,borderRadius:8,overflow:"hidden",background:"#f3f4f6" }}>{i.block.mediaUrl?<img src={i.block.mediaUrl} className="w-full h-full object-cover"/>:<div/>}</div><div className="flex-1 min-w-0"><div className="text-sm truncate">{i.block.title}</div><div className="text-xs" style={{ color:A.textMuted }}>{i.block.price==null?"Free":`₹${i.block.price}`}</div><div className="text-xs" style={{ color:A.textMuted }}>Qty: {i.quantity}</div></div><button className="text-xs" style={{ color:"#EF4444" }} onClick={()=>onRemove(i.blockId)}>×</button></div>)}</div>
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white" style={{ borderColor: A.border }}><div className="font-semibold mb-2">Total: ₹{total}</div><button onClick={onCheckout} disabled={!items.length} className="w-full py-2 rounded-md text-sm font-semibold" style={{ background: A.accent, color: "#fff", opacity: items.length?1:0.5 }}>Checkout</button></div>
    </div>
  </div>;
}

function CheckoutModal({ open, onClose, items, total, storeId, onOrderPlaced }: { open: boolean; onClose: () => void; items: CartItem[]; total: number; storeId: string; onOrderPlaced: () => void; }) {
  const [step, setStep] = useState<1|2>(1); const [addresses, setAddresses] = useState<Address[]>([]); const [selected, setSelected] = useState<string>("");
  const [adding, setAdding] = useState(false); const [placing, setPlacing] = useState(false); const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ name:"", phone:"", line1:"", city:"", state:"", pincode:"" });
  useEffect(()=>{ if(!open) return; setStep(1); fetch('/api/store/address',{credentials:'include'}).then(r=>r.ok?r.json():[]).then((a:Address[])=>{setAddresses(a); const d=a.find(x=>x.isDefault)??a[0]; if(d) setSelected(d.id);}).catch(()=>{}); },[open]);
  if(!open) return null;
  return <Overlay onClose={onClose}><div className="space-y-3" style={{ maxWidth: 480 }}>
    <h3 className="text-sm font-semibold">Checkout</h3>
    {step===1 ? <><div className="space-y-2 max-h-56 overflow-auto">{addresses.map(a=><button key={a.id} onClick={()=>setSelected(a.id)} className="w-full text-left p-2 rounded-md" style={{ border:`1px solid ${selected===a.id?A.accent:A.border}` }}><div className="text-xs font-semibold">{a.name} · {a.phone}</div><div className="text-xs" style={{ color:A.textMuted }}>{a.line1}, {a.city}, {a.state} {a.pincode}</div></button>)}</div><button className="text-xs" style={{ color:A.link }} onClick={()=>setAdding(v=>!v)}>+ Add new address</button>{adding&&<div className="space-y-2">{Object.keys(form).map((k)=><input key={k} value={(form as any)[k]} onChange={(e)=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={k} className={inputCls} style={inputStyle} />)}<button className="text-xs px-3 py-1 rounded" style={{ background:A.accent,color:'#fff' }} onClick={async()=>{const r=await fetch('/api/store/address',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({...form,isDefault:false})}); if(r.ok){const a=await r.json(); setAddresses(p=>[...p,a]); setSelected(a.id); setAdding(false);}}}>Save address</button></div>}<button disabled={!selected} onClick={()=>setStep(2)} className="w-full py-2 rounded text-xs" style={{ background:A.accent,color:'#fff',opacity:selected?1:0.5 }}>Next →</button></> : <>{success?<div className="text-sm" style={{ color:'#16A34A' }}>✓ Order placed! The store owner will contact you shortly.</div>:<><div className="text-xs space-y-1">{items.map(i=><div key={i.id}>{i.block.title} x{i.quantity} — ₹{(i.block.price ?? 0)*i.quantity}</div>)}</div><div className="text-xs">Total: ₹{total}</div><div className="text-xs">Cash on Delivery</div><button disabled={placing} onClick={async()=>{setPlacing(true); const r=await fetch('/api/store/orders',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({storeId,addressId:selected})}); setPlacing(false); if(r.ok){setSuccess(true); onOrderPlaced(); setTimeout(onClose,3000);}}} className="w-full py-2 rounded text-xs" style={{ background:A.accent,color:'#fff' }}>{placing?'Placing…':'Place Order'}</button></>}</>} </div></Overlay>;
}

function AddressModal({ open, onClose, onSelected }: { open: boolean; onClose: () => void; onSelected: (address: Address) => void; }) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", line1: "", city: "", state: "", pincode: "" });
  const [formError, setFormError] = useState("");
  useEffect(() => {
    if (!open) return;
    fetch('/api/store/address', { credentials: 'include' }).then((r) => r.ok ? r.json() : []).then((a: Address[]) => {
      setAddresses(a);
      const d = a.find((x) => x.isDefault) ?? a[0];
      if (d) setSelected(d.id);
    }).catch(() => {});
  }, [open]);
  if (!open) return null;
  return <Overlay onClose={onClose}><div className="space-y-2"><h3 className="text-sm font-semibold">Select delivery address</h3>
    {addresses.map((a) => <button key={a.id} onClick={() => setSelected(a.id)} className="w-full text-left p-2 rounded-md" style={{ border: `1px solid ${selected===a.id ? A.accent : A.border}` }}><div className="text-xs font-semibold">{a.name} · {a.phone}</div><div className="text-xs" style={{ color: A.textMuted }}>{a.line1}, {a.city}, {a.state} {a.pincode}</div></button>)}
    <button className="text-xs" style={{ color: A.link }} onClick={() => { setAdding((v) => !v); setFormError(""); }}>+ Add new address</button>
    {adding && <div className="space-y-2">{Object.keys(form).map((k) => <input key={k} value={(form as any)[k]} onChange={(e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setFormError(""); }} placeholder={k} className={inputCls} style={inputStyle} />)}
      {formError && <p className="text-xs" style={{ color: "#EF4444" }}>{formError}</p>}
      <button className="text-xs px-3 py-1 rounded" style={{ background: A.accent, color: '#fff' }} onClick={async () => { const { name, phone, line1, city, state, pincode } = form; if (!name.trim() || !phone.trim() || !line1.trim() || !city.trim() || !state.trim() || !pincode.trim()) { setFormError("Please fill all address fields"); return; } setFormError(""); const r = await fetch('/api/store/address', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: name.trim(), phone: phone.trim(), line1: line1.trim(), city: city.trim(), state: state.trim(), pincode: pincode.trim(), isDefault: true }) }); if (r.ok) { const a = await r.json(); setAddresses((p) => [a, ...p]); setSelected(a.id); setAdding(false); setForm({ name: "", phone: "", line1: "", city: "", state: "", pincode: "" }); } }}>Save address</button>
    </div>}
    <button disabled={!selected} onClick={() => { const addr = addresses.find((a) => a.id === selected); if (addr) onSelected(addr); onClose(); }} className="w-full py-2 rounded text-xs" style={{ background: A.accent, color: '#fff', opacity: selected ? 1 : 0.5 }}>Use this address</button></div></Overlay>;
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: A.bg }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: "#fff", border: `1px solid ${A.border}` }} />
        <span className="text-xs" style={{ color: A.textMuted }}>Loading…</span>
      </div>
    </div>
  );
}

// --- MAIN PAGE ---
export default function StorePage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [screenW, setScreenW] = useState(1334);
  const [editMode, setEditMode] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [addBlockForSection, setAddBlockForSection] = useState<string | null>(null);
  const [addingTile, setAddingTile] = useState<string | null>(null);
  const [subscribingBlock, setSubscribingBlock] = useState<Block | null>(null);
  const [subscribeStatus, setSubscribeStatus] = useState<"idle" | "success" | "error">("idle");
  const [learningCourse, setLearningCourse] = useState<CourseApiData | null>(null);
  const [learningSections, setLearningSections] = useState<LearningSection[]>([]);
  const [learningProgress, setLearningProgress] = useState<Record<string, { status: string; mastery: number }>>({});
  const [storeFilters, setStoreFilters] = useState<StoreFilterItem[]>([]);
  const [globalBanner, setGlobalBanner] = useState<StoreBannerData | null>(null);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [showManageFilters, setShowManageFilters] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
  const [currentUser, setCurrentUser] = useState<{ name: string | null; email: string | null } | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const shell = useStoreShell();
  const { searchQuery, setSearchQuery } = shell;

  async function handleSubscribeConfirm(consentFields: string[]) {
    if (!subscribingBlock || !store?.pageId) return;
    try {
      const res = await fetch(`/api/pages/${store.pageId}/subscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ tier: subscribingBlock.title, consentGranted: true, consentTimestamp: new Date().toISOString(), consentFields }) });
      const data = await res.json();
      if (!res.ok || !data.subscribed) throw new Error(data.error || "Subscription failed");
      setSubscribeStatus("success");
    } catch { setSubscribeStatus("error"); }
    finally { setSubscribingBlock(null); }
  }

  const fetchStore = useCallback(async () => {
    try {
      const res = await fetch(`/api/store/${id}`);
      if (res.ok) { const data = await res.json(); setStore(data); setStoreFilters(data.filters ?? []); setGlobalBanner(data.globalBanner ?? null);
        fetch(`/api/store/cart/${data.id}`, { credentials: "include" }).then((r) => r.ok ? r.json() : []).then((items) => setCartItems(items)).catch(() => {});
        fetch("/api/store/wishlist", { credentials: "include" }).then((r) => r.ok ? r.json() : []).then((items) => setWishlist(new Set(items.map((i: any) => i.blockId)))).catch(() => {});
        fetch("/api/store/address", { credentials: "include" }).then((r) => r.ok ? r.json() : []).then((addresses: Address[]) => { const def = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null; setDefaultAddress(def); }).catch(() => {});
        fetch("/api/store/pinned", { credentials: "include" }).then((r) => r.ok ? r.json() : { pinned: [] }).then((d) => { setIsPinned(d.pinned?.some((p: any) => p.storeId === data.id) ?? false); }).catch(() => {}); }
    } catch (error) { console.error("Failed to fetch store:", error); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchStore(); }, [fetchStore]);

  // Sync cart count, address label, and cart/address openers to shared shell
  useEffect(() => {
    shell.setCartCount(cartItems.reduce((s, i) => s + i.quantity, 0));
  }, [cartItems]);
  useEffect(() => {
    shell.setDeliveryLabel(defaultAddress ? `${defaultAddress.city} ${defaultAddress.pincode}` : "Set address");
  }, [defaultAddress]);
  useEffect(() => {
    shell.registerOpenCart(() => setCartOpen(true));
    shell.registerOpenAddress(() => setAddressModalOpen(true));
  }, []);
  useEffect(() => {
    if (!store) return;
    shell.setStoreName(store.name ?? "Store");
    shell.setIsOwner(!!store.isOwner);
    shell.setShowNav(store.pageType !== "learning");
    shell.setSearchQuery("");
  }, [store?.id]);

  useEffect(() => {
    function update() { setScreenW(window.innerWidth); }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!store || store.pageType !== "learning" || !store.pageId) return;
    const pageId = store.pageId;
    fetch(`/api/course/${pageId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        setLearningCourse(d);
        setLearningSections((d.store?.sections ?? []).map((s: any) => ({ ...s, blocks: s.blocks ?? [] })));
        const progressMap: Record<string, { status: string; mastery: number }> = {};
        (d.progress ?? []).forEach((p: { blockId: string; status: string; mastery: number }) => { progressMap[p.blockId] = { status: p.status, mastery: p.mastery }; });
        setLearningProgress(progressMap);
      }).catch(() => {});
  }, [store?.pageId, store?.pageType]);

  useEffect(() => {
    fetch("/api/user/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : { user: null })
      .then(d => setCurrentUser(d.user))
      .catch(() => {});
  }, []);

  const totalBlocks = store?.sections.reduce((a, s) => a + s.blocks.length, 0) ?? 0;
  const sensorsSections = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !store) return;
    const oldIndex = store.sections.findIndex((s) => s.id === active.id);
    const newIndex = store.sections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(store.sections, oldIndex, newIndex);
    setStore({ ...store, sections: reordered });
    await resilientFetch(
      "/api/section/reorder",
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: store.id, orderedIds: reordered.map((s) => s.id) }) },
      { label: "Reorder sections" }
    );
  }

  async function handleBlocksReorder(sectionId: string, newBlocks: Block[]) {
    if (!store) return;
    setStore({ ...store, sections: store.sections.map((s) => s.id === sectionId ? { ...s, blocks: newBlocks } : s) });
    await fetch("/api/block/reorder", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sectionId, orderedIds: newBlocks.map((b) => b.id) }) });
  }

  function onSectionCreated(_section: Section) {
    fetchStore();
  }

  function onBlockCreated(sectionId: string, block: Block) {
    if (!store) return;
    setStore({ ...store, sections: store.sections.map((s) => s.id === sectionId ? { ...s, blocks: [...s.blocks, block] } : s) });
  }

  function onTitleChanged(sectionId: string, newTitle: string) {
    if (!store) return;
    setStore({ ...store, sections: store.sections.map((s) => s.id === sectionId ? { ...s, title: newTitle } : s) });
  }


  async function handleAddToCart(block: Block, storeId: string) {
    if (!store) return;
    const res = await fetch(`/api/store/cart/${storeId}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ blockId: block.id, quantity: 1 }) });
    if (res.ok) {
      const item = await res.json();
      setCartItems((prev) => { const exists = prev.find((i) => i.blockId === block.id); if (exists) return prev.map((i) => i.blockId === block.id ? { ...i, quantity: i.quantity + 1 } : i); return [...prev, item]; });
      setCartOpen(true);
    }
  }

  async function handleWishlist(blockId: string, storeId: string) {
    const res = await fetch("/api/store/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ blockId, storeId }) });
    if (res.ok) { const data = await res.json(); setWishlist((prev) => { const next = new Set(prev); if (data.wishlisted) next.add(blockId); else next.delete(blockId); return next; }); }
  }

  async function handlePinStore() {
    if (!store) return;
    const res = await fetch("/api/store/pinned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ storeId: store.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setIsPinned(data.pinned);
    }
  }

  async function handleRemoveFromCart(blockId: string) {
    if (!store) return;
    await fetch(`/api/store/cart/${store.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ blockId }) });
    setCartItems((prev) => prev.filter((i) => i.blockId !== blockId));
  }

  async function handleDeleteRow(rowSections: Section[]) {
    const names = rowSections.map((s) => `"${s.title}"`).join(", ");
    if (!confirm(`Delete entire row (${names}) and all their tiles and products? This cannot be undone.`)) return;
    for (const section of rowSections) {
      await resilientFetch(
        "/api/section",
        { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sectionId: section.id }) },
        { label: `Delete section "${section.title}"` }
      );
    }
    const deletedIds = new Set(rowSections.map((s) => s.id));
    setStore((prev) => prev ? { ...prev, sections: prev.sections.filter((s) => !deletedIds.has(s.id)) } : prev);
  }

  if (loading) return <LoadingSkeleton />;
  if (!store) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: A.bg }}>
      <div className="text-center"><p className="text-sm" style={{ color: A.textMuted }}>Store not found.</p></div>
    </div>
  );

  const isLearning = store.pageType === "learning";
  const activeFilter = storeFilters.find((f) => f.id === activeFilterId) ?? null;
  const activeBanner: StoreBannerData | null = (activeFilter?.banner as StoreBannerData | null) ?? null;
  const visibleSections = activeFilterId
    ? store.sections.filter((s) => (activeFilter?.sectionIds ?? []).includes(s.id))
    : store.sections;
  const searchFilteredSections = visibleSections.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()) || searchQuery === "");

  const rowMap = new Map<number, Section[]>();
  searchFilteredSections.forEach((s) => {
    const ri = s.rowIndex ?? 0;
    if (!rowMap.has(ri)) rowMap.set(ri, []);
    rowMap.get(ri)!.push(s);
  });
  const sortedRows = Array.from(rowMap.entries()).sort(([a], [b]) => a - b).map(([, secs]) => secs);

  return (
    <div className="min-h-screen" style={{ background: isLearning ? "#FAF8F5" : A.bg }}>
      {isLearning ? (
        <LearningTopNav pageName={learningCourse?.page.title ?? store.name} isOwner={store.isOwner} onEditClick={() => router.push(`/business/store/${store.pageId ?? id}`)} />
      ) : (
        <>
          <FilterBar filters={storeFilters} activeFilterId={activeFilterId} onFilterChange={setActiveFilterId} editMode={editMode && store.isOwner} onEditFilters={() => setShowManageFilters(true)} />
          <BannerZone banner={activeBanner} globalBanner={globalBanner} editMode={editMode && store.isOwner} onEdit={() => setShowManageFilters(true)} />
          <StoreHero store={store} totalBlocks={totalBlocks} isPinned={isPinned} onPin={handlePinStore} isOwner={store.isOwner} />
        </>
      )}

      {store.pageType === "learning" ? (
        <>
          {learningCourse ? (
            <LearningPageView
              page={{ id: store.pageId ?? "", title: learningCourse.page.title, description: learningCourse.page.description, avatarUrl: store.avatarUrl }}
              course={{ courseType: learningCourse.courseType, dominantAspect: learningCourse.dominantAspect, aspectWeights: learningCourse.aspectWeights, aspectBenefits: learningCourse.aspectBenefits }}
              sections={learningSections} isOwner={store.isOwner} studentProgress={learningProgress}
            />
          ) : (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 rounded-full animate-spin" style={{ border: "3px solid #DDDDDD", borderTopColor: "#232F3E" }} />
            </div>
          )}
          {store.pageId && (
            <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 48px", background: "#FAF8F5" }}>
              <InitiativePostsBlock pageId={store.pageId} isCreator={store.isOwner} accentColor="#4A7FB5" theme="light" />
            </div>
          )}
        </>
      ) : (
        <main className="w-full px-2 py-4">
          {searchFilteredSections.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-2" style={{ background: A.surface, border: `1px solid ${A.border}` }}>
              <div className="w-12 h-12 rounded-md flex items-center justify-center mb-2" style={{ background: "#fff", border: `1px solid ${A.border}` }}>
                <span style={{ color: A.textMuted, fontSize: 18 }}>▤</span>
              </div>
              <p className="text-sm" style={{ color: A.textMuted }}>
                {activeFilterId ? "No sections in this filter." : (store.isOwner ? "No sections yet. Click Edit to get started." : "This store has no content yet.")}
              </p>
            </div>
          )}

          {subscribeStatus === "success" && (
            <div className="mb-4 px-4 py-3 rounded-md text-sm font-medium" style={{ background: "#0d9f6e22", color: "#0d9f6e", border: "1px solid #0d9f6e55" }}>✓ Subscribed successfully!</div>
          )}
          {subscribeStatus === "error" && (
            <div className="mb-4 px-4 py-3 rounded-md text-sm font-medium" style={{ background: "#ff444422", color: "#ff4444", border: "1px solid #ff444455" }}>Subscription failed. Please try again.</div>
          )}

          <div className="flex flex-col gap-3">
            {sortedRows.map((rowSections, rowIdx) => {
              const isMobile = screenW < 640;
              const effectiveSections = isMobile
                ? rowSections.map((s) => ({ ...s, columns: Math.min(s.columns ?? 1, 2) }))
                : rowSections;
              const totalCols = effectiveSections.reduce((s, sec) => s + (sec.columns ?? 1), 0);
              const totalGaps = (effectiveSections.length - 1) * GAP;
              const totalPad = effectiveSections.length * 24;
              const totalIntraGaps = effectiveSections.reduce((s, sec) => s + Math.max(0, (sec.columns ?? 1) - 1) * 6, 0);
              const availableW = Math.min(screenW, SCREEN) - 32;
              const raw = Math.floor((availableW - totalGaps - totalPad - totalIntraGaps) / totalCols);
              const tileW = Math.max(raw, 120);
              const tileH = TILE_H;

              return (
                <div key={rowIdx}>
                  {editMode && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: A.textMuted }}>Row {rowIdx + 1} · {rowSections.length} section{rowSections.length !== 1 ? "s" : ""}</span>
                      <button onClick={() => handleDeleteRow(rowSections)}
                        style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, color: "#EF4444", border: "1px solid #FCA5A5", background: "#fff", cursor: "pointer" }}>
                        Delete row
                      </button>
                    </div>
                  )}
                  <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as any, paddingBottom: 4 }}>
                  <div style={{ display: "flex", gap: GAP, alignItems: "flex-start", width: "fit-content", margin: "0 auto" }}>
                    {effectiveSections.map((section) => {
                      const cols = section.columns ?? 1;
                      const cardW = cols * tileW + (cols - 1) * 6 + 24;
                      return (
                        <SortableSection
                          key={section.id}
                          section={section}
                          storeId={store.id}
                          editMode={editMode}
                          tileW={tileW}
                          tileH={tileH}
                          cardW={cardW}
                          onBlocksReorder={handleBlocksReorder}
                          onAddTile={(sid) => setAddingTile(sid)}
                          onTileDeleted={(sid, tid) => setStore((prev) => prev ? { ...prev, sections: prev.sections.map((s) => s.id === sid ? { ...s, tiles: (s.tiles ?? []).filter((t) => t.id !== tid) } : s) } : prev)}
                          onTitleChanged={onTitleChanged}
                        />
                      );
                    })}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>

          {editMode && store.isOwner && (
            <div className="mt-6">
              <button onClick={() => setShowAddSection(true)} className="text-xs font-semibold px-4 py-2 rounded-md" style={{ background: "#fff", color: A.text, border: `1px solid ${A.border}` }}>
                + Add section
              </button>
            </div>
          )}
        </main>
      )}

      {showAddSection && store && (
        <AddSectionModal storeId={store.id} existingSections={store.sections} onClose={() => setShowAddSection(false)} onCreated={onSectionCreated} />
      )}
      {addBlockForSection && (
        <AddBlockModal sectionId={addBlockForSection} onClose={() => setAddBlockForSection(null)} onCreated={(block) => onBlockCreated(addBlockForSection, block)} />
      )}
      {addingTile && store && (
        <AddTileModal sectionId={addingTile} storeId={store.id} onClose={() => setAddingTile(null)}
          onCreated={(tile) => {
            setStore((prev) => prev ? { ...prev, sections: prev.sections.map((s) => s.id === addingTile ? { ...s, tiles: [...(s.tiles ?? []), tile] } : s) } : prev);
            setAddingTile(null);
          }} />
      )}
      {subscribingBlock && store && (
        <ConsentModal expertName={store.name} onConfirm={handleSubscribeConfirm} onCancel={() => setSubscribingBlock(null)} />
      )}
      {/* Floating edit controls — owners only, non-learning stores */}
      {!isLearning && store.isOwner && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 50, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          {editMode && (
            <button
              onClick={() => setShowBulkUpload(true)}
              style={{ padding: "9px 18px", borderRadius: 24, background: "#fff", color: "#6366f1", border: "1px solid #6366f1", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              📸 Bulk image upload
            </button>
          )}
          <button
            onClick={() => setEditMode((e) => !e)}
            style={{ padding: "10px 20px", borderRadius: 24, background: editMode ? "#6366f1" : "#fff", color: editMode ? "#fff" : "#0F1111", border: "1px solid #DDDDDD", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {editMode ? "✓ Done Editing" : "✏️ Edit Store"}
          </button>
        </div>
      )}
      {showBulkUpload && store && (
        <BulkImageUploadModal storeId={store.id} onClose={() => setShowBulkUpload(false)} />
      )}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={cartItems} onRemove={handleRemoveFromCart} storeId={store.id} storeName={store.name} onCheckout={() => setCheckoutOpen(true)} />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} items={cartItems} total={cartItems.reduce((s, i) => s + (i.block.price ?? 0) * i.quantity, 0)} storeId={store.id} onOrderPlaced={() => { setCartItems([]); setCartOpen(false); setCheckoutOpen(false); }} />
      <AddressModal open={addressModalOpen} onClose={() => setAddressModalOpen(false)} onSelected={(addr) => setDefaultAddress(addr)} />
      {showManageFilters && store && (
        <ManageFiltersPanel storeId={store.id} filters={storeFilters} sections={store.sections.map((s) => ({ id: s.id, title: s.title }))} globalBanner={globalBanner}
          onClose={(updatedFilters, updatedGlobalBanner) => { setStoreFilters(updatedFilters); setGlobalBanner(updatedGlobalBanner); setShowManageFilters(false); }} />
      )}
    </div>
  );
}
