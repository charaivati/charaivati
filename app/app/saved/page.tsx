"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QuickOrderModal from "@/components/store/QuickOrderModal";
import DiscoveryFilterModal, { type DiscoveryFilters } from "@/components/store/DiscoveryFilterModal";
import { FilterPill } from "@/components/store/FilterPill";
import RequestsPage from "@/app/app/requests/page";
import UnifiedSearch from "@/components/UnifiedSearch";
import { useTranslations } from "@/hooks/useTranslations";

const SAVED_SLUGS =
  "app-saved-heading,app-saved-pinned-heading,app-saved-pinned-empty," +
  "app-saved-unpin,app-saved-unpinning,app-saved-wishlist-heading," +
  "app-saved-wishlist-empty,app-saved-free,app-saved-buy-now," +
  "app-saved-unsave,app-saved-removing,app-saved-browse-heading," +
  "app-saved-search-placeholder,app-saved-no-stores," +
  "app-saved-pin,app-saved-pinned-label,app-saved-pinning,app-saved-visit," +
  "app-saved-filter-button,app-saved-filter-active," +
  "app-discover-distance-km,app-discover-distance-unknown," +
  "app-search-stores-tab,app-search-products-tab,app-search-services-tab,app-search-people-tab," +
  "app-search-products-placeholder,app-search-products-no-results," +
  "app-search-products-heading,app-search-filter-by-category";

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
  distanceKm?: number | null;
  pageId?: string | null;
  isFleet?: boolean;
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
  store: { id: string; slug?: string | null; name: string; acceptingOrders?: boolean };
};

type QuickItem = {
  blockId: string; title: string; price: number; quantity: number; imageUrl?: string | null;
  storeId: string; storeName: string;
};

type ProductResult = {
  blockId: string;
  title: string;
  description: string | null;
  price: number | null;
  mediaUrl: string | null;
  storeId: string;
  storeName: string | null;
  storeSlug: string | null;
  distanceKm: number | null;
};

type BrowseTab = "stores" | "products" | "services" | "people";

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

function ProductsSkeleton() {
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
            <div className="h-3 bg-gray-200 rounded animate-pulse mb-1" style={{ width: "60%" }} />
            <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: "40%" }} />
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

  // Browse all stores (unfiltered)
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

  // Discovery filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<DiscoveryFilters | null>(null);
  const [filteredStores, setFilteredStores] = useState<Store[]>([]);
  const [loadingFiltered, setLoadingFiltered] = useState(false);

  // Browse tab toggle (stores vs products)
  const [browseTab, setBrowseTab] = useState<BrowseTab>("stores");

  // Product search state
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductResult[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearched, setProductSearched] = useState(false);
  const productDebounceRef = useRef<number | undefined>(undefined);

  // People tab — friend/follow state (lazy-loaded on first tab open)
  const [friendState, setFriendState] = useState<{ friends: string[]; outgoing: string[]; incoming: string[]; following: string[] }>({ friends: [], outgoing: [], incoming: [], following: [] });
  const friendStateLoadedRef = useRef(false);

  useEffect(() => {
    if (browseTab !== "people" || friendStateLoadedRef.current) return;
    friendStateLoadedRef.current = true;
    Promise.all([
      fetch("/api/user/friends", { credentials: "include" }),
      fetch("/api/user/follows", { credentials: "include" }),
    ])
      .then(([fr, fo]) => Promise.all([fr.json(), fo.json()]))
      .then(([fd, fod]) => {
        setFriendState({
          friends: (fd.friends ?? []).map((x: any) => x?.id ?? x),
          outgoing: (fd.outgoingRequests ?? []).map((x: any) => x?.receiverId ?? x?.receiver?.id ?? x),
          incoming: (fd.incomingRequests ?? []).map((x: any) => x?.senderId ?? x?.sender?.id ?? x),
          following: (fod.follows ?? []).map((x: any) => x?.pageId ?? x),
        });
      })
      .catch(() => {});
  }, [browseTab]);

  async function sendFriend(userId: string) {
    await fetch("/api/user/friends", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiverId: userId }) });
  }
  async function unfriend(userId: string) {
    await fetch("/api/friends/remove", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friendId: userId }) });
  }
  async function followPage(pageId: string) {
    await fetch("/api/user/follows", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId }) });
  }
  function handleFriendAction(_kind: "page" | "person", id: string, status: string) {
    setFriendState((prev) => {
      if (status === "requested") return { ...prev, outgoing: [...prev.outgoing, id] };
      if (status === "unfriended") return { ...prev, friends: prev.friends.filter((x) => x !== id) };
      if (status === "following") return { ...prev, following: [...prev.following, id] };
      return prev;
    });
  }

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
      fetch("/api/store/all?includeFleet=1").then((r) => r.ok ? r.json() : { stores: [] }),
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

  // Re-fetch with filter params when activeFilters changes
  useEffect(() => {
    if (!activeFilters) return;
    setLoadingFiltered(true);
    const params = new URLSearchParams();
    params.set("includeFleet", "1");
    if (activeFilters.categoryIds.length)
      params.set("categoryIds", activeFilters.categoryIds.join(","));
    if (activeFilters.tagIds.length)
      params.set("tagIds", activeFilters.tagIds.join(","));
    if (activeFilters.addressLat != null && activeFilters.addressLng != null) {
      params.set("addressLat", String(activeFilters.addressLat));
      params.set("addressLng", String(activeFilters.addressLng));
    }
    fetch(`/api/store/all?${params.toString()}`)
      .then((r) => r.ok ? r.json() : { stores: [] })
      .then((json) => setFilteredStores(json.stores ?? []))
      .catch(() => setFilteredStores([]))
      .finally(() => setLoadingFiltered(false));
  }, [activeFilters]);

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

  // Active list depends on whether filters are applied
  const baseList = activeFilters !== null ? filteredStores : stores;
  const displayedStores = baseList.filter(
    (s) =>
      !myStoreIds.has(s.id) &&
      (search === "" || s.name.toLowerCase().includes(search.toLowerCase()))
  );

  const filterCount =
    (activeFilters?.categoryIds.length ?? 0) + (activeFilters?.tagIds.length ?? 0);

  const isLoading = activeFilters !== null ? loadingFiltered : loadingBrowse;

  function handleApply(filters: DiscoveryFilters) {
    setActiveFilters(filters);
  }

  async function searchProducts(q: string) {
    setLoadingProducts(true);
    setProductSearched(true);
    try {
      const params = new URLSearchParams({ q, limit: "30" });
      if (activeFilters?.categoryIds.length)
        params.set("categoryIds", activeFilters.categoryIds.join(","));
      if (activeFilters?.addressLat != null && activeFilters?.addressLng != null) {
        params.set("addressLat", String(activeFilters.addressLat));
        params.set("addressLng", String(activeFilters.addressLng));
      }
      const res = await fetch(`/api/store/product-search?${params.toString()}`, {
        credentials: "include",
      });
      const json = res.ok ? await res.json() : { products: [] };
      setProductResults(json.products ?? []);
    } catch {
      setProductResults([]);
    } finally {
      setLoadingProducts(false);
    }
  }

  // Debounced live search as the user types (mirrors UnifiedSearch.tsx's DEBOUNCE_MS=250 pattern)
  useEffect(() => {
    window.clearTimeout(productDebounceRef.current);
    if (browseTab !== "products" || productQuery.trim() === "") return;
    productDebounceRef.current = window.setTimeout(() => {
      searchProducts(productQuery);
    }, 250);
    return () => window.clearTimeout(productDebounceRef.current);
  }, [productQuery, browseTab]);

  function renderProductCard(p: ProductResult) {
    const storeHandle = p.storeSlug ?? p.storeId;
    return (
      <div
        key={p.blockId}
        style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e2e8f0", overflow: "hidden" }}
      >
        {p.mediaUrl ? (
          <img
            src={p.mediaUrl}
            alt={p.title}
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
            {p.title}
          </div>
          {p.price != null && (
            <div style={{ fontSize: 11, color: A.textMuted, marginTop: 2 }}>
              ₹{p.price.toLocaleString("en-IN")}
            </div>
          )}
          {p.storeName && (
            <a
              href={`/store/${storeHandle}`}
              style={{
                display: "block", fontSize: 10, color: A.accent,
                marginTop: 2, textDecoration: "none",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {p.storeName}
            </a>
          )}
          {p.distanceKm != null ? (
            <div style={{ fontSize: 10, color: A.textMuted, marginTop: 2 }}>
              {(t("app-discover-distance-km", "{km} km away") || "").replace("{km}", String(p.distanceKm))}
            </div>
          ) : activeFilters?.addressLat != null ? (
            <div style={{ fontSize: 10, color: A.textMuted, marginTop: 2 }}>
              {t("app-discover-distance-unknown", "Distance unknown")}
            </div>
          ) : null}
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setQuickOrder({
                blockId: p.blockId,
                title: p.title,
                price: p.price ?? 0,
                quantity: 1,
                imageUrl: p.mediaUrl,
                storeId: p.storeId,
                storeName: p.storeName ?? "",
              })}
              style={{
                width: "100%", padding: "5px 0", borderRadius: 6,
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: "#FFA41C", border: "1px solid #FF8F00", color: "#111",
              }}
            >
              {t("app-saved-buy-now", "Buy Now")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderStoreCard(store: Store) {
    const isPinned = pinnedIds.has(store.id);
    const isOwn = myStoreIds.has(store.id);
    const toggling = togglingPin === store.id;

    return (
      <div
        key={store.id}
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "0.5px solid #e2e8f0",
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
            style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 80, height: 80, borderRadius: 8, flexShrink: 0,
              background: store.isFleet ? "linear-gradient(135deg,#f59e0b,#fbbf24)" : "linear-gradient(135deg,#6366f1,#818cf8)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
            }}
          >
            {store.isFleet ? "🚛" : "🏪"}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                fontSize: 14, fontWeight: 600, color: A.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {store.name}
            </div>
            {store.isFleet && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 20,
                background: "#FEF3C7", color: "#B45309", textTransform: "uppercase",
                letterSpacing: "0.05em", flexShrink: 0, whiteSpace: "nowrap",
              }}>
                🚛 Fleet
              </span>
            )}
          </div>
          {store.description && (
            <div
              style={{
                fontSize: 12, color: A.textMuted, marginTop: 2,
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical", overflow: "hidden",
              }}
            >
              {store.description}
            </div>
          )}

          {/* Distance badge — shown only when filters are active */}
          {activeFilters !== null && (
            <div style={{ fontSize: 11, color: A.textMuted, marginTop: 4 }}>
              {store.distanceKm != null
                ? (t("app-discover-distance-km", "{km} km away") || "").replace(
                    "{km}",
                    store.distanceKm.toFixed(1)
                  )
                : t("app-discover-distance-unknown", "Distance unknown")}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {!isOwn && !store.isFleet && (
              <button
                onClick={() => togglePin(store.id)}
                disabled={toggling}
                style={{
                  padding: "5px 10px", borderRadius: 6,
                  fontSize: 11, fontWeight: 600,
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
              href={store.isFleet && store.pageId ? `/fleet/${store.pageId}` : `/store/${store.slug ?? store.id}`}
              style={{
                padding: "5px 10px", borderRadius: 6,
                fontSize: 11, fontWeight: 600,
                color: A.accent, textDecoration: "none",
                border: `1px solid ${A.accent}`,
                background: A.surface,
              }}
            >
              {store.isFleet ? "Book →" : t("app-saved-visit", "Visit →")}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh", fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 80 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", width: "100%", padding: "0 16px 16px" }}>
        <h1
          style={{ fontSize: 18, fontWeight: 500, color: "#111827", margin: 0, padding: "16px 0 16px" }}
        >
          {t("app-saved-heading", "Explore")}
        </h1>

        {/* ── Pinned Stores ── */}
        <section style={{ marginBottom: 28 }}>
          <h2
            style={{
              fontSize: 11, fontWeight: 500, color: "#64748B",
              margin: "0 0 8px", letterSpacing: "0.06em", textTransform: "uppercase",
            }}
          >
            {t("app-saved-pinned-heading", "Saved Stores")}
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
                      display: "flex", alignItems: "center", gap: 12,
                      background: "#fff", borderRadius: 12,
                      border: "0.5px solid #e2e8f0", overflow: "hidden",
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
              fontSize: 11, fontWeight: 500, color: "#64748B",
              margin: "0 0 8px", letterSpacing: "0.06em", textTransform: "uppercase",
            }}
          >
            {t("app-saved-wishlist-heading", "Saved Products")}
          </h2>

          {loadingWishlist ? (
            <WishlistSkeleton />
          ) : wishlist.length === 0 ? (
            <p style={{ fontSize: 13, color: A.textMuted }}>
              {t("app-saved-wishlist-empty", "No saved products yet.")}
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {wishlist.map((item) => {
                const removing = removingWishlist === item.blockId;
                const storeHandle = item.store.slug ?? item.store.id;
                return (
                  <div
                    key={item.blockId}
                    style={{ background: "#fff", borderRadius: 10, border: "0.5px solid #e2e8f0", overflow: "hidden" }}
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
                        {(() => {
                          const storeClosed = item.store.acceptingOrders === false;
                          return (
                            <button
                              onClick={storeClosed ? undefined : () => setQuickOrder({
                                blockId: item.block.id,
                                title: item.block.title,
                                price: item.block.price ?? 0,
                                quantity: 1,
                                imageUrl: item.block.mediaUrl,
                                storeId: item.store.id,
                                storeName: item.store.name,
                              })}
                              disabled={storeClosed}
                              title={storeClosed ? "Store is closed" : undefined}
                              style={storeClosed ? {
                                flex: 1, padding: "5px 0", borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: "not-allowed",
                                background: "#F3F4F6", border: "1px solid #E5E7EB", color: "#9CA3AF",
                              } : {
                                flex: 1, padding: "5px 0", borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: "pointer",
                                background: "#FFA41C", border: "1px solid #FF8F00", color: "#111",
                              }}
                            >
                              {storeClosed ? "Closed" : t("app-saved-buy-now", "Buy Now")}
                            </button>
                          );
                        })()}
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

        {/* ── Browse / Search ── */}
        <section>
          {/* Section heading */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h2
              style={{
                fontSize: 11, fontWeight: 500, color: "#64748B",
                margin: 0, letterSpacing: "0.06em", textTransform: "uppercase",
              }}
            >
              {t("app-saved-browse-heading", "Browse")}
            </h2>
            {activeFilters !== null && (
              <button
                onClick={() => { setActiveFilters(null); setProductResults([]); setProductSearched(false); }}
                style={{
                  fontSize: 11, fontWeight: 600, color: "#EF4444",
                  background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
                }}
              >
                Clear filters ✕
              </button>
            )}
          </div>

          {/* Stores / Products tab toggle */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <FilterPill active={browseTab === "stores"} onClick={() => setBrowseTab("stores")}>
              🏪 {t("app-search-stores-tab", "Stores")}
            </FilterPill>
            <FilterPill active={browseTab === "products"} onClick={() => setBrowseTab("products")}>
              🔎 {t("app-search-products-tab", "Products")}
            </FilterPill>
            <FilterPill active={browseTab === "services"} onClick={() => setBrowseTab("services")}>
              🔔 {t("app-search-services-tab", "Services")}
            </FilterPill>
            <FilterPill active={browseTab === "people"} onClick={() => setBrowseTab("people")}>
              👥 {t("app-search-people-tab", "People")}
            </FilterPill>
          </div>

          {browseTab === "people" ? (
            <div style={{ paddingTop: 4 }}>
              <UnifiedSearch
                placeholder="Search people or pages…"
                friendState={friendState}
                onSendFriend={sendFriend}
                onUnfriend={unfriend}
                onFollowPage={followPage}
                onActionComplete={handleFriendAction}
                className=""
              />
            </div>
          ) : browseTab === "services" ? (
            <RequestsPage />
          ) : browseTab === "stores" ? (
            <>
              {/* Filter + Map row */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button
                  onClick={() => setFilterOpen(true)}
                  style={{
                    flex: 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "12px 16px", borderRadius: 10,
                    border: `1px solid ${activeFilters !== null && filterCount > 0 ? A.accent : A.border}`,
                    background: activeFilters !== null && filterCount > 0 ? "#EEF2FF" : A.surface,
                    fontSize: 13, fontWeight: 500,
                    color: activeFilters !== null && filterCount > 0 ? A.accent : A.text,
                    cursor: "pointer", boxSizing: "border-box" as const,
                  }}
                >
                  🔍{" "}
                  {activeFilters !== null && filterCount > 0
                    ? (t("app-saved-filter-active", "{n} filters active") || "").replace("{n}", String(filterCount))
                    : t("app-saved-filter-button", "Filter stores")}
                </button>
                <Link
                  href="/app/discover"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "12px 14px", borderRadius: 10,
                    border: `1px solid ${A.border}`, background: A.surface,
                    fontSize: 13, fontWeight: 500, color: A.textMuted,
                    textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
                  }}
                >
                  🗺 Map
                </Link>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("app-saved-search-placeholder", "Search stores...")}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "12px 16px", borderRadius: 10,
                  border: `1px solid ${A.border}`, background: A.surface,
                  fontSize: 14, color: A.text, outline: "none", marginBottom: 14,
                }}
              />

              {isLoading ? (
                <BrowseSkeleton />
              ) : displayedStores.length === 0 ? (
                <p style={{ fontSize: 13, color: A.textMuted }}>
                  {search
                    ? `No stores match "${search}"`
                    : activeFilters !== null
                    ? "No stores match these filters."
                    : t("app-saved-no-stores", "No stores yet.")}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {displayedStores.map((store) => renderStoreCard(store))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Category filter chips (reuse activeFilters.categoryIds) */}
              {activeFilters !== null && filterCount > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <button
                    onClick={() => setFilterOpen(true)}
                    style={{
                      padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                      border: `1px solid ${A.accent}`, background: "#EEF2FF", color: A.accent, cursor: "pointer",
                    }}
                  >
                    {(t("app-saved-filter-active", "{n} filters active") || "").replace("{n}", String(filterCount))}
                  </button>
                  <button
                    onClick={() => { setActiveFilters(null); setProductResults([]); setProductSearched(false); }}
                    style={{
                      padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                      border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#EF4444", cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
              {/* Product search bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  window.clearTimeout(productDebounceRef.current);
                  searchProducts(productQuery);
                }}
                style={{ display: "flex", gap: 8, marginBottom: 14 }}
              >
                <input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder={t("app-search-products-placeholder", "Search products…")}
                  style={{
                    flex: 1, boxSizing: "border-box",
                    padding: "12px 16px", borderRadius: 10,
                    border: `1px solid ${A.border}`, background: A.surface,
                    fontSize: 14, color: A.text, outline: "none",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "12px 16px", borderRadius: 10, flexShrink: 0,
                    background: A.accent, border: "none", color: "#fff",
                    fontSize: 14, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  →
                </button>
              </form>
              {/* Also show a filter-by-category button for product search */}
              <button
                onClick={() => setFilterOpen(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "10px 14px", borderRadius: 10, marginBottom: 14,
                  border: `1px solid ${activeFilters !== null && filterCount > 0 ? A.accent : A.border}`,
                  background: activeFilters !== null && filterCount > 0 ? "#EEF2FF" : A.surface,
                  fontSize: 12, fontWeight: 500,
                  color: activeFilters !== null && filterCount > 0 ? A.accent : A.textMuted,
                  cursor: "pointer", width: "100%", boxSizing: "border-box" as const,
                  justifyContent: "center",
                }}
              >
                🗂{" "}
                {activeFilters !== null && filterCount > 0
                  ? (t("app-saved-filter-active", "{n} filters active") || "").replace("{n}", String(filterCount))
                  : t("app-search-filter-by-category", "Filter by category")}
              </button>

              {loadingProducts ? (
                <ProductsSkeleton />
              ) : !productSearched ? (
                <p style={{ fontSize: 13, color: A.textMuted }}>
                  {t("app-search-products-heading", "Search for any product across all stores.")}
                </p>
              ) : productResults.length === 0 ? (
                <p style={{ fontSize: 13, color: A.textMuted }}>
                  {t("app-search-products-no-results", "No products found. Try a different search.")}
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {productResults.map((p) => renderProductCard(p))}
                </div>
              )}
            </>
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

      <DiscoveryFilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={handleApply}
      />
    </div>
  );
}
