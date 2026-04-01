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
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      {/* Banner */}
      <div className="relative h-40 sm:h-48 overflow-hidden border-b border-neutral-200">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-pink-400 to-amber-300" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.5),transparent_38%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.2),transparent_45%)]" />
      </div>

      {/* Store Header */}
      <div className="px-4 sm:px-6 -mt-10 sm:-mt-12 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-3">
              <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-white border-4 border-white shadow-xl flex items-center justify-center text-3xl font-bold text-red-600">
                {businessName?.charAt(0)?.toUpperCase() || "S"}
              </div>
              <div className="pb-1">
                <Link
                  href="/self?tab=earn"
                  className="text-red-700 hover:text-red-800 text-xs sm:text-sm transition font-medium"
                >
                  ← Back to Businesses
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold mt-1">{businessName}</h1>
                <p className="text-neutral-600 text-xs sm:text-sm">Your store • Channel-style layout</p>
              </div>
            </div>

            <div className="flex gap-2 pb-1">
              <button
                onClick={addItem}
                className="px-4 py-2 rounded-full bg-white hover:bg-neutral-50 text-neutral-900 text-sm transition border border-neutral-200 shadow-sm"
              >
                + Add Item
              </button>
              <button
                onClick={saveStore}
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium transition text-sm"
              >
                {saved ? "✓ Saved!" : "Save Store"}
              </button>
            </div>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-1 text-sm">
            {["Home", "Products", "Featured", "Services", "Ideas"].map((tab, idx) => (
              <button
                key={tab}
                className={`shrink-0 px-4 py-1.5 rounded-full border ${
                  idx === 0
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-700">
            <span className="px-2.5 py-1 rounded-full bg-white border border-neutral-200 shadow-sm">
              {items.length} items
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white border border-neutral-200 shadow-sm">
              Updated instantly
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white border border-neutral-200 shadow-sm">
              Mobile friendly
            </span>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold">Latest products</h2>
          <p className="text-neutral-600 text-sm mt-1">A clean shelf layout inspired by video platforms.</p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
            <p className="text-neutral-700">No items yet.</p>
            <button
              onClick={addItem}
              className="mt-3 px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-sm font-medium"
            >
              Add your first item
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-neutral-200 rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition group"
            >
              {/* Image placeholder */}
              <div className="h-44 bg-neutral-100 flex items-center justify-center relative">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-neutral-500 text-sm text-center px-4">
                    <div className="text-3xl mb-1">Image</div>
                    <span>No image</span>
                  </div>
                )}
                <span className="absolute bottom-2 right-2 px-2 py-0.5 text-xs rounded bg-neutral-900 text-white">
                  Product
                </span>
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
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-neutral-300 text-neutral-900 text-sm focus:outline-none focus:border-red-500"
                    />
                    <input
                      value={item.price}
                      onChange={(e) => updateItem(item.id, "price", e.target.value)}
                      placeholder="Price (e.g. ₹299)"
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-neutral-300 text-neutral-900 text-sm focus:outline-none focus:border-red-500"
                    />
                    <textarea
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="Short description..."
                      rows={2}
                      className="w-full px-3 py-1.5 rounded-lg bg-white border border-neutral-300 text-neutral-900 text-sm resize-none focus:outline-none focus:border-red-500"
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs transition"
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
                      <h3 className="font-semibold text-neutral-900 text-sm leading-tight line-clamp-2">
                        {item.name}
                      </h3>
                      <button
                        onClick={() => setEditingId(item.id)}
                        className="text-neutral-500 hover:text-neutral-800 text-xs opacity-0 group-hover:opacity-100 transition shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                    {item.price && (
                      <p className="text-red-400 text-sm font-medium mb-1">{item.price}</p>
                    )}
                    {item.description ? (
                      <p className="text-neutral-600 text-xs leading-relaxed line-clamp-3">{item.description}</p>
                    ) : (
                      <p className="text-neutral-600 text-xs italic">
                        Hover and click Edit to add details
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
