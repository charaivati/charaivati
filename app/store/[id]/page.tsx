"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ConsentModal from "@/components/health/ConsentModal";
import { useParams, useRouter } from "next/navigation";
import LearningPageView, { type LearningSection } from "./LearningPageView";
import InitiativePostsBlock from "@/components/initiative/InitiativePostsBlock";
import FilterBar, { type StoreFilterItem } from "@/components/store/FilterBar";
import BannerZone, { type StoreBannerData } from "@/components/store/BannerZone";
import ManageFiltersPanel from "@/components/store/ManageFiltersPanel";

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

// --- COMPONENTS ---


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
  onSectionRemoved,
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
  onSectionRemoved: (sectionId: string) => void;
}) {
  const setNodeRef = (_el: HTMLElement | null) => {};
  const style: React.CSSProperties = {};
  const attributes: React.HTMLAttributes<HTMLElement> = {};
  const listeners: React.HTMLAttributes<HTMLElement> = {};
  const deletingTiles = useRef<Set<string>>(new Set());
  const sensorsBlocks = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleBlockDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = section.blocks.findIndex((b) => b.id === active.id);
    const newIndex = section.blocks.findIndex((b) => b.id === over.id);
    const reordered = arrayMove(section.blocks, oldIndex, newIndex);
    onBlocksReorder(section.id, reordered);
  }

  const renderBlocks = () => {
    const cols = section.columns ?? 3;
    const rowCount = section.rows ?? 1;
    const IMG_H = Math.round(tileH * 0.72);
    const LBL_H = Math.round(tileH * 0.28);
    const maxVisible = cols * rowCount;
    const tiles = section.tiles ?? [];
    const visibleTiles = tiles.slice(0, maxVisible);

    // Empty tiles — edit mode: dashed placeholder grid
    if (tiles.length === 0 && editMode) {
      const slots = Array.from({ length: maxVisible });
      return (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${tileW}px)`, gap: 6 }}>
            {slots.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onAddTile(section.id)}
                style={{
                  width: tileW, height: tileH,
                  border: "2px dashed #DDDDDD",
                  borderRadius: 6,
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 24,
                  color: "#999",
                }}
              >
                +
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Empty tiles — customer view: hide section if also no blocks; fallback placeholder if blocks exist
    if (tiles.length === 0 && !editMode) {
      if (section.blocks.length === 0) return null;
      return (
        <>
          <a
            href={`/store/${storeId}/section/${section.id}`}
            style={{ display: "block", width: tileW, height: tileH, textDecoration: "none", borderRadius: 6, background: "#f0f0f0", border: `1px solid ${A.border}`, overflow: "hidden" }}
          >
            <div style={{ height: IMG_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, color: A.textMuted, fontWeight: 600 }}>{section.title}</span>
            </div>
            <div style={{ height: LBL_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: "#6366f1" }}>View all →</span>
            </div>
          </a>
          <a href={`/store/${storeId}/section/${section.id}`} className="mt-2 block text-xs hover:underline" style={{ color: "#6366f1" }}>
            See all {section.blocks.length} products →
          </a>
        </>
      );
    }

    return (
      <>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${tileW}px)`, gap: 6 }}>
          {visibleTiles.map((t) => (
            <div
              key={t.id}
              style={{ width: tileW, height: tileH, position: "relative", flexShrink: 0 }}
            >
              <a
                href={`/store/${storeId}/section/${section.id}`}
                className="rounded-md overflow-hidden bg-white block"
                style={{ width: "100%", height: "100%", border: `1px solid ${A.border}`, textDecoration: "none" }}
              >
                <div style={{ height: IMG_H, overflow: "hidden" }}>
                  {t.imageUrl ? (
                    <img src={t.imageUrl} alt={t.label} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: A.textMuted, background: "#f5f5f5" }}>
                      No image
                    </div>
                  )}
                </div>
                <div style={{ height: LBL_H, display: "flex", alignItems: "center", padding: "0 8px" }}>
                  <p className="text-xs truncate w-full" style={{ color: A.text }}>{t.label}</p>
                </div>
              </a>
              {editMode && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (deletingTiles.current.has(t.id)) return;
                    deletingTiles.current.add(t.id);
                    const res = await fetch(`/api/store/${storeId}/sections/${section.id}/tiles/${t.id}`, {
                      method: "DELETE", credentials: "include",
                    });
                    deletingTiles.current.delete(t.id);
                    if (res.ok) onTileDeleted(section.id, t.id);
                  }}
                  style={{
                    position: "absolute", top: 4, right: 4,
                    width: 16, height: 16, borderRadius: "50%",
                    background: "rgba(0,0,0,0.6)", color: "#fff",
                    border: "none", fontSize: 10, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {section.blocks.length > 0 && (
          <a href={`/store/${storeId}/section/${section.id}`} className="mt-2 block text-xs hover:underline" style={{ color: "#6366f1" }}>
            See all {section.blocks.length} products →
          </a>
        )}
      </>
    );
  };

  const content = renderBlocks();

  // Hide section from customer view if completely empty
  if (content === null && !editMode) return null;

  return (
    <section
      ref={setNodeRef}
      style={{ ...style, background: "#fff", border: `1px solid ${A.border}`, borderRadius: 12, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", width: cardW, minWidth: cardW, maxWidth: cardW, position: "relative" }}
      className="mb-0 shrink-0"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {editMode && (
            <button
              className="cursor-grab text-xs px-2 py-1 rounded"
              style={{ color: A.textMuted, border: `1px solid ${A.border}`, background: "#f9f9f9" }}
              {...attributes}
              {...listeners}
              title="Drag section"
            >
              ☰
            </button>
          )}
          <h2 className="text-lg font-semibold" style={{ color: A.text }}>{section.title}</h2>
        </div>
        {editMode && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAddTile(section.id)}
              className="text-xs font-semibold px-3 py-1.5 rounded-md"
              style={{ background: "#fff", color: A.text, border: `1px solid ${A.border}` }}
            >
              + Add tile
            </button>
            <button
              onClick={async () => {
                if (!confirm(`Delete '${section.title}' and all its tiles and products? This cannot be undone.`)) return;
                const res = await fetch("/api/section", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ sectionId: section.id }),
                });
                if (res.ok) onSectionRemoved(section.id);
              }}
              className="text-xs px-2 py-1 rounded-md text-red-400 hover:text-red-600 transition-colors"
              style={{ border: "1px solid #fca5a5" }}
            >
              Delete section
            </button>
          </div>
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

function LearningTopNav({
  pageName,
  isOwner,
  onEditClick,
}: {
  pageName: string;
  isOwner: boolean;
  onEditClick: () => void;
}) {
  return (
    <header style={{
      width: "100%", background: "#FFFFFF", borderBottom: "1px solid #E8E4DE",
      padding: "14px 28px", display: "flex", alignItems: "center", gap: 16,
      position: "sticky", top: 0, zIndex: 50, boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: "#888", fontFamily: "monospace", letterSpacing: "0.1em", flexShrink: 0 }}>
          charaivati
        </span>
        <div style={{ width: 1, height: 16, background: "#E8E4DE", flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: "#1A1714", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {pageName}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {isOwner && (
          <a href="/self?tab=earn"
            style={{ padding: "7px 14px", borderRadius: 7, background: "transparent", color: "#888", fontSize: 12, fontWeight: 500, border: "1px solid #E8E4DE", cursor: "pointer", textDecoration: "none", fontFamily: "system-ui, sans-serif" }}>
            ← Initiatives
          </a>
        )}
        {isOwner ? (
          <button onClick={onEditClick}
            style={{ padding: "7px 16px", borderRadius: 7, background: "#1A1714", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
            Edit Course
          </button>
        ) : (
          <button
            style={{ padding: "7px 16px", borderRadius: 7, background: "#4A7FB5", color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
            Enroll
          </button>
        )}
      </div>
    </header>
  );
}

function TopNav({ editMode, onToggleEdit, isOwner, editLabel }: { editMode: boolean; onToggleEdit: () => void; isOwner: boolean; editLabel?: string }) {
  const [q, setQ] = useState("");
  return (
    <header className="w-full sticky top-0 z-50">
      <div className="w-full" style={{ background: A.nav }}>
        <div className="max-w-7xl mx-auto px-3 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 pr-2">
            <div className="w-24 h-8 rounded-sm flex items-center justify-center font-bold" style={{ background: "#fff", color: A.nav }}>store</div>
          </div>
          <div className="hidden md:flex flex-col text-white text-xs leading-tight pr-3">
            <span className="opacity-80">Deliver to</span>
            <span className="font-bold">Kolkata 700001</span>
          </div>
          <div className="flex-1 flex">
            <select className="hidden sm:block h-10 rounded-l-md px-2 text-sm" style={{ border: `1px solid ${A.border}`, background: "#f3f3f3", color: A.text }}>
              <option>All</option>
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Store" className="flex-1 h-10 px-3 text-sm outline-none" style={{ borderTop: `1px solid ${A.border}`, borderBottom: `1px solid ${A.border}` }} />
            <button className="h-10 px-4 rounded-r-md" style={{ background: "#FEBD69", border: `1px solid #FEBD69` }}>🔍</button>
          </div>
          <div className="hidden md:flex items-center gap-5 text-white text-xs pl-3">
            <div className="leading-tight">
              <div className="opacity-80">Hello, Sign in</div>
              <div className="font-bold">Account & Lists ▾</div>
            </div>
            <div className="leading-tight">
              <div className="opacity-80">Returns</div>
              <div className="font-bold">& Orders</div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg">🛒</span>
              <span className="font-bold">Cart</span>
            </div>
            {isOwner && (
              <>
                <a
                  href="/self?tab=earn"
                  className="text-xs font-semibold px-3 py-1.5 rounded-md"
                  style={{ background: "transparent", color: "#ccc", border: "1px solid #848688" }}
                >
                  ← My Businesses
                </a>
                <button
                  onClick={onToggleEdit}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md"
                  style={editMode ? { background: A.accent, color: "#111", border: `1px solid #FCD200` } : { background: "transparent", color: "#fff", border: `1px solid #848688` }}
                >
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

function StoreHero({ store, totalBlocks }: { store: Store; totalBlocks: number }) {
  return (
    <div className="w-full" style={{ background: A.surface, borderBottom: `1px solid ${A.border}` }}>
      {store.bannerUrl && (
        <img src={store.bannerUrl} alt="banner" className="w-full h-40 sm:h-56 object-cover" />
      )}
      <div className="max-w-7xl mx-auto px-3 py-3 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden" style={{ background: "#fff", border: `1px solid ${A.border}` }}>
          {store.avatarUrl ? (
            <img src={store.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold truncate" style={{ color: A.text }}>{store.name}</h1>
          <p className="text-sm" style={{ color: A.textMuted }}>
            {store.sections.length} section{store.sections.length !== 1 ? "s" : ""} · {totalBlocks} item{totalBlocks !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="ml-auto hidden md:flex items-center gap-2">
          <span className="text-sm" style={{ color: A.link }}>Visit the {store.name} Store</span>
        </div>
      </div>
    </div>
  );
}

// ─── Layout constants ────────────────────────────────────────────────────────

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

function AddSectionModal({
  storeId,
  existingSections,
  onClose,
  onCreated,
}: {
  storeId: string;
  existingSections: Section[];
  onClose: () => void;
  onCreated: (section: Section) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const maxExistingRow = existingSections.reduce((m, s) => Math.max(m, s.rowIndex ?? 0), -1);
  const newRowIndex = maxExistingRow + 1;

  const pill = (active: boolean) => ({
    background: active ? A.accent : "#fff",
    color: active ? "#fff" : A.text,
    border: `1px solid ${active ? A.accent : A.border}`,
    borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
  });

  async function createSections() {
    const cfg = selectedId ? LAYOUT_CONFIGS[selectedId] : null;
    if (!cfg || loading) return;
    setLoading(true);
    const currentMaxOrder = existingSections.reduce((m, s) => Math.max(m, (s as any).order ?? 0), -1);
    try {
      for (let i = 0; i < cfg.sections.length; i++) {
        const sec = cfg.sections[i];
        const autoTitle = `Section ${existingSections.length + i + 1}`;
        const res = await fetch("/api/section", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            storeId,
            title: autoTitle,
            columns: sec.cols,
            rows: 1,
            rowIndex: newRowIndex,
            order: currentMaxOrder + 1 + i,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          onCreated({ ...data, blocks: [], tiles: [], subsections: [] });
        }
      }
      onClose();
    } finally { setLoading(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
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
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedId(id)}
                    style={{
                      padding: "10px 8px 8px",
                      borderRadius: 8,
                      border: active ? "2px solid #6366f1" : `1px solid ${A.border}`,
                      background: active ? "#eef2ff" : "#fafafa",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                      {cfg.sections.map((sec: LayoutSec, i: number) => (
                        <div
                          key={i}
                          style={{
                            width: sec.colSpan * 20,
                            height: 20,
                            borderRadius: 3,
                            background: active ? "#818cf8" : "#d1d5db",
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: active ? "#6366f1" : A.textMuted }}>{cfg.label}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} style={{ ...pill(false), color: A.textMuted }}>Cancel</button>
              <button
                type="button"
                disabled={!selectedId}
                onClick={() => setStep(2)}
                style={{ ...pill(true), opacity: selectedId ? 1 : 0.4, cursor: selectedId ? "pointer" : "default" }}
              >
                Next →
              </button>
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
              <button
                type="button"
                disabled={loading}
                onClick={createSections}
                style={{ ...pill(true), opacity: loading ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}
              >
                {loading ? (
                  <>
                    <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid #fff", borderTopColor: "transparent", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
                    Creating…
                  </>
                ) : "Create"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddBlockModal({
  sectionId,
  onClose,
  onCreated,
}: {
  sectionId: string;
  onClose: () => void;
  onCreated: (block: Block) => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    mediaType: "image" as MediaType,
    mediaUrl: "",
    actionType: "view" as ActionType,
    price: "",
  });
  const [loading, setLoading] = useState(false);
  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    const res = await fetch("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionId,
        title: form.title,
        description: form.description || null,
        mediaType: form.mediaType,
        mediaUrl: form.mediaUrl || null,
        actionType: form.actionType,
        price: form.price ? parseFloat(form.price) : null,
      }),
    });
    if (res.ok) {
      const block = await res.json();
      onCreated(block);
      onClose();
    }
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold mb-0.5" style={{ color: A.text }}>New block</h3>
          <p className="text-xs" style={{ color: A.textMuted }}>Add a product, service, or piece of content.</p>
        </div>
        <input autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Title" className={inputCls} style={inputStyle} />
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Description (optional)" rows={2} className={inputCls} style={inputStyle} />
        <input value={form.mediaUrl} onChange={(e) => set("mediaUrl", e.target.value)} placeholder="Media URL (image or video)" className={inputCls} style={inputStyle} />
        <div className="flex gap-2">
          {(["image", "video", "link", "none"] as MediaType[]).map((m) => (
            <button type="button" key={m} onClick={() => set("mediaType", m)} className="text-xs px-3 py-1.5 rounded-md capitalize"
              style={{ background: form.mediaType === m ? "#FFF4CC" : "#fff", color: A.text, border: `1px solid ${A.border}` }}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["view", "buy", "book", "contact"] as ActionType[]).map((a) => (
            <button type="button" key={a} onClick={() => set("actionType", a)} className="text-xs px-3 py-1.5 rounded-md capitalize"
              style={{ background: form.actionType === a ? "#FFF4CC" : "#fff", color: A.text, border: `1px solid ${A.border}` }}>
              {a}
            </button>
          ))}
        </div>
        <input value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="Price (optional)" inputMode="decimal" className={inputCls} style={inputStyle} />
        <button type="submit" disabled={loading || !form.title.trim()} className="py-2 rounded-md text-xs font-semibold disabled:opacity-40" style={{ background: A.accent, border: `1px solid #FCD200` }}>
          {loading ? "Adding…" : "Add block"}
        </button>
      </form>
    </Overlay>
  );
}

function AddTileModal({
  sectionId,
  storeId,
  onClose,
  onCreated,
}: {
  sectionId: string;
  storeId: string;
  onClose: () => void;
  onCreated: (tile: Tile) => void;
}) {
  const [label, setLabel] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  async function uploadImage(file: File) {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) { alert("Cloudinary not configured"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", uploadPreset);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.secure_url) { setImageUrl(data.secure_url); setImageKey(data.public_id ?? null); }
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/store/${storeId}/sections/${sectionId}/tiles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ label: label.trim(), imageUrl, imageKey }),
    });
    if (res.ok) {
      const data = await res.json();
      onCreated(data.tile);
      onClose();
    }
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold mb-0.5" style={{ color: A.text }}>New tile</h3>
          <p className="text-xs" style={{ color: A.textMuted }}>Add an image and label for this category.</p>
        </div>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Jeans under ₹500"
          className={inputCls}
          style={inputStyle}
        />
        {imageUrl ? (
          <div className="relative">
            <img src={imageUrl} alt="" className="w-full max-h-24 object-cover rounded-md" />
            <button
              type="button"
              onClick={() => { setImageUrl(null); setImageKey(null); }}
              className="absolute top-1 right-1 text-xs px-2 py-0.5 rounded"
              style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
            >
              Remove
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 text-xs cursor-pointer px-3 py-2 rounded-md"
            style={{ border: `1px solid ${A.border}`, color: A.textMuted, background: "#fff" }}>
            {uploading ? "Uploading…" : "Upload image"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          </label>
        )}
        <button
          type="submit"
          disabled={loading || !label.trim()}
          className="py-2 rounded-md text-xs font-semibold disabled:opacity-40"
          style={{ background: A.accent, color: "#fff", border: `1px solid ${A.accentHover}` }}
        >
          {loading ? "Adding…" : "Add tile"}
        </button>
      </form>
    </Overlay>
  );
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-xl p-5 shadow-2xl" style={{ background: "#fff", border: `1px solid ${A.border}` }}>
        {children}
        <button onClick={onClose} className="mt-3 w-full text-xs py-2 rounded-md" style={{ color: A.textMuted, border: `1px solid ${A.border}`, background: "#fff" }}>
          Cancel
        </button>
      </div>
    </div>
  );
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

// --- MAIN PAGE COMPONENT ---
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

  async function handleSubscribeConfirm(consentFields: string[]) {
    if (!subscribingBlock || !store?.pageId) return;
    try {
      const res = await fetch(`/api/pages/${store.pageId}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tier: subscribingBlock.title,
          consentGranted: true,
          consentTimestamp: new Date().toISOString(),
          consentFields,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.subscribed) throw new Error(data.error || "Subscription failed");
      setSubscribeStatus("success");
    } catch {
      setSubscribeStatus("error");
    } finally {
      setSubscribingBlock(null);
    }
  }

  const fetchStore = useCallback(async () => {
    try {
      const res = await fetch(`/api/store/${id}`);
      if (res.ok) {
        const data = await res.json();
        setStore(data);
        setStoreFilters(data.filters ?? []);
        setGlobalBanner(data.globalBanner ?? null);
      }
    } catch (error) {
      console.error("Failed to fetch store:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

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
        (d.progress ?? []).forEach((p: { blockId: string; status: string; mastery: number }) => {
          progressMap[p.blockId] = { status: p.status, mastery: p.mastery };
        });
        setLearningProgress(progressMap);
      })
      .catch(() => {});
  }, [store?.pageId, store?.pageType]);

  const totalBlocks = store?.sections.reduce((a, s) => a + s.blocks.length, 0) ?? 0;
  const sensorsSections = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !store) return;
    const oldIndex = store.sections.findIndex((s) => s.id === active.id);
    const newIndex = store.sections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(store.sections, oldIndex, newIndex);
    setStore({ ...store, sections: reordered });
    await fetch("/api/section/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: store.id, orderedIds: reordered.map((s) => s.id) }),
    });
  }

  async function handleBlocksReorder(sectionId: string, newBlocks: Block[]) {
    if (!store) return;
    setStore({ ...store, sections: store.sections.map((s) => (s.id === sectionId ? { ...s, blocks: newBlocks } : s)) });
    await fetch("/api/block/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId, orderedIds: newBlocks.map((b) => b.id) }),
    });
  }

  function onSectionCreated(section: Section) {
    if (!store) return;
    setStore({ ...store, sections: [...store.sections, section] });
  }

  function onBlockCreated(sectionId: string, block: Block) {
    if (!store) return;
    setStore({ ...store, sections: store.sections.map((s) => (s.id === sectionId ? { ...s, blocks: [...s.blocks, block] } : s)) });
  }

  if (loading) return <LoadingSkeleton />;
  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: A.bg }}>
        <div className="text-center"><p className="text-sm" style={{ color: A.textMuted }}>Store not found.</p></div>
      </div>
    );
  }

  const isLearning = store.pageType === "learning";

  const activeFilter = storeFilters.find((f) => f.id === activeFilterId) ?? null;
  const activeBanner: StoreBannerData | null = (activeFilter?.banner as StoreBannerData | null) ?? null;
  const visibleSections = activeFilterId
    ? store.sections.filter((s) => (activeFilter?.sectionIds ?? []).includes(s.id))
    : store.sections;

  return (
    <div className="min-h-screen" style={{ background: isLearning ? "#FAF8F5" : A.bg }}>
      {isLearning ? (
        <LearningTopNav
          pageName={learningCourse?.page.title ?? store.name}
          isOwner={store.isOwner}
          onEditClick={() => router.push(`/business/store/${store.pageId ?? id}`)}
        />
      ) : (
        <>
          <TopNav
            editMode={editMode}
            onToggleEdit={() => setEditMode((e) => !e)}
            isOwner={store.isOwner}
          />
          <FilterBar
            filters={storeFilters}
            activeFilterId={activeFilterId}
            onFilterChange={setActiveFilterId}
            editMode={editMode && store.isOwner}
            onEditFilters={() => setShowManageFilters(true)}
          />
          <BannerZone
            banner={activeBanner}
            globalBanner={globalBanner}
            editMode={editMode && store.isOwner}
            onEdit={() => setShowManageFilters(true)}
          />
          <StoreHero store={store} totalBlocks={totalBlocks} />
        </>
      )}

      {store.pageType === "learning" ? (
        <>
          {learningCourse ? (
            <LearningPageView
              page={{
                id: store.pageId ?? "",
                title: learningCourse.page.title,
                description: learningCourse.page.description,
                avatarUrl: store.avatarUrl,
              }}
              course={{
                courseType: learningCourse.courseType,
                dominantAspect: learningCourse.dominantAspect,
                aspectWeights: learningCourse.aspectWeights,
                aspectBenefits: learningCourse.aspectBenefits,
              }}
              sections={learningSections}
              isOwner={store.isOwner}
              studentProgress={learningProgress}
            />
          ) : (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 rounded-full animate-spin" style={{ border: "3px solid #DDDDDD", borderTopColor: "#232F3E" }} />
            </div>
          )}
          {store.pageId && (
            <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 48px", background: "#FAF8F5" }}>
              <InitiativePostsBlock
                pageId={store.pageId}
                isCreator={store.isOwner}
                accentColor="#4A7FB5"
                theme="light"
              />
            </div>
          )}
        </>
      ) : (
      <main className="w-full px-2 py-4">
        {visibleSections.length === 0 && (
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
          <div className="mb-4 px-4 py-3 rounded-md text-sm font-medium" style={{ background: "#0d9f6e22", color: "#0d9f6e", border: "1px solid #0d9f6e55" }}>
            ✓ Subscribed successfully!
          </div>
        )}
        {subscribeStatus === "error" && (
          <div className="mb-4 px-4 py-3 rounded-md text-sm font-medium" style={{ background: "#ff444422", color: "#ff4444", border: "1px solid #ff444455" }}>
            Subscription failed. Please try again.
          </div>
        )}

        {(() => {
          const rowMap = new Map<number, Section[]>();
          visibleSections.forEach((s) => {
            const ri = s.rowIndex ?? 0;
            if (!rowMap.has(ri)) rowMap.set(ri, []);
            rowMap.get(ri)!.push(s);
          });
          const sortedRows = Array.from(rowMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([, secs]) => secs);
          return (
            <div className="flex flex-col gap-3">
              {sortedRows.map((rowSections, rowIdx) => {
                const totalCols = rowSections.reduce((s, sec) => s + (sec.columns ?? 1), 0);
                const totalGaps = (rowSections.length - 1) * GAP;
                const totalPad = rowSections.length * 24;
                const totalIntraGaps = rowSections.reduce((s, sec) => s + Math.max(0, (sec.columns ?? 1) - 1) * 6, 0);
                const raw = Math.floor((SCREEN - totalGaps - totalPad - totalIntraGaps) / totalCols);
                const tileW = Math.max(raw, 80);
                const tileH = TILE_H;
                return (
                  <div key={rowIdx} className="flex gap-2 items-start w-full">
                    {rowSections.map((section) => {
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
                          onSectionRemoved={(sid) => setStore((prev) => prev ? { ...prev, sections: prev.sections.filter((s) => s.id !== sid) } : prev)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {store.isOwner && (
          <div className="mt-6">
            <button
              onClick={() => setShowAddSection(true)}
              className="text-xs font-semibold px-4 py-2 rounded-md"
              style={{ background: "#fff", color: A.text, border: `1px solid ${A.border}` }}
            >
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
        <AddTileModal
          sectionId={addingTile}
          storeId={store.id}
          onClose={() => setAddingTile(null)}
          onCreated={(tile) => {
            setStore((prev) => prev ? {
              ...prev,
              sections: prev.sections.map((s) =>
                s.id === addingTile ? { ...s, tiles: [...(s.tiles ?? []), tile] } : s
              ),
            } : prev);
            setAddingTile(null);
          }}
        />
      )}
      {subscribingBlock && store && (
        <ConsentModal
          expertName={store.name}
          onConfirm={handleSubscribeConfirm}
          onCancel={() => setSubscribingBlock(null)}
        />
      )}
      {showManageFilters && store && (
        <ManageFiltersPanel
          storeId={store.id}
          filters={storeFilters}
          sections={store.sections.map((s) => ({ id: s.id, title: s.title }))}
          globalBanner={globalBanner}
          onClose={(updatedFilters, updatedGlobalBanner) => {
            setStoreFilters(updatedFilters);
            setGlobalBanner(updatedGlobalBanner);
            setShowManageFilters(false);
          }}
        />
      )}
    </div>
  );
}