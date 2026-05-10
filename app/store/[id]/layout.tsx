"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { StoreShellProvider, useStoreShell } from "./StoreShellContext";

const NAV_BG = "#131921";
const BORDER = "#DDDDDD";
const ACCENT = "#6366f1";

function MobileProfileMenu() {
  const { isOwner, userName, onOpenAddress, deliveryLabel } = useStoreShell();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: 30, height: 30, borderRadius: "50%", background: ACCENT, color: "#fff", border: "none", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        {userName?.[0]?.toUpperCase() ?? "👤"}
      </button>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />}
      {open && (
        <div style={{ position: "absolute", right: 0, top: 36, zIndex: 50, background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}`, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", minWidth: 200, overflow: "hidden" }}>
          <button
            onClick={() => { onOpenAddress(); setOpen(false); }}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 13, border: "none", background: "#f9fafb", color: "#565959", cursor: "pointer", borderBottom: "1px solid #f0f0f0" }}
          >
            📍 {deliveryLabel}
          </button>
          <a href="/store/account" style={{ display: "block", padding: "10px 16px", fontSize: 13, color: "#0F1111", textDecoration: "none", borderBottom: "1px solid #f0f0f0" }}>
            👤 {userName ? `Hello, ${userName.split(" ")[0]}` : "Sign in"}
          </a>
          <a href="/store/account?tab=orders" style={{ display: "block", padding: "10px 16px", fontSize: 13, color: "#0F1111", textDecoration: "none", borderBottom: "1px solid #f0f0f0" }}>
            📦 My Orders
          </a>
          {isOwner && (
            <a href="/self?tab=earn" style={{ display: "block", padding: "10px 16px", fontSize: 13, color: "#0F1111", textDecoration: "none" }}>
              🏪 My Businesses
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function StoreNav() {
  const { storeName, userName, cartCount, searchQuery, setSearchQuery, onOpenCart, onOpenAddress, deliveryLabel } = useStoreShell();

  return (
    <header className="w-full sticky top-0 z-50">
      <div className="w-full" style={{ background: NAV_BG }}>
        <div className="max-w-7xl mx-auto px-2 md:px-3 h-12 md:h-14 flex items-center gap-2 md:gap-3">

          {/* Desktop: delivery address */}
          <button onClick={onOpenAddress} className="hidden md:flex flex-col text-white text-xs leading-tight pr-3 text-left hover:opacity-80">
            <span className="opacity-80">Deliver to</span>
            <span className="font-bold underline">{deliveryLabel}</span>
          </button>

          {/* Search — compact on mobile */}
          <div className="flex flex-1">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${storeName}`}
              className="flex-1 h-8 md:h-10 px-2 text-sm outline-none"
              style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, borderLeft: `1px solid ${BORDER}` }}
            />
            <button className="h-8 md:h-10 px-2 md:px-4 rounded-r-md" style={{ background: "#FEBD69", border: "1px solid #FEBD69" }}>
              🔍
            </button>
          </div>

          {/* Mobile: cart + profile */}
          <div className="flex md:hidden items-center gap-2 shrink-0">
            <button onClick={onOpenCart} className="relative text-white" style={{ lineHeight: 1 }}>
              <span className="text-xl">🛒</span>
              {cartCount > 0 && (
                <span style={{ position: "absolute", top: -4, right: -6, background: ACCENT, color: "#fff", borderRadius: "50%", width: 14, height: 14, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {cartCount}
                </span>
              )}
            </button>
            <MobileProfileMenu />
          </div>

          {/* Desktop: full nav links */}
          <div className="hidden md:flex items-center gap-5 text-white text-xs pl-3">
            <a href="/store/account" style={{ textDecoration: "none" }} className="leading-tight text-white text-xs hover:opacity-80">
              <div className="opacity-80">{userName ? `Hello, ${userName.split(" ")[0]}` : "Hello, Sign in"}</div>
              <div className="font-bold">My Account ▾</div>
            </a>
            <a href="/store/account?tab=orders" style={{ textDecoration: "none" }} className="leading-tight text-white text-xs hover:opacity-80">
              <div className="opacity-80">Returns &amp;</div>
              <div className="font-bold">Orders</div>
            </a>
            <button onClick={onOpenCart} className="flex items-center gap-1 relative text-white">
              <span className="text-lg">🛒</span>
              <span className="font-bold">Cart</span>
              {cartCount > 0 && (
                <span style={{ position: "absolute", top: -6, right: -8, background: ACCENT, color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {cartCount}
                </span>
              )}
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}

function StoreShellInner({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { setStoreId, setUserName, showNav } = useStoreShell();

  useEffect(() => {
    if (!id) return;
    setStoreId(id as string);
    fetch("/api/user/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUserName(d.user?.name ?? d.user?.email ?? null))
      .catch(() => {});
  }, [id]);

  return (
    <>
      {showNav && <StoreNav />}
      {children}
    </>
  );
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreShellProvider>
      <StoreShellInner>{children}</StoreShellInner>
    </StoreShellProvider>
  );
}
