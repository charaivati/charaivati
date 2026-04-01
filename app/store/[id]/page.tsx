"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionType = "view" | "buy" | "unlock" | "book";
type MediaType = "image" | "video";
type SectionType = "list" | "grid" | "series";

interface Block {
  id: string;
  title: string;
  description: string | null;
  mediaType: MediaType;
  mediaUrl: string | null;
  actionType: ActionType;
  price: number | null;
  order: number;
}

interface Subsection {
  id: string;
  title: string;
  order: number;
  blocks: Block[];
}

interface Section {
  id: string;
  title: string;
  type: SectionType;
  order: number;
  blocks: Block[];
  subsections: Subsection[];
}

interface Store {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  isOwner: boolean;
  sections: Section[];
}

// ─── Action config ────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<ActionType, string> = {
  view: "View",
  buy: "Buy",
  unlock: "Unlock",
  book: "Book",
};

const ACTION_STYLES: Record<ActionType, string> = {
  view:   "bg-indigo-600 hover:bg-indigo-500 text-white",
  buy:    "bg-emerald-600 hover:bg-emerald-500 text-white",
  unlock: "bg-amber-500  hover:bg-amber-400  text-white",
  book:   "bg-violet-600 hover:bg-violet-500 text-white",
};

// ─── Gradient palette ─────────────────────────────────────────────────────────

const GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-blue-600",
];

function gradientFor(title: string) {
  return GRADIENTS[title.charCodeAt(0) % GRADIENTS.length];
}

// ─── Media thumbnail ──────────────────────────────────────────────────────────

function MediaThumb({
  block,
  className,
  editMode,
}: {
  block: Block;
  className?: string;
  editMode: boolean;
}) {
  const initials = block.title.slice(0, 2).toUpperCase();
  return (
    <div className={`relative overflow-hidden bg-white/5 ${className ?? ""}`}>
      {block.mediaUrl ? (
        block.mediaType === "video" ? (
          <video
            src={block.mediaUrl}
            className="w-full h-full object-cover"
            controls={!editMode}
            muted
            playsInline
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={block.mediaUrl} alt={block.title} className="w-full h-full object-cover" />
        )
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${gradientFor(block.title)} flex items-center justify-center`}
        >
          <span className="text-white font-bold text-lg select-none">{initials}</span>
        </div>
      )}
    </div>
  );
}

// ─── Grid card (16:9, title below — YouTube style) ────────────────────────────

function GridCard({ block, editMode }: { block: Block; editMode: boolean }) {
  return (
    <div className="group cursor-pointer">
      <MediaThumb
        block={block}
        className="aspect-video rounded-2xl w-full group-hover:brightness-90 transition-[filter]"
        editMode={editMode}
      />
      <div className="mt-2.5 px-0.5">
        <p className="font-semibold text-sm leading-snug text-white line-clamp-2">
          {block.title}
        </p>
        {block.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{block.description}</p>
        )}
        <div className="flex items-center justify-between mt-2 gap-2">
          {block.price != null && (
            <span className="text-sm font-bold text-white">
              ₹{block.price.toLocaleString("en-IN")}
            </span>
          )}
          <button
            className={`ml-auto text-xs font-semibold px-3 py-1 rounded-full transition-colors ${ACTION_STYLES[block.actionType]}`}
          >
            {ACTION_LABELS[block.actionType]}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── List card (compact horizontal, 2-col grid) ───────────────────────────────

function ListCard({ block, editMode }: { block: Block; editMode: boolean }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-white/5 border border-white/10 p-3 hover:bg-white/[0.08] transition-colors cursor-pointer group">
      <MediaThumb
        block={block}
        className="rounded-xl shrink-0 w-28 sm:w-32 aspect-video group-hover:brightness-90 transition-[filter]"
        editMode={editMode}
      />
      <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
        <div>
          <p className="font-semibold text-sm leading-snug text-white line-clamp-2">
            {block.title}
          </p>
          {block.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{block.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          {block.price != null && (
            <span className="text-xs font-bold text-white">
              ₹{block.price.toLocaleString("en-IN")}
            </span>
          )}
          <button
            className={`ml-auto shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${ACTION_STYLES[block.actionType]}`}
          >
            {ACTION_LABELS[block.actionType]}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Series card (numbered list) ──────────────────────────────────────────────

function SeriesCard({
  block,
  index,
  editMode,
}: {
  block: Block;
  index: number;
  editMode: boolean;
}) {
  return (
    <div className="flex gap-3 items-start rounded-2xl bg-white/5 border border-white/10 p-3 hover:bg-white/[0.08] transition-colors cursor-pointer group">
      <span className="shrink-0 w-6 text-center text-xs font-bold text-gray-600 mt-2 select-none">
        {index + 1}
      </span>
      <MediaThumb
        block={block}
        className="rounded-xl shrink-0 w-28 sm:w-32 aspect-video group-hover:brightness-90 transition-[filter]"
        editMode={editMode}
      />
      <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
        <p className="font-semibold text-sm leading-snug text-white line-clamp-2">
          {block.title}
        </p>
        {block.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{block.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          {block.price != null && (
            <span className="text-xs font-bold text-white">
              ₹{block.price.toLocaleString("en-IN")}
            </span>
          )}
          <button
            className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${ACTION_STYLES[block.actionType]}`}
          >
            {ACTION_LABELS[block.actionType]}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Block dispatcher ─────────────────────────────────────────────────────────

function BlockCard({
  block,
  layout,
  index,
  editMode,
}: {
  block: Block;
  layout: SectionType;
  index: number;
  editMode: boolean;
}) {
  if (layout === "grid")   return <GridCard   block={block} editMode={editMode} />;
  if (layout === "series") return <SeriesCard block={block} index={index} editMode={editMode} />;
  return <ListCard block={block} editMode={editMode} />;
}

// ─── Sortable block ───────────────────────────────────────────────────────────

function SortableBlock({ block, index, layout }: { block: Block; index: number; layout: SectionType }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-50" : ""}
    >
      <div className="relative">
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 z-10 cursor-grab active:cursor-grabbing bg-black/50 hover:bg-black/70 rounded-lg p-1.5"
          title="Drag to reorder"
        >
          <GripIcon />
        </div>
        <BlockCard block={block} layout={layout} index={index} editMode />
      </div>
    </div>
  );
}

// ─── Sortable section ─────────────────────────────────────────────────────────

function SortableSection({
  section,
  editMode,
  onBlocksReorder,
  onAddBlock,
}: {
  section: Section;
  editMode: boolean;
  onBlocksReorder: (sectionId: string, newOrder: Block[]) => void;
  onAddBlock: (sectionId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleBlockDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = section.blocks.findIndex((b) => b.id === active.id);
    const newIndex = section.blocks.findIndex((b) => b.id === over.id);
    onBlocksReorder(section.id, arrayMove(section.blocks, oldIndex, newIndex));
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-50" : ""}
    >
      <SectionView
        section={section}
        editMode={editMode}
        dragHandleProps={editMode ? { ...attributes, ...listeners } : undefined}
        sensors={sensors}
        onBlockDragEnd={handleBlockDragEnd}
        onAddBlock={onAddBlock}
      />
    </div>
  );
}

// ─── Section view ─────────────────────────────────────────────────────────────

function SectionView({
  section,
  editMode,
  dragHandleProps,
  sensors,
  onBlockDragEnd,
  onAddBlock,
}: {
  section: Section;
  editMode: boolean;
  dragHandleProps?: Record<string, unknown>;
  sensors?: ReturnType<typeof useSensors>;
  onBlockDragEnd?: (e: DragEndEvent) => void;
  onAddBlock?: (sectionId: string) => void;
}) {
  const blocks = section.blocks;

  // Grid: 2→3→4 cols. List: 1→2 cols. Series: 1 col.
  const containerClass =
    section.type === "grid"
      ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6"
      : section.type === "list"
      ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
      : "flex flex-col gap-2";

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {editMode && dragHandleProps && (
            <span
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400"
              title="Drag section"
            >
              <GripIcon />
            </span>
          )}
          <h2 className="text-base font-bold text-white tracking-tight">{section.title}</h2>
          <span className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">
            {section.type === "series" ? `Series · ${blocks.length}` : blocks.length}
          </span>
        </div>
        {!editMode && blocks.length > 4 && (
          <button className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline transition-colors">
            See all
          </button>
        )}
      </div>

      {/* Blocks */}
      {editMode && sensors && onBlockDragEnd ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBlockDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className={containerClass}>
              {blocks.map((block, i) => (
                <SortableBlock key={block.id} block={block} index={i} layout={section.type} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className={containerClass}>
          {blocks.map((block, i) => (
            <BlockCard key={block.id} block={block} layout={section.type} index={i} editMode={false} />
          ))}
        </div>
      )}

      {editMode && onAddBlock && (
        <button
          onClick={() => onAddBlock(section.id)}
          className="mt-4 w-full border-2 border-dashed border-white/10 rounded-2xl py-3 text-sm text-gray-600 hover:border-white/20 hover:text-gray-400 transition-colors"
        >
          + Add block
        </button>
      )}
    </section>
  );
}

// ─── Add Section modal ────────────────────────────────────────────────────────

function AddSectionModal({
  storeId,
  onClose,
  onCreated,
}: {
  storeId: string;
  onClose: () => void;
  onCreated: (section: Section) => void;
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
      onCreated({ ...section, blocks: [], subsections: [] });
      onClose();
    }
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h3 className="text-base font-semibold text-white">New Section</h3>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Section title…"
          className={inputClass}
        />
        <div className="flex gap-2">
          {(["grid", "list", "series"] as SectionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-1.5 rounded-xl text-sm capitalize border transition-colors ${
                type === t
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
        >
          {loading ? "Creating…" : "Create Section"}
        </button>
      </form>
    </Overlay>
  );
}

// ─── Add Block modal ──────────────────────────────────────────────────────────

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

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

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
        <h3 className="text-base font-semibold text-white">New Block</h3>
        <input
          autoFocus
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Title"
          className={inputClass}
        />
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className={inputClass}
        />
        <input
          value={form.mediaUrl}
          onChange={(e) => set("mediaUrl", e.target.value)}
          placeholder="Media URL (image or video)"
          className={inputClass}
        />
        <div className="flex gap-2">
          {(["image", "video"] as MediaType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("mediaType", t)}
              className={`flex-1 py-1.5 rounded-xl text-sm capitalize border transition-colors ${
                form.mediaType === t
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-white/10 text-gray-400 hover:border-white/20"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <select
          value={form.actionType}
          onChange={(e) => set("actionType", e.target.value)}
          className={inputClass}
        >
          <option value="view">View</option>
          <option value="buy">Buy</option>
          <option value="unlock">Unlock</option>
          <option value="book">Book</option>
        </select>
        {(form.actionType === "buy" || form.actionType === "unlock" || form.actionType === "book") && (
          <input
            type="number"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="Price (₹)"
            min="0"
            step="0.01"
            className={inputClass}
          />
        )}
        <button
          type="submit"
          disabled={loading || !form.title.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
        >
          {loading ? "Adding…" : "Add Block"}
        </button>
      </form>
    </Overlay>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const inputClass =
  "w-full px-3 py-2 text-sm rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50";

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-950 border border-white/10 rounded-3xl p-5 w-full max-w-sm shadow-2xl">
        {children}
        <button
          onClick={onClose}
          className="mt-4 w-full text-sm text-gray-600 hover:text-gray-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-white/70">
      <circle cx="5" cy="5" r="1.2" />
      <circle cx="11" cy="5" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="11" r="1.2" />
      <circle cx="11" cy="11" r="1.2" />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StorePage() {
  const params = useParams();
  const id = params?.id as string;

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const [showAddSection, setShowAddSection] = useState(false);
  const [addBlockForSection, setAddBlockForSection] = useState<string | null>(null);

  const fetchStore = useCallback(async () => {
    const res = await fetch(`/api/store/${id}`);
    if (res.ok) setStore(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchStore(); }, [fetchStore]);

  const isOwner = store?.isOwner ?? false;
  const totalBlocks = store?.sections.reduce((a, s) => a + s.blocks.length, 0) ?? 0;

  // ── Section DnD ─────────────────────────────────────────────────────────────
  const sensorsSections = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

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
    setStore({
      ...store,
      sections: store.sections.map((s) => s.id === sectionId ? { ...s, blocks: newBlocks } : s),
    });
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
    setStore({
      ...store,
      sections: store.sections.map((s) =>
        s.id === sectionId ? { ...s, blocks: [...s.blocks, block] } : s
      ),
    });
  }

  // ── Loading / not found ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center text-gray-500">
        Store not found.
      </div>
    );
  }

  const initials = store.name.slice(0, 2).toUpperCase();
  const bannerGradient = gradientFor(store.name);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">

      {/* ── Banner ──────────────────────────────────────────────────────────── */}
      <div className={`h-28 sm:h-40 w-full bg-gradient-to-r ${bannerGradient} opacity-80`} />

      {/* ── Channel header ───────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-end sm:items-center gap-4 -mt-8 sm:-mt-10 mb-6">

          {/* Avatar */}
          <div
            className={`shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br ${bannerGradient} flex items-center justify-center ring-4 ring-gray-950 shadow-xl`}
          >
            <span className="text-white font-bold text-xl select-none">{initials}</span>
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0 pt-8 sm:pt-10">
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight truncate">
              {store.name}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {store.sections.length} section{store.sections.length !== 1 ? "s" : ""} · {totalBlocks} item{totalBlocks !== 1 ? "s" : ""}
            </p>
            {store.description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{store.description}</p>
            )}
          </div>

          {/* Edit toggle */}
          {isOwner && (
            <button
              onClick={() => setEditMode((e) => !e)}
              className={`shrink-0 text-sm px-4 py-1.5 rounded-full border font-semibold transition-colors ${
                editMode
                  ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-500"
                  : "border-white/10 text-gray-300 hover:bg-white/5"
              }`}
            >
              {editMode ? "Done" : "Edit"}
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 mb-8" />

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {store.sections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-2">
            <p className="text-gray-600 text-sm">
              {isOwner ? "No sections yet. Click Edit to get started." : "This store has no content yet."}
            </p>
          </div>
        )}

        {/* ── Sections ────────────────────────────────────────────────────── */}
        {editMode ? (
          <DndContext sensors={sensorsSections} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
            <SortableContext items={store.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {store.sections.map((section) => (
                <SortableSection
                  key={section.id}
                  section={section}
                  editMode={editMode}
                  onBlocksReorder={handleBlocksReorder}
                  onAddBlock={(sid) => setAddBlockForSection(sid)}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          store.sections.map((section) => (
            <SectionView key={section.id} section={section} editMode={false} />
          ))
        )}

        {editMode && (
          <button
            onClick={() => setShowAddSection(true)}
            className="w-full border-2 border-dashed border-white/10 rounded-2xl py-4 text-sm text-gray-600 hover:border-white/20 hover:text-gray-400 transition-colors mb-10"
          >
            + Add Section
          </button>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {showAddSection && (
        <AddSectionModal
          storeId={store.id}
          onClose={() => setShowAddSection(false)}
          onCreated={onSectionCreated}
        />
      )}
      {addBlockForSection && (
        <AddBlockModal
          sectionId={addBlockForSection}
          onClose={() => setAddBlockForSection(null)}
          onCreated={(block) => {
            onBlockCreated(addBlockForSection, block);
            setAddBlockForSection(null);
          }}
        />
      )}
    </div>
  );
}
