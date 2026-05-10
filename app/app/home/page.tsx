"use client";

import { useEffect, useState } from "react";

const A = {
  bg: "#F3F4F6",
  nav: "#131921",
  border: "#E5E7EB",
  text: "#111827",
  textMuted: "#6B7280",
  accent: "#6366f1",
  surface: "#FFFFFF",
};

// ─── Types ────────────────────────────────────────────────────────
type User = { id: string; name: string | null; email: string; avatarUrl?: string | null };
type MyStore = { id: string; name: string };
type PinnedItem = { storeId: string; storeName: string; description?: string | null; previewImage?: string | null };
type WishlistItem = {
  blockId: string;
  block: { id: string; title: string; price: number | null; mediaUrl: string | null; mediaType: string };
};

// ─── Scroll row (hides scrollbar cross-browser) ──────────────────
const scrollRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  overflowX: "auto",
  paddingBottom: 8,
  scrollbarWidth: "none",
  msOverflowStyle: "none",
};

// ─── Page ─────────────────────────────────────────────────────────
export default function AppHomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [myStores, setMyStores] = useState<MyStore[]>([]);
  const [pinned, setPinned] = useState<PinnedItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);

  // Fetch user first
  useEffect(() => {
    fetch("/api/user/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user ?? null))
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, []);

  // Fetch store data once user is known
  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/store/my-stores", { credentials: "include" }).then((r) => r.ok ? r.json() : { stores: [] }),
      fetch("/api/store/pinned", { credentials: "include" }).then((r) => r.ok ? r.json() : { pinned: [] }),
      fetch("/api/store/wishlist", { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    ]).then(([storesData, pinnedData, wishlistData]) => {
      setMyStores(storesData.stores ?? []);
      setPinned(pinnedData.pinned ?? []);
      setWishlist(Array.isArray(wishlistData) ? wishlistData : []);
    }).catch(() => {});
  }, [user]);

  async function handleSignOut() {
    await fetch("/api/user/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  const initial = (user?.name ?? user?.email ?? "?")[0]?.toUpperCase() ?? "?";

  return (
    <div style={{ background: A.bg, minHeight: "100vh" }}>

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header style={{
        background: A.nav, height: 56, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 16px",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <span style={{ color: "#fff", fontFamily: "monospace", fontSize: 13, letterSpacing: "0.1em" }}>
          charaivati
        </span>

        <div style={{ position: "relative" }}>
          {!loadingUser && (
            user ? (
              <>
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  style={{
                    width: 34, height: 34, borderRadius: "50%", background: A.accent,
                    border: "none", cursor: "pointer", color: "#fff", fontWeight: 700,
                    fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  {initial}
                </button>
                {profileOpen && (
                  <>
                    <div onClick={() => setProfileOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                    <div style={{
                      position: "absolute", right: 0, top: 42, zIndex: 50, background: A.surface,
                      borderRadius: 10, border: `1px solid ${A.border}`,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 200, overflow: "hidden",
                    }}>
                      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${A.border}` }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: A.text }}>{user.name ?? "Account"}</div>
                        <div style={{ fontSize: 11, color: A.textMuted, marginTop: 2 }}>{user.email}</div>
                      </div>
                      <a href="/store/account"
                        style={{ display: "block", padding: "10px 16px", fontSize: 13, color: A.text, textDecoration: "none" }}>
                        My Account
                      </a>
                      <button onClick={handleSignOut}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "10px 16px", fontSize: 13, color: "#EF4444",
                          background: "none", border: "none", cursor: "pointer",
                        }}>
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <a href="/login?redirect=/app/home"
                style={{
                  fontSize: 13, fontWeight: 600, color: "#fff", textDecoration: "none",
                  padding: "6px 14px", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6,
                }}>
                Sign in
              </a>
            )
          )}
        </div>
      </header>

      {/* ── Page body ───────────────────────────────────────────── */}
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

        {/* ── Owner section: Your Initiatives ─────────────────── */}
        {user && myStores.length > 0 && (
          <section style={{ padding: "20px 16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: A.text, margin: 0 }}>Your Initiatives</h2>
              <a href="/self?tab=earn" style={{ fontSize: 12, color: A.accent, textDecoration: "none" }}>
                Manage →
              </a>
            </div>

            <div style={scrollRowStyle}>
              {myStores.map((store) => (
                <div key={store.id} style={{
                  minWidth: 160, width: 160, height: 120, background: A.surface,
                  borderRadius: 12, border: `1px solid ${A.border}`,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "14px 12px",
                  flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "space-between",
                }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: A.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {store.name}
                  </div>
                  <div>
                    <a href={`/store/${store.id}`}
                      style={{ display: "block", fontSize: 11, color: A.accent, textDecoration: "none", marginBottom: 4 }}>
                      View Store →
                    </a>
                    <a href={`/store/${store.id}/orders`}
                      style={{ display: "block", fontSize: 11, color: A.textMuted, textDecoration: "none" }}>
                      Orders
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <a href="/self?tab=earn" style={{
              display: "block", marginTop: 10, padding: "10px 16px",
              background: A.surface, border: `1px dashed ${A.border}`,
              borderRadius: 10, textAlign: "center",
              fontSize: 13, fontWeight: 600, color: A.accent, textDecoration: "none",
            }}>
              + Create Initiative
            </a>
          </section>
        )}

        {/* ── Buyer section ────────────────────────────────────── */}
        <section style={{ padding: "24px 16px 0" }}>

          {/* Pinned stores */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: A.text, margin: "0 0 12px" }}>
              📌 Saved Stores
            </h2>
            {!user ? (
              <p style={{ fontSize: 13, color: A.textMuted, margin: 0 }}>
                <a href="/login?redirect=/app/home" style={{ color: A.accent }}>Sign in</a> to save stores
              </p>
            ) : pinned.length === 0 ? (
              <p style={{ fontSize: 13, color: A.textMuted, margin: 0 }}>
                No saved stores yet — browse and pin stores you like
              </p>
            ) : (
              <div style={scrollRowStyle}>
                {pinned.map((p) => (
                  <a key={p.storeId} href={`/store/${p.storeId}`} style={{
                    minWidth: 140, width: 140, background: A.surface,
                    borderRadius: 12, border: `1px solid ${A.border}`,
                    overflow: "hidden", textDecoration: "none", flexShrink: 0, display: "block",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}>
                    {p.previewImage ? (
                      <img src={p.previewImage} alt={p.storeName}
                        style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{
                        width: "100%", height: 80,
                        background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
                      }} />
                    )}
                    <div style={{
                      padding: "8px 10px", fontSize: 12, fontWeight: 600, color: A.text,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {p.storeName}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Wishlist */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: A.text, margin: "0 0 12px" }}>
              ❤️ Saved Products
            </h2>
            {!user ? (
              <p style={{ fontSize: 13, color: A.textMuted, margin: 0 }}>
                <a href="/login?redirect=/app/home" style={{ color: A.accent }}>Sign in</a> to save products
              </p>
            ) : wishlist.length === 0 ? (
              <p style={{ fontSize: 13, color: A.textMuted, margin: 0 }}>No saved products yet</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {wishlist.map((item) => (
                  <div key={item.blockId} style={{
                    background: A.surface, borderRadius: 10,
                    border: `1px solid ${A.border}`, overflow: "hidden",
                  }}>
                    {item.block.mediaUrl ? (
                      <img src={item.block.mediaUrl} alt={item.block.title}
                        style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }} />
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
                      <div style={{ fontSize: 11, color: A.textMuted, margin: "4px 0 6px" }}>
                        {item.block.price != null
                          ? `₹${item.block.price.toLocaleString("en-IN")}`
                          : "Free"}
                      </div>
                      <button style={{
                        width: "100%", padding: "6px 0", background: A.accent,
                        color: "#fff", border: "none", borderRadius: 6,
                        fontSize: 11, fontWeight: 600, cursor: "pointer",
                      }}>
                        Add to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Browse all ──────────────────────────────────────── */}
        <div style={{ padding: "4px 16px 40px", textAlign: "center" }}>
          <a href="/" style={{ fontSize: 13, color: A.accent, textDecoration: "none" }}>
            Browse all stores →
          </a>
        </div>

      </div>
    </div>
  );
}
