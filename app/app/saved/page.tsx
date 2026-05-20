"use client";

import { useEffect, useState } from "react";
import QuickOrderModal from "@/components/store/QuickOrderModal";
import { useTranslations } from "@/hooks/useTranslations";

const SAVED_SLUGS =
  "app-saved-heading,app-saved-pinned-heading,app-saved-pinned-empty," +
  "app-saved-unpin,app-saved-unpinning,app-saved-wishlist-heading," +
  "app-saved-wishlist-empty,app-saved-free,app-saved-buy-now," +
  "app-saved-unsave,app-saved-removing,app-saved-browse-heading," +
  "app-saved-search-placeholder,app-saved-no-stores," +
  "app-saved-pin,app-saved-pinned-label,app-saved-pinning,app-saved-visit";

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
  slug?: string | null;
  name: string;
  description?: string | null;
  previewImage?: string | null;
};

type PinnedItem = {
  storeId: string;
  storeSlug?: string | null;
  storeName: string;
  description?: string | null;
  previewImage?: string | null;
};

type WishlistItem = {
  blockId: string;
  storeId: string;
  block: {
    id: string;
    title: string;
    price: number | null;
    mediaUrl: string | null;
  };
  store: { id: string; slug?: string | null; name: string };
};

type QuickItem = {
  blockId: string; title: string; price: number; quantity: number; imageUrl?: string | null;
  storeId: string; storeName: string;
};

function PinnedSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            background: A.surface, borderRadius: 12,
            border: `1px solid ${A.border}`, overflow: "hidden",
          }}
        >
          <div className="w-16 h-16 bg-gray-200 animate-pulse flex-shrink-0" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h-3.5 bg-gray-200 rounded animate-pulse mb-1.5" style={{ width: "60%" }} />
            <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: "40%" }} />
          </div>
          <div className="h-7 w-14 bg-gray-200 rounded animate-pulse flex-shrink-0 mr-3" />
        </div>
      ))}
    </div>
  );
}

function WishlistSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            background: A.surface, borderRadius: 10,
            border: `1px solid ${A.border}`, overflow: "hidden",
          }}
        >
          <div className="w-full bg-gray-200 animate-pulse" style={{ aspectRatio: "1/1" }} />
          <div style={{ padding: "8px 10px" }}>
            <div className="h-3 bg-gray-200 rounded animate-pulse mb-1" />
            <div className="h-3 bg-gray-200 rounded animate-pulse mb-1" style={{ width: "75%" }} />
            <div className="h-3 bg-gray-200 rounded animate-pulse mb-2.5" style={{ width: "50%" }} />
            <div style={{ display: "flex", gap: 5 }}>
              <div className="h-6 bg-gray-200 rounded animate-pulse flex-1" />
              <div className="h-6 bg-gray-200 rounded animate-pulse flex-1" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BrowseSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: A.surface, borderRadius: 14,
            border: `1px solid ${A.border}`,
            display: "flex", alignItems: "center", gap: 12, padding: 12,
          }}
        >
          <div className="w-20 h-20 bg-gray-200 rounded-lg animate-pulse flex-shrink-0" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h-3.5 bg-gray-200 rounded animate-pulse mb-1.5" style={{ width: "55%" }} />
            <div className="h-3 bg-gray-200 rounded animate-pulse mb-1" style={{ width: "80%" }} />
            <div className="h-3 bg-gray-200 rounded animate-pulse mb-3" style={{ width: "65%" }} />
            <div style={{ display: "flex", gap: 6 }}>
              <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ButtonSpinner() {
  return (
    <span
      className="inline-block w-3 h-3 border-2 border-current rounded-full animate-spin"
      style={{ borderTopColor: "transparent", flexShrink: 0 }}
    />
  );
}

export default function SavedPage() {
  const t = useTranslations(SAVED_SLUGS);

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
  const [quickOrder, setQuickOrder] = useState<QuickItem | null>(null);

  const [loadingPinned, setLoadingPinned] = useState(true);
  const [loadingWishlist, setLoadingWishlist] = useState(true);
  const [loadingBrowse, setLoadingBrowse] = useState(true);

  useEffect(() => {
    fetch("/api/store/pinned", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { pinned: [] })
      .then((pinnedData) => {
        const pinnedList: PinnedItem[] = pinnedData.pinned ?? [];
        setPinned(pinnedList);
        setPinnedIds(new Set(pinnedList.map((p) => p.storeId)));
      })
      .catch(() => {})
      .finally(() => setLoadingPinned(false));

    fetch("/api/store/wishlist", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((wishlistData) => {
        setWishlist(Array.isArray(wishlistData) ? wishlistData : []);
      })
      .catch(() => {})
      .finally(() => setLoadingWishlist(false));

    Promise.all([
      fetch("/api/store/all").then((r) => r.ok ? r.json() : { stores: [] }),
      fetch("/api/store/my-stores", { credentials: "include" }).then((r) => r.ok ? r.json() : { stores: [] }),
    ])
      .then(([allData, myData]) => {
        setStores(allData.stores ?? []);
        setMyStoreIds(
          new Set((myData.stores ?? []).map((s: Store) => s.id))
        );
      })
      .catch(() => {})
      .finally(() => setLoadingBrowse(false));
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
          {t("app-saved-heading", "Explore")}
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
            📌 {t("app-saved-pinned-heading", "Saved Stores")}
          </h2>

          {loadingPinned ? (
            <PinnedSkeleton />
          ) : pinned.length === 0 ? (
            <p style={{ fontSize: 13, color: A.textMuted }}>
              {t("app-saved-pinned-empty", "No saved stores yet.")}
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
                      href={`/store/${p.storeSlug ?? p.storeId}`}
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
                        opacity: toggling ? 0.5 : 1,
                        border: `1px solid ${A.border}`,
                        background: A.surface, color: "#EF4444",
                        display: "flex", alignItems: "center", gap: 4,
                        transition: "opacity 0.15s",
                      }}
                    >
                      {toggling && <ButtonSpinner />}
                      {toggling ? t("app-saved-unpinning", "Unpinning") : t("app-saved-unpin", "Unpin")}
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
            ❤️ {t("app-saved-wishlist-heading", "Saved Products")}
          </h2>

          {loadingWishlist ? (
            <WishlistSkeleton />
          ) : wishlist.length === 0 ? (
            <p style={{ fontSize: 13, color: A.textMuted }}>
              {t("app-saved-wishlist-empty", "No saved products yet.")}
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
                const storeHandle = item.store.slug ?? item.store.id;
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
                      <div style={{ fontSize: 11, color: A.textMuted, marginTop: 2 }}>
                        {item.block.price != null
                          ? `₹${item.block.price.toLocaleString("en-IN")}`
                          : t("app-saved-free", "Free")}
                      </div>
                      <a
                        href={`/store/${storeHandle}`}
                        style={{
                          display: "block", fontSize: 10, color: A.accent,
                          marginTop: 3, textDecoration: "none",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                      >
                        {item.store.name}
                      </a>
                      <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                        <button
                          onClick={() => setQuickOrder({
                            blockId: item.block.id,
                            title: item.block.title,
                            price: item.block.price ?? 0,
                            quantity: 1,
                            imageUrl: item.block.mediaUrl,
                            storeId: item.store.id,
                            storeName: item.store.name,
                          })}
                          style={{
                            flex: 1, padding: "5px 0", borderRadius: 6,
                            fontSize: 11, fontWeight: 600, cursor: "pointer",
                            background: "#FFA41C", border: "1px solid #FF8F00", color: "#111",
                          }}
                        >
                          {t("app-saved-buy-now", "Buy Now")}
                        </button>
                        <button
                          onClick={() => toggleWishlist(item.blockId, item.store.id)}
                          disabled={removing}
                          style={{
                            flex: 1, padding: "5px 0", borderRadius: 6,
                            fontSize: 11, fontWeight: 600,
                            cursor: removing ? "default" : "pointer",
                            opacity: removing ? 0.5 : 1,
                            border: "1px solid rgba(239,68,68,0.3)",
                            background: A.surface, color: "#EF4444",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                            transition: "opacity 0.15s",
                          }}
                        >
                          {removing && <ButtonSpinner />}
                          {removing ? t("app-saved-removing", "Removing") : t("app-saved-unsave", "Unsave")}
                        </button>
                      </div>
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
            🏪 {t("app-saved-browse-heading", "Browse Stores")}
          </h2>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("app-saved-search-placeholder", "Search stores...")}
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

          {loadingBrowse ? (
            <BrowseSkeleton />
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: A.textMuted }}>
              {search ? `No stores match "${search}"` : t("app-saved-no-stores", "No stores yet.")}
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
                              opacity: toggling ? 0.5 : 1,
                              border: `1px solid ${isPinned ? A.accent : A.border}`,
                              background: isPinned ? "#EEF2FF" : A.surface,
                              color: isPinned ? A.accent : A.textMuted,
                              display: "flex", alignItems: "center", gap: 4,
                              transition: "opacity 0.15s",
                            }}
                          >
                            {toggling && <ButtonSpinner />}
                            {toggling
                              ? (isPinned ? t("app-saved-unpinning", "Unpinning") : t("app-saved-pinning", "Pinning"))
                              : (isPinned ? `📌 ${t("app-saved-pinned-label", "Pinned")}` : `🔖 ${t("app-saved-pin", "Pin")}`)}
                          </button>
                        )}

                        <a
                          href={`/store/${store.slug ?? store.id}`}
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
                          {t("app-saved-visit", "Visit →")}
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

      {quickOrder && (
        <QuickOrderModal
          open
          onClose={() => setQuickOrder(null)}
          storeId={quickOrder.storeId}
          storeName={quickOrder.storeName}
          initialItem={{
            blockId: quickOrder.blockId,
            title: quickOrder.title,
            price: quickOrder.price,
            quantity: quickOrder.quantity,
            imageUrl: quickOrder.imageUrl,
          }}
        />
      )}
    </div>
  );
}
