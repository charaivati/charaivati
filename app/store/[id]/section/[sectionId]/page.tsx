"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// ─── Theme ────────────────────────────────────────────────────────────────────

const A = {
  bg: "#E3E6E6",
  nav: "#131921",
  surface: "#FFFFFF",
  border: "#DDDDDD",
  text: "#0F1111",
  textMuted: "#565959",
  accent: "#6366f1",
  accentHover: "#4f46e5",
  link: "#007185",
};

type MediaType = "image" | "video" | "link" | "none";
type ActionType = "view" | "buy" | "book" | "contact" | "subscribe";

type Block = {
  id: string;
  title: string;
  description?: string | null;
  mediaType: MediaType;
  mediaUrl?: string | null;
  actionType: ActionType;
  price?: number | null;
};

// ─── Overlay ──────────────────────────────────────────────────────────────────

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-xl p-5 shadow-2xl" style={{ background: "#fff", border: `1px solid ${A.border}` }}>
        {children}
        <button onClick={onClose} className="mt-3 w-full text-xs py-2 rounded-md" style={{ color: A.textMuted, border: `1px solid ${A.border}`, background: "#fff" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── AddBlockModal ────────────────────────────────────────────────────────────

const inputCls = "w-full text-sm px-3 py-2 rounded-md outline-none placeholder:text-zinc-500";
const inputStyle = { background: "#fff", color: A.text, border: `1px solid ${A.border}` };

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
  const [uploading, setUploading] = useState(false);
  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function uploadImage(file: File) {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !preset) { alert("Cloudinary not configured"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", preset);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.secure_url) {
        set("mediaUrl", data.secure_url);
        set("mediaType", data.resource_type === "video" ? "video" : "image");
      }
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    const res = await fetch("/api/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
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
          <h3 className="text-sm font-semibold mb-0.5" style={{ color: A.text }}>New product</h3>
          <p className="text-xs" style={{ color: A.textMuted }}>Add a product or service to this section.</p>
        </div>
        <input autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Title" className={inputCls} style={inputStyle} />
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Description (optional)" rows={2} className={inputCls} style={inputStyle} />
        <div className="flex gap-2">
          <input value={form.mediaUrl} onChange={(e) => set("mediaUrl", e.target.value)} placeholder="Image or video URL" className={inputCls} style={inputStyle} />
          <label className="shrink-0 flex items-center gap-1 text-xs px-3 py-2 rounded-md cursor-pointer whitespace-nowrap"
            style={{ border: `1px solid ${A.border}`, background: "#fff", color: A.textMuted }}>
            {uploading ? "Uploading…" : "Upload"}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          </label>
        </div>
        {form.mediaUrl && (
          <img src={form.mediaUrl} alt="" className="w-full max-h-28 object-cover rounded-md" />
        )}
        <div className="flex gap-2 flex-wrap">
          {(["image", "video", "link", "none"] as MediaType[]).map((m) => (
            <button type="button" key={m} onClick={() => set("mediaType", m)} className="text-xs px-3 py-1.5 rounded-md capitalize"
              style={{ background: form.mediaType === m ? A.accent : "#fff", color: form.mediaType === m ? "#fff" : A.text, border: `1px solid ${A.border}` }}>
              {m}
            </button>
          ))}
        </div>
        <input value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="Price (optional)" inputMode="decimal" className={inputCls} style={inputStyle} />
        <button type="submit" disabled={loading || !form.title.trim()} className="py-2 rounded-md text-xs font-semibold disabled:opacity-40"
          style={{ background: A.accent, color: "#fff", border: `1px solid ${A.accentHover}` }}>
          {loading ? "Adding…" : "Add product"}
        </button>
      </form>
    </Overlay>
  );
}

// ─── TopNav ───────────────────────────────────────────────────────────────────

function TopNav({
  storeName,
  isOwner,
  editMode,
  onToggleEdit,
}: {
  storeName: string;
  isOwner: boolean;
  editMode: boolean;
  onToggleEdit: () => void;
}) {
  const [q, setQ] = useState("");
  return (
    <header className="w-full sticky top-0 z-50">
      <div className="w-full" style={{ background: A.nav }}>
        <div className="max-w-7xl mx-auto px-3 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2 pr-2">
            <div className="w-24 h-8 rounded-sm flex items-center justify-center font-bold" style={{ background: "#fff", color: A.nav }}>
              store
            </div>
          </div>
          <div className="hidden md:flex flex-col text-white text-xs leading-tight pr-3">
            <span className="opacity-80">Deliver to</span>
            <span className="font-bold">Kolkata 700001</span>
          </div>
          <div className="flex-1 flex">
            <select className="hidden sm:block h-10 rounded-l-md px-2 text-sm" style={{ border: `1px solid ${A.border}`, background: "#f3f3f3", color: A.text }}>
              <option>All</option>
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${storeName}`} className="flex-1 h-10 px-3 text-sm outline-none" style={{ borderTop: `1px solid ${A.border}`, borderBottom: `1px solid ${A.border}` }} />
            <button className="h-10 px-4 rounded-r-md" style={{ background: "#FEBD69", border: "1px solid #FEBD69" }}>🔍</button>
          </div>
          <div className="hidden md:flex items-center gap-5 text-white text-xs pl-3">
            <div className="leading-tight">
              <div className="opacity-80">Hello, Sign in</div>
              <div className="font-bold">Account &amp; Lists ▾</div>
            </div>
            <div className="leading-tight">
              <div className="opacity-80">Returns</div>
              <div className="font-bold">&amp; Orders</div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg">🛒</span>
              <span className="font-bold">Cart</span>
            </div>
            {isOwner && (
              <button
                onClick={onToggleEdit}
                className="text-xs font-semibold px-3 py-1.5 rounded-md"
                style={editMode
                  ? { background: A.accent, color: "#fff", border: `1px solid ${A.accentHover}` }
                  : { background: "transparent", color: "#fff", border: "1px solid #848688" }}
              >
                {editMode ? "Done" : "Edit Section"}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({
  block,
  editMode,
  onRemove,
}: {
  block: Block;
  editMode: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-md bg-white hover:shadow-md transition-shadow relative" style={{ border: `1px solid ${A.border}` }}>
      {editMode && onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 z-10 text-xs px-2 py-0.5 rounded"
          style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}
        >
          Remove
        </button>
      )}
      <div className="overflow-hidden bg-white aspect-[4/3]">
        {block.mediaUrl ? (
          <img src={block.mediaUrl} alt={block.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: A.textMuted, background: "#f5f5f5" }}>
            No media
          </div>
        )}
      </div>
      <div className="px-3 pb-4 pt-2">
        <p className="text-sm leading-snug line-clamp-2" style={{ color: A.text }}>{block.title || "Untitled"}</p>
        <div className="flex items-center gap-1 mt-1 text-xs">
          <span style={{ color: A.link }}>★★★★☆</span>
          <span style={{ color: A.link }}>(1,234)</span>
        </div>
        {block.price != null && (
          <div className="mt-1">
            <span className="text-sm font-medium" style={{ color: A.text }}>₹{block.price.toLocaleString("en-IN")}</span>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button className="text-xs font-medium px-3 py-2 rounded-md" style={{ background: A.accent, color: "#fff", border: `1px solid ${A.accentHover}` }}>
            Add to Cart
          </button>
          <button className="text-xs font-medium px-3 py-2 rounded-md" style={{ background: "#FFA41C", border: "1px solid #FF8F00", color: "#111" }}>
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SectionPage() {
  const { id, sectionId } = useParams<{ id: string; sectionId: string }>();

  const [storeName, setStoreName] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);

  useEffect(() => {
    fetch(`/api/store/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setStoreName(data.name ?? "Store");
        setIsOwner(!!data.isOwner);
        const found = (data.sections ?? []).find((s: { id: string; title: string; blocks: Block[] }) => s.id === sectionId);
        if (found) {
          setSectionTitle(found.title);
          setBlocks(found.blocks ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, sectionId]);

  async function removeBlock(blockId: string) {
    const res = await fetch("/api/block", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ blockId }),
    });
    if (res.ok) setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: A.bg }}>
        <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!sectionTitle && blocks.length === 0 && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: A.bg }}>
        <p className="text-sm" style={{ color: A.textMuted }}>Section not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: A.bg }}>
      <TopNav storeName={storeName} isOwner={isOwner} editMode={editMode} onToggleEdit={() => setEditMode((v) => !v)} />

      <main className="max-w-7xl mx-auto px-3 py-6">
        <a href={`/store/${id}`} className="text-sm hover:underline mb-4 block" style={{ color: "#6366f1" }}>
          ← Back to store
        </a>

        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold" style={{ color: A.text }}>{sectionTitle}</h1>
          {editMode && isOwner && (
            <button
              onClick={() => setAddingBlock(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-md"
              style={{ background: "#fff", color: A.text, border: `1px solid ${A.border}` }}
            >
              + Add product
            </button>
          )}
        </div>
        <p className="text-sm mb-4" style={{ color: A.textMuted }}>{blocks.length} product{blocks.length !== 1 ? "s" : ""} in this section</p>

        {blocks.length === 0 ? (
          <p className="text-sm" style={{ color: A.textMuted }}>No products yet.{isOwner ? " Click 'Edit Section' to add some." : ""}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {blocks.map((block) => (
              <ProductCard
                key={block.id}
                block={block}
                editMode={editMode}
                onRemove={() => removeBlock(block.id)}
              />
            ))}
          </div>
        )}
      </main>

      {addingBlock && (
        <AddBlockModal
          sectionId={sectionId}
          onClose={() => setAddingBlock(false)}
          onCreated={(block) => {
            setBlocks((prev) => [...prev, block]);
            setAddingBlock(false);
          }}
        />
      )}
    </div>
  );
}
