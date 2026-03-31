"use client";

import React, { useEffect, useState } from "react";
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

export default function StorePage() {
  const params = useParams();
  const businessId = params?.businessId as string | undefined;

  const [businessName, setBusinessName] = useState<string>("Your Store");
  const [items, setItems] = useState<StoreItem[]>(defaultItems);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  // Load business name from API
  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/pages/${businessId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.title) setBusinessName(data.title);
      })
      .catch(() => {});

    // Load saved store data
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
    const newId = Math.max(...items.map((i) => i.id)) + 1;
    setItems((prev) => [
      ...prev,
      { id: newId, name: `Item ${newId}`, price: "", description: "", image: null },
    ]);
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const saveStore = () => {
    try {
      localStorage.setItem(`store_${businessId}`, JSON.stringify(items));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Store Header */}
      <div className="bg-gradient-to-r from-emerald-900/60 to-teal-900/60 border-b border-emerald-700/30 px-6 py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <a
                href="/self?tab=earn"
                className="text-emerald-400/70 hover:text-emerald-300 text-sm transition"
              >
                ← Back
              </a>
            </div>
            <h1 className="text-3xl font-bold text-white">{businessName}</h1>
            <p className="text-emerald-300/70 text-sm mt-1">Store</p>
          </div>
          <button
            onClick={saveStore}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition text-sm"
          >
            {saved ? "✓ Saved!" : "Save Store"}
          </button>
        </div>
      </div>

      {/* Items Grid */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Products</h2>
          <button
            onClick={addItem}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm transition border border-white/10"
          >
            + Add Item
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden hover:border-emerald-600/40 transition group"
            >
              {/* Image placeholder */}
              <div className="h-36 bg-slate-700/50 flex items-center justify-center relative">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-slate-500 text-sm text-center px-4">
                    <div className="text-3xl mb-1">🛍️</div>
                    <span>No image</span>
                  </div>
                )}
              </div>

              {/* Item details */}
              <div className="p-4">
                {editingId === item.id ? (
                  /* Edit mode */
                  <div className="space-y-2">
                    <input
                      autoFocus
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      placeholder="Item name"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      value={item.price}
                      onChange={(e) => updateItem(item.id, "price", e.target.value)}
                      placeholder="Price (e.g. ₹299)"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <textarea
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="Short description..."
                      rows={2}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm resize-none focus:outline-none focus:border-emerald-500"
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs transition"
                      >
                        Done
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-white text-sm leading-tight">
                        {item.name}
                      </h3>
                      <button
                        onClick={() => setEditingId(item.id)}
                        className="text-slate-500 hover:text-slate-300 text-xs opacity-0 group-hover:opacity-100 transition shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                    {item.price && (
                      <p className="text-emerald-400 text-sm font-medium mb-1">{item.price}</p>
                    )}
                    {item.description ? (
                      <p className="text-slate-400 text-xs leading-relaxed">{item.description}</p>
                    ) : (
                      <p className="text-slate-600 text-xs italic">
                        Hover and click Edit to add details
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
