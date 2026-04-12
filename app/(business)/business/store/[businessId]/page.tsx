"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

type MediaType = "image" | "video" | "link" | "none";
type ActionType = "view" | "buy" | "book" | "contact";
type SectionType = "grid" | "list" | "featured" | "carousel";

interface Block {
  id: string;
  title: string;
  description?: string | null;
  mediaType: MediaType;
  mediaUrl?: string | null;
  actionType: ActionType;
  price?: number | null;
}

interface Section {
  id: string;
  title: string;
  type: SectionType;
  blocks: Block[];
}

interface Store {
  id: string;
  name: string;
  description?: string | null;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function actionLabel(a: ActionType) {
  return { view: "View", buy: "Buy Now", book: "Book", contact: "Contact" }[a];
}

// ─── Block Card ───────────────────────────────────────────────────────────────

function BlockCard({
  block,
  onRemove,
}: {
  block: Block;
  onRemove: () => void;
}) {
  return (
    <div className="group relative bg-[#0F0F0F] border border-[#1E1E1E] rounded-xl overflow-hidden hover:border-[#2E2E2E] transition-all">
      {/* Media */}
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

      {/* Info */}
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
          <button
            onClick={onRemove}
            className="text-[10px] text-[#4B5563] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Block Panel ──────────────────────────────────────────────────────────

function AddBlockPanel({
  sectionId,
  onCreated,
  onCancel,
}: {
  sectionId: string;
  onCreated: (block: Block) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    mediaType: "image" as MediaType,
    mediaUrl: "",
    actionType: "buy" as ActionType,
    price: "",
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
      onCreated(await res.json());
    }
    setLoading(false);
  }

  const inputCls =
    "w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#1E1E1E] text-[#EAEAEA] text-sm placeholder-[#3A3A3A] focus:outline-none focus:border-[#818CF8] transition-colors";

  return (
    <form
      onSubmit={submit}
      className="mt-3 p-4 rounded-xl bg-[#0A0A0A] border border-[#1E1E1E] space-y-3"
    >
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

// ─── Section Row ──────────────────────────────────────────────────────────────

function SectionRow({
  section,
  onBlockCreated,
  onBlockRemoved,
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
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-xs px-3 py-1 rounded-lg border border-[#1E1E1E] text-[#9CA3AF] hover:text-white hover:border-[#2E2E2E] transition-colors"
        >
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
            <BlockCard
              key={block.id}
              block={block}
              onRemove={() => onBlockRemoved(section.id, block.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Section Form ─────────────────────────────────────────────────────────

function AddSectionForm({
  storeId,
  onCreated,
  onCancel,
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
      <input
        autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Section name (e.g. Featured Products)"
        className="w-full px-3 py-2 rounded-lg bg-black border border-[#1E1E1E] text-[#EAEAEA] text-sm placeholder-[#3A3A3A] focus:outline-none focus:border-[#818CF8] transition-colors"
      />
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

  const [store, setStore] = useState<Store | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [businessName, setBusinessName] = useState("Your Store");
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [addingSection, setAddingSection] = useState(false);

  const loadStore = useCallback(async () => {
    try {
      // 1. Get or create store for this business page
      const forPageRes = await fetch(`/api/store/for-page/${businessId}`);
      if (!forPageRes.ok) throw new Error("Could not load store");
      const { storeId } = await forPageRes.json();

      // 2. Load full store data
      const storeRes = await fetch(`/api/store/${storeId}`);
      if (!storeRes.ok) throw new Error("Could not load store data");
      const data = await storeRes.json();

      setStore({ id: data.id, name: data.name, description: data.description });
      setBusinessName(data.name);
      setSections(
        (data.sections ?? []).map((s: any) => ({
          ...s,
          blocks: s.blocks ?? [],
        }))
      );
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [businessId]);

  // Also try to load business name for display
  useEffect(() => {
    fetch(`/api/pages/${businessId}`)
      .then((r) => r.json())
      .then((d) => { if (d?.title) setBusinessName(d.title); })
      .catch(() => {});
    loadStore();
  }, [businessId, loadStore]);

  function onSectionCreated(section: Section) {
    setSections((prev) => [...prev, section]);
    setAddingSection(false);
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

  const initial = businessName.charAt(0).toUpperCase();
  const totalItems = sections.reduce((n, s) => n + s.blocks.length, 0);

  return (
    <div className="min-h-screen bg-[#080808] text-white">

      {/* ── Top nav bar ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-[#080808]/90 backdrop-blur border-b border-[#111111] px-4 sm:px-8">
        <div className="max-w-5xl mx-auto h-12 flex items-center gap-2">
          <a href="/self?tab=earn"
            className="text-[#6B7280] hover:text-[#EAEAEA] text-xs transition-colors flex items-center gap-1">
            ← Businesses
          </a>
          <span className="text-[#2A2A2A]">/</span>
          <span className="text-[#EAEAEA] text-xs font-medium">{businessName}</span>
          <span className="text-[#2A2A2A]">/</span>
          <span className="text-[#6B7280] text-xs">Store Setup</span>

          <div className="ml-auto flex items-center gap-2">
            <a href="/business/idea"
              className="text-xs px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-[#6B7280] hover:text-white hover:border-[#2E2E2E] transition-colors">
              Evaluate
            </a>
            <a href="/business/plan/new"
              className="text-xs px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-[#6B7280] hover:text-white hover:border-[#2E2E2E] transition-colors">
              Business Plan
            </a>
            {store && (
              <a href={`/store/${store.id}`} target="_blank" rel="noreferrer"
                className="text-xs px-3 py-1.5 rounded-lg bg-[#818CF8]/10 border border-[#818CF8]/30 text-[#818CF8] hover:bg-[#818CF8]/20 hover:text-white transition-colors">
                View Public Store ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Store Header ───────────────────────────────────────────────── */}
      <div className="border-b border-[#111111] px-4 sm:px-8 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-[#111111] border border-[#1E1E1E] flex items-center justify-center text-lg font-bold text-[#EAEAEA] select-none shrink-0">
              {initial}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#EAEAEA] tracking-tight">{businessName}</h1>
              <p className="text-[#6B7280] text-sm mt-0.5">
                {sections.length} section{sections.length !== 1 ? "s" : ""} · {totalItems} item{totalItems !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAddingSection(true)}
              className="px-4 py-2 rounded-lg text-sm border border-[#1E1E1E] text-[#9CA3AF] hover:text-white hover:border-[#2E2E2E] transition-colors"
            >
              + Add Section
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8">

        {phase === "loading" && (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-[#818CF8] border-t-transparent animate-spin" />
          </div>
        )}

        {phase === "error" && (
          <div className="text-center py-20">
            <p className="text-[#6B7280] text-sm">Could not load store. Make sure you're logged in.</p>
            <button onClick={loadStore} className="mt-4 text-xs text-[#818CF8] hover:underline">Try again</button>
          </div>
        )}

        {phase === "ready" && (
          <>
            {addingSection && store && (
              <AddSectionForm
                storeId={store.id}
                onCreated={onSectionCreated}
                onCancel={() => setAddingSection(false)}
              />
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
    </div>
  );
}
