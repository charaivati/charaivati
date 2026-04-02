"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// --- TYPE DEFINITIONS ---
type MediaType = "image" | "video" | "link" | "none";
type ActionType = "view" | "buy" | "book" | "contact";
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

type Section = {
  id: string;
  title: string;
  type: SectionType;
  blocks: Block[];
  subsections?: Section[];
};

type Store = {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
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
  accent: "#FFD814",
  accentHover: "#F7CA00",
  link: "#007185",
  deal: "#CC0C39",
};

const inputCls = "w-full text-sm px-3 py-2 rounded-md outline-none placeholder:text-zinc-500";
const inputStyle = { background: "#fff", color: A.text, border: `1px solid ${A.border}` };

// --- COMPONENTS ---
function MediaThumb({
  block,
  className,
  editMode,
}: {
  block: Block;
  className?: string;
  editMode: boolean;
}) {
  const base = "relative overflow-hidden bg-white " + (className ?? "aspect-[4/3]");
  const url = block.mediaUrl ?? "";
  return (
    <div className={base}>
      {block.mediaType === "video" && url ? (
        <video src={url} className="w-full h-full object-contain bg-white" muted playsInline preload="metadata" />
      ) : block.mediaType === "image" && url ? (
        <img src={url} alt={block.title} className="w-full h-full object-contain bg-white" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: A.textMuted }}>
          No media
        </div>
      )}
      {editMode && (
        <div className="absolute top-1 left-1 text-xs px-1.5 py-0.5 rounded bg-black/70 text-white">
          {block.mediaType}
        </div>
      )}
    </div>
  );
}

function ProductCard({ block }: { block: Block }) {
  return (
    <div className="rounded-md bg-white hover:shadow-md transition-shadow" style={{ border: `1px solid ${A.border}` }}>
      <div className="p-3">
        <MediaThumb block={block} className="w-full aspect-[4/3]" editMode={false} />
      </div>
      <div className="px-3 pb-4">
        <p className="text-sm leading-snug line-clamp-2" style={{ color: A.text }}>
          {block.title || "Untitled"}
        </p>
        <div className="flex items-center gap-1 mt-1 text-xs">
          <span style={{ color: A.link }}>★★★★☆</span>
          <span style={{ color: A.link }}>(1,234)</span>
        </div>
        <p className="text-xs mt-1" style={{ color: A.text }}>
          Get it by <span className="font-medium">Tomorrow</span>. <span className="font-medium">FREE Delivery by Amazon.</span>
        </p>
        {block.price != null && (
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-sm font-medium" style={{ color: A.text }}>
              ₹{block.price.toLocaleString("en-IN")}
            </span>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button
            className="text-xs font-medium px-3 py-2 rounded-md"
            style={{ background: A.accent, border: `1px solid #FCD200`, color: "#111" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = A.accentHover)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = A.accent)}
          >
            Add to Cart
          </button>
          <button
            className="text-xs font-medium px-3 py-2 rounded-md"
            style={{ background: "#FFA41C", border: `1px solid #FF8F00`, color: "#111" }}
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductRow({ block }: { block: Block }) {
  return (
    <div className="flex gap-4 p-4 rounded-md" style={{ background: A.surface, border: `1px solid ${A.border}` }}>
      <div className="w-52 shrink-0">
        <MediaThumb block={block} className="w-full aspect-square" editMode={false} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-lg leading-snug line-clamp-2 hover:text-orange-600 cursor-pointer" style={{ color: A.text }}>
          {block.title}
        </p>
        <div className="flex items-center gap-1 mt-1 text-xs">
          <span style={{ color: A.link }}>★★★★☆</span>
          <span className="hover:underline cursor-pointer" style={{ color: A.link }}>(1,234)</span>
        </div>
        {block.price != null ? (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 font-semibold" style={{ background: A.deal, color: "white" }}>
                Limited time deal
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl" style={{ color: A.deal }}>
                -17%
              </span>
              <span className="text-2xl" style={{ color: A.text }}>
                <sup>₹</sup>
                {block.price.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="text-xs" style={{ color: A.textMuted }}>
              M.R.P.: <span className="line-through">₹{(block.price * 1.2).toLocaleString("en-IN")}</span>
            </div>
          </div>
        ) : null}
        <p className="text-sm mt-2" style={{ color: A.text }}>
          Get it by <span className="font-semibold text-green-800">Tomorrow, April 4</span>.
        </p>
        <div className="mt-3">
          <button className="text-xs font-medium px-4 py-1.5 rounded-full" style={{ background: A.accent, border: `1px solid #FCD200` }}>
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableSection({
  section,
  editMode,
  onBlocksReorder,
  onAddBlock,
}: {
  section: Section;
  editMode: boolean;
  onBlocksReorder: (sectionId: string, newBlocks: Block[]) => void;
  onAddBlock: (sectionId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const sensorsBlocks = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleBlockDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = section.blocks.findIndex((b) => b.id === active.id);
    const newIndex = section.blocks.findIndex((b) => b.id === over.id);
    const reordered = arrayMove(section.blocks, oldIndex, newIndex);
    onBlocksReorder(section.id, reordered);
  }

  // Render blocks based on section type
  const renderBlocks = () => {
    switch (section.type) {
      case "carousel":
        return (
          <div className="overflow-x-auto -mx-3 px-3">
            <div className="flex gap-4">
              {section.blocks.map((b) => (
                <div key={b.id} className="w-64 shrink-0">
                  <ProductCard block={b} />
                </div>
              ))}
            </div>
          </div>
        );
      case "featured":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.blocks.map((b) => (
              <ProductRow key={b.id} block={b} />
            ))}
          </div>
        );
      case "list":
      case "grid":
      default:
        // Both list and grid now render as a 5-column grid
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4">
            {section.blocks.map((b) => (
              <ProductCard key={b.id} block={b} />
            ))}
          </div>
        );
    }
  };

  return (
    <section ref={setNodeRef} style={style} className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {editMode && (
            <button
              className="cursor-grab text-xs px-2 py-1 rounded"
              style={{ color: A.textMuted, border: `1px solid ${A.border}`, background: "#fff" }}
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
          <button
            onClick={() => onAddBlock(section.id)}
            className="text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{ background: "#fff", color: A.text, border: `1px solid ${A.border}` }}
          >
            + Add block
          </button>
        )}
      </div>

      {renderBlocks()}

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

function TopNav({ editMode, onToggleEdit, isOwner }: { editMode: boolean; onToggleEdit: () => void; isOwner: boolean }) {
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
              <button
                onClick={onToggleEdit}
                className="text-xs font-semibold px-3 py-1.5 rounded-md"
                style={editMode ? { background: A.accent, color: "#111", border: `1px solid #FCD200` } : { background: "transparent", color: "#fff", border: `1px solid #848688` }}
              >
                {editMode ? "Done" : "Edit"}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="w-full" style={{ background: A.nav2 }}>
        <div className="max-w-7xl mx-auto px-3 h-10 flex items-center gap-4 text-white text-sm">
          <span className="font-semibold">☰ All</span>
          {["Today's Deals", "Mobiles", "Electronics", "Fashion", "Home", "Books", "Prime ▾"].map((c) => (
            <span key={c} className="opacity-90 hover:opacity-100 cursor-pointer">{c}</span>
          ))}
        </div>
      </div>
    </header>
  );
}

function StoreHero({ store, totalBlocks }: { store: Store; totalBlocks: number }) {
  return (
    <div className="w-full" style={{ background: A.surface, borderBottom: `1px solid ${A.border}` }}>
      {store.bannerUrl ? (
        <img src={store.bannerUrl} alt="banner" className="w-full h-40 sm:h-56 object-cover" />
      ) : (
        <div className="w-full h-24 sm:h-32" style={{ background: "linear-gradient(90deg,#232F3E,#37475A)" }} />
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
        <div>
          <h3 className="text-sm font-semibold mb-0.5" style={{ color: A.text }}>New section</h3>
          <p className="text-xs" style={{ color: A.textMuted }}>Choose a layout that best fits this content.</p>
        </div>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Section title" className={inputCls} style={inputStyle} />
        <div className="flex gap-2">
          {(["grid", "list", "featured", "carousel"] as SectionType[]).map((opt) => (
            <button type="button" key={opt} onClick={() => setType(opt)} className="text-xs px-3 py-1.5 rounded-md capitalize"
              style={{ background: type === opt ? "#FFF4CC" : "#fff", color: A.text, border: `1px solid ${A.border}` }}>
              {opt}
            </button>
          ))}
        </div>
        <button type="submit" disabled={loading || !title.trim()} className="py-2 rounded-md text-xs font-semibold disabled:opacity-40" style={{ background: A.accent, border: `1px solid #FCD200` }}>
          {loading ? "Creating…" : "Create section"}
        </button>
      </form>
    </Overlay>
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

  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [addBlockForSection, setAddBlockForSection] = useState<string | null>(null);

  const fetchStore = useCallback(async () => {
    try {
      const res = await fetch(`/api/store/${id}`);
      if (res.ok) {
        setStore(await res.json());
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

  return (
    <div className="min-h-screen" style={{ background: A.bg }}>
      <TopNav editMode={editMode} onToggleEdit={() => setEditMode((e) => !e)} isOwner={store.isOwner} />
      <StoreHero store={store} totalBlocks={totalBlocks} />

      <main className="max-w-7xl mx-auto px-3 py-4">
        {store.sections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-2" style={{ background: A.surface, border: `1px solid ${A.border}` }}>
            <div className="w-12 h-12 rounded-md flex items-center justify-center mb-2" style={{ background: "#fff", border: `1px solid ${A.border}` }}>
              <span style={{ color: A.textMuted, fontSize: 18 }}>▤</span>
            </div>
            <p className="text-sm" style={{ color: A.textMuted }}>
              {store.isOwner ? "No sections yet. Click Edit to get started." : "This store has no content yet."}
            </p>
          </div>
        )}

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
            <SortableSection
              key={section.id}
              section={section}
              editMode={editMode}
              onBlocksReorder={handleBlocksReorder}
              onAddBlock={(sid) => setAddBlockForSection(sid)}
            />
          ))
        )}

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

      {showAddSection && store && (
        <AddSectionModal storeId={store.id} onClose={() => setShowAddSection(false)} onCreated={onSectionCreated} />
      )}
      {addBlockForSection && (
        <AddBlockModal sectionId={addBlockForSection} onClose={() => setAddBlockForSection(null)} onCreated={(block) => onBlockCreated(addBlockForSection, block)} />
      )}
    </div>
  );
}