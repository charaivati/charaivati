"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { StoreShellProvider, useStoreShell } from "./StoreShellContext";

const NAV_BG = "#131921";
const BORDER = "#DDDDDD";
const ACCENT = "#6366f1";

function MobileProfileMenu() {
  const { isOwner, storeId, userName, onOpenAddress, deliveryLabel, isGuest } = useStoreShell();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [businessMenuOpen, setBusinessMenuOpen] = useState(false);

  async function handleSignOut() {
    try { sessionStorage.removeItem("charaivati.redirect"); } catch {}
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    window.location.href = "/login";
  }

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: ACCENT,
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {userName?.[0]?.toUpperCase() ?? "👤"}
      </button>

      {open && (
        <div
          onClick={() => {
            setOpen(false);
            setBusinessMenuOpen(false);
          }}
          style={{ position: "fixed", inset: 0, zIndex: 40 }}
        />
      )}

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 36,
            zIndex: 50,
            background: "#fff",
            borderRadius: 10,
            border: `1px solid ${BORDER}`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            minWidth: 200,
            overflow: "visible",
          }}
        >
          <button
            onClick={() => {
              onOpenAddress();
              setOpen(false);
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 16px",
              fontSize: 13,
              border: "none",
              background: "#f9fafb",
              color: "#565959",
              cursor: "pointer",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            📍 {deliveryLabel}
          </button>

          {isGuest ? (
            <a
              href={`/login?redirect=${encodeURIComponent(pathname ?? "/")}`}
              style={{
                display: "block",
                padding: "10px 16px",
                fontSize: 13,
                color: "#6366f1",
                textDecoration: "none",
                borderBottom: "1px solid #f0f0f0",
                fontWeight: 600,
              }}
            >
              🔑 Sign in / Sign up
            </a>
          ) : (
            <a
              href="/store/account"
              style={{
                display: "block",
                padding: "10px 16px",
                fontSize: 13,
                color: "#0F1111",
                textDecoration: "none",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              👤 {userName ? `Hello, ${userName.split(" ")[0]}` : "Sign in"}
            </a>
          )}

          <a
            href="/store/account?tab=purchases"
            style={{
              display: "block",
              padding: "10px 16px",
              fontSize: 13,
              color: "#0F1111",
              textDecoration: "none",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            📦 My Orders
          </a>

          {isOwner && storeId && (
            <a
              href={`/store/${storeId}/orders`}
              style={{
                display: "block",
                padding: "10px 16px",
                fontSize: 13,
                color: "#6366f1",
                textDecoration: "none",
                fontWeight: 600,
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              📋 Manage Orders →
            </a>
          )}

          {isOwner && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setBusinessMenuOpen((v) => !v)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 16px",
                  fontSize: 13,
                  color: "#0F1111",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderBottom: businessMenuOpen
                    ? "1px solid #f0f0f0"
                    : "none",
                }}
              >
                🏪 My Businesses
              </button>

              {businessMenuOpen && (
                <div
                  style={{
                    background: "#fff",
                  }}
                >
                  <a
                    href="/self?tab=earn"
                    onClick={() => {
                      setBusinessMenuOpen(false);
                      setOpen(false);
                    }}
                    style={{
                      display: "block",
                      padding: "10px 16px 10px 36px",
                      fontSize: 13,
                      color: "#0F1111",
                      textDecoration: "none",
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    Open website
                  </a>

                  <a
                    href="/app/initiatives"
                    onClick={() => {
                      setBusinessMenuOpen(false);
                      setOpen(false);
                    }}
                    style={{
                      display: "block",
                      padding: "10px 16px 10px 36px",
                      fontSize: 13,
                      color: "#0F1111",
                      textDecoration: "none",
                    }}
                  >
                    Open app
                  </a>
                </div>
              )}
            </div>
          )}

          {!isGuest && (
            <button
              onClick={handleSignOut}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 16px",
                fontSize: 13,
                color: "#EF4444",
                background: "none",
                border: "none",
                borderTop: "1px solid #f0f0f0",
                cursor: "pointer",
              }}
            >
              🚪 Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StoreNav() {
  const {
    storeName,
    userName,
    isGuest,
    isOwner,
    storeId,
    cartCount,
    searchQuery,
    setSearchQuery,
    onOpenCart,
    onOpenAddress,
    deliveryLabel,
  } = useStoreShell();

  const [brandMenuOpen, setBrandMenuOpen] = useState(false);

  return (
    <header className="w-full sticky top-0 z-50">
      <div className="w-full" style={{ background: NAV_BG }}>
        <div className="max-w-7xl mx-auto px-2 md:px-3 h-12 md:h-14 flex items-center gap-2 md:gap-3">

          {/* Logo */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setBrandMenuOpen((v) => !v)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "#fff",
                fontFamily: "monospace",
                fontSize: 13,
                letterSpacing: "0.1em",
              }}
            >
              charaivati
            </button>

            {brandMenuOpen && (
              <>
                <div
                  onClick={() => setBrandMenuOpen(false)}
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 40,
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    top: 30,
                    left: 0,
                    zIndex: 50,
                    background: "#fff",
                    borderRadius: 10,
                    border: `1px solid ${BORDER}`,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    minWidth: 180,
                    overflow: "hidden",
                  }}
                >
                  <Link
                    href="/self/tabs/EarningTab"
                    onClick={() => setBrandMenuOpen(false)}
                    style={{
                      display: "block",
                      padding: "10px 16px",
                      fontSize: 13,
                      color: "#0F1111",
                      textDecoration: "none",
                    }}
                  >
                    Open in browser
                  </Link>

                  <Link
                    href="/app/home"
                    onClick={() => setBrandMenuOpen(false)}
                    style={{
                      display: "block",
                      padding: "10px 16px",
                      fontSize: 13,
                      color: "#0F1111",
                      textDecoration: "none",
                      borderTop: "1px solid #f0f0f0",
                    }}
                  >
                    Open in app
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Desktop: delivery address */}
          <button
            onClick={onOpenAddress}
            className="hidden md:flex flex-col text-white text-xs leading-tight pr-3 text-left hover:opacity-80"
          >
            <span className="opacity-80">Deliver to</span>
            <span className="font-bold underline">{deliveryLabel}</span>
          </button>

          {/* Search */}
          <div className="flex flex-1 min-w-0">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${storeName}`}
              className="flex-1 min-w-0 w-[90px] md:w-auto h-8 md:h-10 px-2 text-sm outline-none"
              style={{
                borderTop: `1px solid ${BORDER}`,
                borderBottom: `1px solid ${BORDER}`,
                borderLeft: `1px solid ${BORDER}`,
              }}
            />

            <button
              className="h-8 md:h-10 px-2 md:px-4 rounded-r-md"
              style={{
                background: "#FEBD69",
                border: "1px solid #FEBD69",
              }}
            >
              🔍
            </button>
          </div>

          {/* Mobile: cart + profile */}
          <div className="flex md:hidden items-center gap-2 shrink-0">
            <button
              onClick={onOpenCart}
              className="relative text-white"
              style={{ lineHeight: 1 }}
            >
              <span className="text-xl">🛒</span>

              {cartCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -6,
                    background: ACCENT,
                    color: "#fff",
                    borderRadius: "50%",
                    width: 14,
                    height: 14,
                    fontSize: 9,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {cartCount}
                </span>
              )}
            </button>

            <MobileProfileMenu />
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-5 text-white text-xs pl-3">
            <a
              href={isGuest ? "/login" : "/store/account"}
              style={{ textDecoration: "none" }}
              className="leading-tight text-white text-xs hover:opacity-80"
            >
              <div className="opacity-80">
                {isGuest
                  ? "Hello, Guest"
                  : userName
                  ? `Hello, ${userName.split(" ")[0]}`
                  : "Hello, Sign in"}
              </div>

              <div className="font-bold">
                {isGuest ? "Sign in ▾" : "My Account ▾"}
              </div>
            </a>

            <a
              href="/store/account?tab=purchases"
              style={{ textDecoration: "none" }}
              className="leading-tight text-white text-xs hover:opacity-80"
            >
              <div className="opacity-80">Returns &amp;</div>
              <div className="font-bold">Orders</div>
            </a>

            {isOwner && storeId && (
              <a
                href={`/store/${storeId}/orders`}
                style={{ textDecoration: "none" }}
                className="leading-tight text-white text-xs hover:opacity-80"
              >
                <div className="opacity-80">Owner</div>
                <div className="font-bold">Manage Orders →</div>
              </a>
            )}

            <button
              onClick={onOpenCart}
              className="flex items-center gap-1 relative text-white"
            >
              <span className="text-lg">🛒</span>
              <span className="font-bold">Cart</span>

              {cartCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -8,
                    background: ACCENT,
                    color: "#fff",
                    borderRadius: "50%",
                    width: 16,
                    height: 16,
                    fontSize: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
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
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const { setStoreId, setUserName, setIsGuest, showNav } = useStoreShell();

  useEffect(() => {
    if (!id) return;

    setStoreId(id as string);

    fetch("/api/user/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        setUserName(d.user?.name ?? d.user?.email ?? null);
        setIsGuest(d.user?.status === "guest");
      })
      .catch(() => {});
  }, [id]);

  return (
    <>
      {showNav && <StoreNav />}
      {children}
    </>
  );
}

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StoreShellProvider>
      <StoreShellInner>{children}</StoreShellInner>
    </StoreShellProvider>
  );
}