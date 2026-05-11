"use client";

import { useEffect, useState } from "react";

const A = {
  bg: "#F3F4F6",
  border: "#E5E7EB",
  text: "#111827",
  textMuted: "#6B7280",
  accent: "#6366f1",
  surface: "#FFFFFF",
};

type Store = {
  id: string;
  name: string;
  description?: string | null;
  previewImage?: string | null;
};

type PinnedItem = {
  storeId: string;
  storeName: string;
  description?: string | null;
  previewImage?: string | null;
};

type WishlistItem = {
  blockId: string;
  block: {
    id: string;
    title: string;
    price: number | null;
    mediaUrl: string | null;
  };
  store: { id: string; name: string };
};

export default function SavedPage() {
  // Pinned stores & wishlist (top sections)
  const [pinned, setPinned] = useState<PinnedItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);

  // Browse all stores (bottom section)
  const [stores, setStores] = useState<Store[]>([]);
  const [myStoreIds, setMyStoreIds] = useState<Set<string>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [togglingPin, setTogglingPin] = useState<string | null>(null);
  const [removingWishlist, setRemovingWishlist] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/store/pinned", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : { pinned: [] }
      ),
      fetch("/api/store/wishlist", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch("/api/store/all").then((r) =>
        r.ok ? r.json() : { stores: [] }
      ),
      fetch("/api/store/my-stores", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : { stores: [] }
      ),
    ])
      .then(([pinnedData, wishlistData, allData, myData]) => {
        const pinnedList: PinnedItem[] = pinnedData.pinned ?? [];
        setPinned(pinnedList);
        setPinnedIds(new Set(pinnedList.map((p) => p.storeId)));

        setWishlist(Array.isArray(wishlistData) ? wishlistData : []);

        setStores(allData.stores ?? []);
        setMyStoreIds(
          new Set((myData.stores ?? []).map((s: Store) => s.id))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function togglePin(storeId: string) {
    setTogglingPin(storeId);
    try {
      const res = await fetch("/api/store/pinned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ storeId }),
      });
      if (res.ok) {
        const data = await res.json();
        const nowPinned: boolean = data.pinned;
        setPinnedIds((prev) => {
          const next = new Set(prev);
          nowPinned ? next.add(storeId) : next.delete(storeId);
          return next;
        });
        // Also update the top pinned list
        if (nowPinned) {
          const store = stores.find((s) => s.id === storeId);
          if (store) {
            setPinned((prev) => [
              ...prev,
              {
                storeId: store.id,
                storeName: store.name,
                description: store.description,
                previewImage: store.previewImage,
              },
            ]);
          }
        } else {
          setPinned((prev) => prev.filter((p) => p.storeId !== storeId));
        }
      }
    } finally {
      setTogglingPin(null);
    }
  }

  async function toggleWishlist(blockId: string, storeId: string) {
    setRemovingWishlist(blockId);
    try {
      const res = await fetch("/api/store/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ blockId, storeId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.wishlisted) {
          setWishlist((prev) => prev.filter((w) => w.blockId !== blockId));
        }
      }
    } finally {
      setRemovingWishlist(null);
    }
  }

  const filtered = stores.filter(
    (s) =>
      !myStoreIds.has(s.id) &&
      (search === "" || s.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div
        style={{
          background: A.bg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ background: A.bg, minHeight: "100vh" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px" }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: A.text,
            margin: "0 0 20px",
          }}
        >
          Saved
        </h1>

        {/* ── Pinned Stores ── */}
        <section style={{ marginBottom: 28 }}>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: A.text,
              margin: "0 0 10px",
            }}
          >
            📌 Saved Stores
          </h2>

          {pinned.length === 0 ? (
            <p style={{ fontSize: 13, color: A.textMuted }}>
              No saved stores yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pinned.map((p) => {
                const toggling = togglingPin === p.storeId;
                return (
                  <div
                    key={p.storeId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      background: A.surface,
                      borderRadius: 12,
                      border: `1px solid ${A.border}`,
                      overflow: "hidden",
                    }}
                  >
                    <a
                      href={`/store/${p.storeId}`}
                      style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, textDecoration: "none" }}
                    >
                      {p.previewImage ? (
                        <img
                          src={p.previewImage}
                          alt={p.storeName}
                          style={{ width: 64, height: 64, objectFit: "cover", flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{
                          width: 64, height: 64, flexShrink: 0,
                          background: "linear-gradient(135deg,#6366f1,#818cf8)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
                        }}>🏪</div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: A.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.storeName}
                        </div>
                        {p.description && (
                          <div style={{ fontSize: 12, color: A.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.description}
                          </div>
                        )}
                      </div>
                    </a>
                    <button
                      onClick={() => togglePin(p.storeId)}
                      disabled={toggling}
                      style={{
                        flexShrink: 0, marginRight: 12,
                        padding: "5px 10px", borderRadius: 6,
                        fontSize: 11, fontWeight: 600,
                        cursor: toggling ? "default" : "pointer",
                        opacity: toggling ? 0.6 : 1,
                        border: `1px solid ${A.border}`,
                        background: A.surface, color: "#EF4444",
                      }}
                    >
                      {toggling ? "..." : "Unpin"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Wishlist Products ── */}
        <section style={{ marginBottom: 34 }}>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: A.text,
              margin: "0 0 12px",
            }}
          >
            ❤️ Saved Products
          </h2>

          {wishlist.length === 0 ? (
            <p style={{ fontSize: 13, color: A.textMuted }}>
              No saved products yet.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {wishlist.map((item) => {
                const removing = removingWishlist === item.blockId;
                return (
                  <div
                    key={item.blockId}
                    style={{
                      background: A.surface,
                      borderRadius: 10,
                      border: `1px solid ${A.border}`,
                      overflow: "hidden",
                    }}
                  >
                    {item.block.mediaUrl ? (
                      <img
                        src={item.block.mediaUrl}
                        alt={item.block.title}
                        style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <div style={{
                        width: "100%", aspectRatio: "1/1", background: "#F9FAFB",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontSize: 28, color: A.textMuted }}>🖼</span>
                      </div>
                    )}
                    <div style={{ padding: "8px 10px" }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: A.text,
                        display: "-webkit-box", WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {item.block.title}
                      </div>
                      <div style={{ fontSize: 11, color: A.textMuted, marginTop: 4 }}>
                        {item.block.price != null
                          ? `₹${item.block.price.toLocaleString("en-IN")}`
                          : "Free"}
                      </div>
                      <button
                        onClick={() => toggleWishlist(item.blockId, item.store.id)}
                        disabled={removing}
                        style={{
                          marginTop: 8, width: "100%",
                          padding: "5px 0", borderRadius: 6,
                          fontSize: 11, fontWeight: 600,
                          cursor: removing ? "default" : "pointer",
                          opacity: removing ? 0.6 : 1,
                          border: "1px solid rgba(239,68,68,0.3)",
                          background: A.surface, color: "#EF4444",
                        }}
                      >
                        {removing ? "..." : "Unsave"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Browse All Stores ── */}
        <section>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: A.text,
              margin: "0 0 12px",
            }}
          >
            🏪 Browse Stores
          </h2>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stores..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 16px",
              borderRadius: 10,
              border: `1px solid ${A.border}`,
              background: A.surface,
              fontSize: 14,
              color: A.text,
              outline: "none",
              marginBottom: 14,
            }}
          />

          {filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: A.textMuted }}>
              {search ? `No stores match "${search}"` : "No stores yet."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((store) => {
                const isPinned = pinnedIds.has(store.id);
                const isOwn = myStoreIds.has(store.id);
                const toggling = togglingPin === store.id;

                return (
                  <div
                    key={store.id}
                    style={{
                      background: A.surface,
                      borderRadius: 14,
                      border: `1px solid ${A.border}`,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                    }}
                  >
                    {store.previewImage ? (
                      <img
                        src={store.previewImage}
                        alt={store.name}
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 8,
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 8,
                          flexShrink: 0,
                          background:
                            "linear-gradient(135deg,#6366f1,#818cf8)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 28,
                        }}
                      >
                        🏪
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: A.text,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {store.name}
                      </div>
                      {store.description && (
                        <div
                          style={{
                            fontSize: 12,
                            color: A.textMuted,
                            marginTop: 2,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {store.description}
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          marginTop: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        {!isOwn && (
                          <button
                            onClick={() => togglePin(store.id)}
                            disabled={toggling}
                            style={{
                              padding: "5px 10px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: toggling ? "default" : "pointer",
                              opacity: toggling ? 0.6 : 1,
                              border: `1px solid ${isPinned ? A.accent : A.border}`,
                              background: isPinned ? "#EEF2FF" : A.surface,
                              color: isPinned ? A.accent : A.textMuted,
                            }}
                          >
                            {isPinned ? "📌 Pinned" : "🔖 Pin"}
                          </button>
                        )}

                        <a
                          href={`/store/${store.id}`}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            color: A.accent,
                            textDecoration: "none",
                            border: `1px solid ${A.accent}`,
                            background: A.surface,
                          }}
                        >
                          Visit →
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
