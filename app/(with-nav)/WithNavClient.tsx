// app/(with-nav)/WithNavClient.tsx
"use client";

import React, { useEffect, useState, Suspense, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import ResponsiveWorldNav from "@/components/ResponsiveWorldNav";
import HeaderTabs from "@/components/HeaderTabs";
import { LayerProvider } from "@/components/LayerContext";
import ProfileMenu from "@/components/ProfileMenu";
import UnifiedSearch from "@/components/UnifiedSearch";

export default function WithNavClient({
  profile: initialProfile,
  children,
}: {
  profile: any | null;
  children: React.ReactNode;
}) {
  return (
    <LayerProvider>
      <WithNavLayoutInner profile={initialProfile}>
        {children}
      </WithNavLayoutInner>
    </LayerProvider>
  );
}

function WithNavLayoutInner({
  profile,
  children,
}: {
  profile: any | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [showBottomNav, setShowBottomNav] = useState(true);
  const lastScrollY = useRef(0);

  const activeId = React.useMemo(() => {
    if (pathname.startsWith("/user") || pathname.startsWith("/self")) return "layer-self";
    if (pathname.startsWith("/society") || pathname.startsWith("/local")) return "layer-society-home";
    if (pathname.startsWith("/nation") || pathname.startsWith("/your_country")) return "layer-nation-birth";
    if (pathname.startsWith("/earth")) return "layer-earth";
    if (pathname.startsWith("/universe")) return "layer-universe";
    return "layer-self";
  }, [pathname]);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (window.innerWidth >= 768) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
            setShowBottomNav(false);
          } else if (currentScrollY < lastScrollY.current) {
            setShowBottomNav(true);
          }
          if (currentScrollY < 50) setShowBottomNav(true);
          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function navigateToLayerById(id: string | undefined | null) {
    const layerId = String(id ?? "").trim();
    switch (layerId) {
      case "layer-self": router.push("/self"); break;
      case "layer-society-home":
      case "layer-society-work": router.push("/society"); break;
      case "layer-nation-birth":
      case "layer-nation-work": router.push("/nation"); break;
      case "layer-earth": router.push("/earth"); break;
      case "layer-universe": router.push("/universe"); break;
      default: router.push("/self");
    }
  }

  function mapNavIdToLayerId(id: string | undefined | null): string {
    const raw = String(id ?? "").trim().toLowerCase();
    if (!raw) return "layer-self";
    if (raw.includes("you") || raw.includes("self")) return "layer-self";
    if (raw.includes("society") || raw.includes("state")) return "layer-society-home";
    if (raw.includes("nation") || raw.includes("country")) return "layer-nation-birth";
    if (raw.includes("earth") || raw.includes("world")) return "layer-earth";
    if (raw.includes("uni") || raw.includes("universe")) return "layer-universe";
    if (raw.startsWith("layer-")) return raw;
    return "layer-self";
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("Logout failed:", err);
    } finally {
      if (typeof window !== "undefined") {
        const keysToClear = ["app.language", "charaivati.lang", "language", "preferredLanguage"];
        keysToClear.forEach((k) => localStorage.removeItem(k));
        window.location.href = "/";
      }
    }
  }

  const initialFriendState = React.useMemo(() => ({
    friends:   Array.isArray(profile?.friends)   ? profile.friends   : [],
    outgoing:  Array.isArray(profile?.outgoing)  ? profile.outgoing  : [],
    incoming:  Array.isArray(profile?.incoming)  ? profile.incoming  : [],
    following: Array.isArray(profile?.following) ? profile.following : [],
  }), [profile]);

  const [friendState, setFriendState] = useState(initialFriendState);

  useEffect(() => {
    setFriendState(initialFriendState);
  }, [initialFriendState]);

  async function onFollowPage(pageId: string) {
    const res = await fetch("/api/user/follows", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId }),
    });
    if (!res.ok) throw new Error("Failed to follow");
    setFriendState((s) =>
      s.following.includes(pageId) ? s : { ...s, following: [...s.following, pageId] }
    );
  }

  async function onSendFriend(userId: string) {
    const res = await fetch("/api/user/friends", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: userId }),
    });
    if (!res.ok) throw new Error("Failed to add friend");
    setFriendState((s) =>
      s.outgoing.includes(userId) ? s : { ...s, outgoing: [...s.outgoing, userId] }
    );
  }

  function onActionComplete(
    kind: "page" | "person",
    id: string,
    status: "following" | "requested" | "friends"
  ) {
    if (kind === "page" && status === "following") {
      setFriendState((s) =>
        s.following.includes(id) ? s : { ...s, following: [...s.following, id] }
      );
    } else if (kind === "person") {
      if (status === "requested") {
        setFriendState((s) =>
          s.outgoing.includes(id) ? s : { ...s, outgoing: [...s.outgoing, id] }
        );
      } else if (status === "friends") {
        setFriendState((s) =>
          s.friends.includes(id) ? s : { ...s, friends: [...s.friends, id] }
        );
      }
    }
  }

  return (
    <>
      {/* ── MOBILE ─────────────────────────────────────────── */}
      <div className="md:hidden min-h-screen bg-black text-white pb-20">

        {/* Top bar */}
        <div className="nav-bar mobile-top-bar fixed top-0 left-0 right-0 z-50">
          <div className="flex items-center px-4 py-2 gap-3">
            {/* Logo mark */}
            <div className="flex-none">
              <span className="w-8 h-8 rounded-full flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M3 18s4-6 9-6 9 6 9 6" stroke="var(--accent)"
                    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="18" cy="6" r="2.4" fill="var(--accent)" />
                </svg>
              </span>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-0 flex justify-center">
              <UnifiedSearch
                placeholder="Search people or pages…"
                onFollowPage={onFollowPage}
                onSendFriend={onSendFriend}
                onActionComplete={onActionComplete}
                friendState={friendState}
                className="w-full max-w-lg"
              />
            </div>

            {/* Profile */}
            <div className="flex-none">
              <ProfileMenu profile={profile} onLogout={handleLogout} compact />
            </div>
          </div>

          {/* Tab strip */}
          <div className="tab-strip-wrapper px-3">
            <div className="flex justify-center">
              <div className="w-full max-w-3xl overflow-x-auto no-scrollbar">
                <Suspense fallback={<div className="h-10 flex items-center text-xs text-gray-500">Loading…</div>}>
                  <HeaderTabs onNavigate={navigateToLayerById} />
                </Suspense>
              </div>
            </div>
          </div>
        </div>

        <div className="h-[132px]" />

        <main className="px-4 py-5">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>

        {/* Bottom nav */}
        <div className={`bottom-nav-bar fixed bottom-0 left-0 right-0 z-40
          transition-transform duration-300 ease-out ${
          showBottomNav ? "translate-y-0" : "translate-y-full"}`}>
          <div className="px-2 py-2">
            <ResponsiveWorldNav
              activeId={activeId}
              onSelect={(id) => navigateToLayerById(mapNavIdToLayerId(id))}
              compact
            />
          </div>
        </div>
      </div>

      {/* ── DESKTOP ────────────────────────────────────────── */}
      <div className="hidden md:flex md:flex-col min-h-screen bg-black text-white">

        {/* Top bar row 1 — wordmark + search + profile */}
        <div className="nav-bar fixed top-0 left-0 right-0 z-50">
          <div className="flex items-center px-6 py-2.5 gap-4">
            <div className="flex-none">
              <h1 className="nav-wordmark">Charaivati</h1>
            </div>
            <div className="flex-1 min-w-0 flex justify-center">
              <UnifiedSearch
                placeholder="Search people or pages…"
                onFollowPage={onFollowPage}
                onSendFriend={onSendFriend}
                onActionComplete={onActionComplete}
                friendState={friendState}
                className="w-full max-w-xl"
              />
            </div>
            <div className="flex-none">
              <ProfileMenu profile={profile} onLogout={handleLogout} compact />
            </div>
          </div>
        </div>

        {/* Top bar row 2 — header tabs */}
        <div className="tab-strip-wrapper fixed top-[52px] left-0 right-0 z-40 bg-[#0d0d0d]/95 backdrop-blur-xl">
          <div className="flex justify-center px-6">
            <div className="w-full max-w-3xl">
              <Suspense fallback={<div className="h-10 flex items-center text-sm text-gray-500">Loading…</div>}>
                <HeaderTabs onNavigate={navigateToLayerById} />
              </Suspense>
            </div>
          </div>
        </div>

        <div className="h-[100px]" />

        <div className="flex flex-1">
          {/* Sidebar */}
          <aside className="fixed top-[100px] left-0 h-[calc(100vh-100px)] w-60
            flex flex-col overflow-y-auto">
            <div className="p-4 pt-5">
              <div className="sidebar-label mb-3">Navigate</div>
              <ResponsiveWorldNav
                activeId={activeId}
                onSelect={(id) => navigateToLayerById(mapNavIdToLayerId(id))}
                compact={false}
              />
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 ml-60">
            <div className="p-6 pt-5">
              <div className="max-w-6xl mx-auto">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}