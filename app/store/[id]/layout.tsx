"use client";

import { useEffect } from "react";
import { useParams, usePathname } from "next/navigation";
import { StoreShellProvider, useStoreShell } from "./StoreShellContext";
import Wordmark from "@/components/brand/Wordmark";
import AccountMenu from "@/components/nav/AccountMenu";

const NAV_BG = "#131921";
const BORDER = "#DDDDDD";
const ACCENT = "#6366f1";

async function handleStoreSignOut() {
  try { sessionStorage.removeItem("charaivati.redirect"); } catch {}
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  window.location.href = "/login";
}

function StoreNav() {
  const {
    storeName,
    userName,
    userId,
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

  const pathname = usePathname();

  return (
    <header className="w-full sticky top-0 z-50">
      <div className="w-full" style={{ background: NAV_BG }}>
        <div className="max-w-7xl mx-auto px-2 md:px-3 h-12 md:h-14 flex items-center gap-2 md:gap-3">

          {/* Logo */}
          <Wordmark size="sm" href="/app/home" />

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

            <AccountMenu
              user={userId ? { id: userId, name: userName } : null}
              isGuest={isGuest}
              pathname={pathname}
              onSignOut={handleStoreSignOut}
              storeContext={{ deliveryLabel, onOpenAddress, isOwner, storeId }}
            />
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-5 text-white text-xs pl-3">
            <AccountMenu
              user={userId ? { id: userId, name: userName } : null}
              isGuest={isGuest}
              pathname={pathname}
              onSignOut={handleStoreSignOut}
              storeContext={{ deliveryLabel, onOpenAddress, isOwner, storeId }}
            />

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

  const { setStoreId, setUserName, setUserId, setIsGuest, showNav } = useStoreShell();

  useEffect(() => {
    if (!id) return;

    setStoreId(id as string);

    fetch("/api/user/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        setUserName(d.user?.name ?? d.user?.email ?? null);
        setUserId(d.user?.id ?? null);
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