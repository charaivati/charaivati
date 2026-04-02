"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface StoreItem {
  id: number;
  name: string;
  price: string;
  description: string;
  image: string | null;
}

const defaultItems: StoreItem[] = [
  { id: 1, name: "Item 1", price: "", description: "", image: null },
  { id: 2, name: "Item 2", price: "", description: "", image: null },
  { id: 3, name: "Item 3", price: "", description: "", image: null },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase bg-[#1F1F1F] text-[#9CA3AF] border border-[#2A2A2A]">
      {label}
    </span>
  );
}

function StoreHeader({
  businessName,
  itemCount,
  onAdd,
  onSave,
  saved,
}: {
  businessName: string;
  itemCount: number;
  onAdd: () => void;
  onSave: () => void;
  saved: boolean;
}) {
  const initial = businessName?.charAt(0)?.toUpperCase() || "S";

  return (
    <div className="border-b border-[#1F1F1F] px-4 sm:px-8 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Back link */}
        <Link
          href="/self?tab=earn"
          className="inline-flex items-center gap-1.5 text-[#9CA3AF] hover:text-[#EAEAEA] text-sm transition-colors mb-8"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M8.5 3L4.5 7L8.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Businesses
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          {/* Avatar + info */}
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[#1F1F1F] border border-[#2A2A2A] flex items-center justify-center text-lg font-semibold text-[#EAEAEA] shrink-0 select-none">
              {initial}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#EAEAEA] tracking-tight leading-none">
                {businessName}
              </h1>
              <p className="text-[#9CA3AF] text-sm mt-1.5">
                {itemCount} {itemCount === 1 ? "product" : "products"} · Your store
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onAdd}
              className="px-4 py-2 rounded-lg text-sm text-[#EAEAEA] border border-[#1F1F1F] bg-[#111111] hover:bg-[#1A1A1A] hover:border-[#2A2A2A] transition-all"
            >
              + Add Item
            </button>
            <button
              onClick={onSave}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-[#6366F1] hover:bg-[#5558E3] text-white transition-all"
            >
              {saved ? "✓ Saved" : "Save Store"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockCard({
  item,
  isEditing,
  onEdit,
  onDone,
  onRemove,
  onUpdate,
}: {
  item: StoreItem;
  isEditing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onRemove: () => void;
  onUpdate: (field: keyof StoreItem, value: string) => void;
}) {
  return (
    <div className="group bg-[#111111] border border-[#1F1F1F] rounded-xl overflow-hidden transition-all duration-200 hover:border-[#2A2A2A] hover:scale-[1.015] hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
      {/* Media area */}
      <div className="relative h-44 bg-[#0F0F0F] flex items-center justify-center overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#2A2A2A]">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4 22L10 16L15 21L20 15L28 22" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="text-xs text-[#3A3A3A]">No image</span>
          </div>
        )}
        <div className="absolute top-2.5 left-2.5">
          <Badge label="Product" />
        </div>
      </div>

      {/* Content area */}
      <div className="p-4">
        {isEditing ? (
          <div className="space-y-2.5">
            <input
              autoFocus
              value={item.name}
              onChange={(e) => onUpdate("name", e.target.value)}
              placeholder="Item name"
              className="w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-[#EAEAEA] text-sm placeholder-[#3A3A3A] focus:outline-none focus:border-[#6366F1] transition-colors"
            />
            <input
              value={item.price}
              onChange={(e) => onUpdate("price", e.target.value)}
              placeholder="Price (e.g. ₹299)"
              className="w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-[#EAEAEA] text-sm placeholder-[#3A3A3A] focus:outline-none focus:border-[#6366F1] transition-colors"
            />
            <textarea
              value={item.description}
              onChange={(e) => onUpdate("description", e.target.value)}
              placeholder="Short description..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] text-[#EAEAEA] text-sm placeholder-[#3A3A3A] resize-none focus:outline-none focus:border-[#6366F1] transition-colors"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={onDone}
                className="flex-1 py-1.5 rounded-lg bg-[#6366F1] hover:bg-[#5558E3] text-white text-xs font-medium transition-colors"
              >
                Done
              </button>
              <button
                onClick={onRemove}
                className="px-3 py-1.5 rounded-lg border border-[#2A2A2A] text-[#9CA3AF] hover:text-red-400 hover:border-red-900/40 text-xs transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-[#EAEAEA] text-sm leading-snug line-clamp-2 flex-1">
                {item.name}
              </h3>
              <button
                onClick={onEdit}
                className="text-[#9CA3AF] hover:text-[#EAEAEA] text-xs opacity-0 group-hover:opacity-100 transition-all shrink-0"
              >
                Edit
              </button>
            </div>

            {item.price && (
              <p className="text-[#6366F1] text-sm font-semibold mt-1.5">
                {item.price}
              </p>
            )}

            {item.description ? (
              <p className="text-[#9CA3AF] text-xs mt-1.5 leading-relaxed line-clamp-2">
                {item.description}
              </p>
            ) : (
              <p className="text-[#3A3A3A] text-xs mt-1.5 italic">
                Hover to add details
              </p>
            )}

            <button className="mt-4 w-full py-2 rounded-lg bg-[#1A1A1A] hover:bg-[#6366F1] text-[#9CA3AF] hover:text-white text-xs font-medium border border-[#2A2A2A] hover:border-[#6366F1] transition-all duration-200">
              View Product
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#EAEAEA] tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-[#9CA3AF] text-sm mt-1">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StorePage() {
  const params = useParams();
  const businessId = params?.businessId as string | undefined;

  const [businessName, setBusinessName] = useState<string>("Your Store");
  const [items, setItems] = useState<StoreItem[]>(defaultItems);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/pages/${businessId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.title) setBusinessName(data.title);
      })
      .catch(() => {});

    try {
      const raw = localStorage.getItem(`store_${businessId}`);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, [businessId]);

  const updateItem = (id: number, field: keyof StoreItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => {
    const maxId = items.length ? Math.max(...items.map((i) => i.id)) : 0;
    const newId = maxId + 1;
    setItems((prev) => [
      ...prev,
      { id: newId, name: `Item ${newId}`, price: "", description: "", image: null },
    ]);
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const saveStore = () => {
    if (!businessId) return;
    try {
      localStorage.setItem(`store_${businessId}`, JSON.stringify(items));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EAEAEA]">
      <StoreHeader
        businessName={businessName}
        itemCount={items.length}
        onAdd={addItem}
        onSave={saveStore}
        saved={saved}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12">
        <Section
          title="Products"
          subtitle="Add, edit, and manage everything in your store."
        >
          {items.length === 0 ? (
            <div className="rounded-xl border border-[#1F1F1F] bg-[#111111] p-16 text-center">
              <div className="flex items-center justify-center mb-4 text-[#2A2A2A]">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="5" y="5" width="30" height="30" rx="6" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M14 20H26M20 14V26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-[#9CA3AF] text-sm mb-4">Your store is empty</p>
              <button
                onClick={addItem}
                className="px-5 py-2 rounded-lg bg-[#6366F1] hover:bg-[#5558E3] text-white text-sm font-medium transition-colors"
              >
                Add your first item
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item) => (
                <BlockCard
                  key={item.id}
                  item={item}
                  isEditing={editingId === item.id}
                  onEdit={() => setEditingId(item.id)}
                  onDone={() => setEditingId(null)}
                  onRemove={() => removeItem(item.id)}
                  onUpdate={(field, value) => updateItem(item.id, field, value)}
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
