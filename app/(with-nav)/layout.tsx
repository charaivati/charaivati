"use client";

import React, { useEffect, useState, Suspense, useRef } from "react";
import ResponsiveWorldNav from "@/components/ResponsiveWorldNav";
import { usePathname, useRouter } from "next/navigation";
import HeaderTabs from "@/components/HeaderTabs";
import { LayerProvider } from "@/components/LayerContext";
import ProfileMenu from "@/components/ProfileMenu";
import UnifiedSearch from "@/components/UnifiedSearch";

export default function WithNavLayout({ children }: { children: React.ReactNode }) {
  return (
    <LayerProvider>
      <WithNavLayoutInner>{children}</WithNavLayoutInner>
    </LayerProvider>
  );
}

function WithNavLayoutInner({ children }: { children: React.ReactNode }) {
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

  // Hide/show bottom nav on scroll (mobile)
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (window.innerWidth >= 768) return; // skip desktop

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

  // Navigation helper
  function navigateToLayerById(id: string | undefined | null) {
    const layerId = String(id ?? "").trim();
    switch (layerId) {
      case "layer-self":
        router.push("/self");
        break;
      case "layer-society-home":
      case "layer-society-work":
        router.push("/society");
        break;
      case "layer-nation-birth":
      case "layer-nation-work":
        router.push("/nation");
        break;
      case "layer-earth":
        router.push("/earth");
        break;
      case "layer-universe":
        router.push("/universe");
        break;
      default:
        router.push("/self");
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

  // --- PROFILE FETCH ---
  const [profile, setProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { credentials: "include" });
        if (!alive) return;
        if (!res.ok) {
          setProfile(null);
        } else {
          const data = await res.json().catch(() => null);
          if (data?.ok) setProfile(data.profile ?? null);
        }
      } catch (err) {
        console.warn("[WithNavLayout] failed to load profile:", err);
        setProfile(null);
      } finally {
        if (alive) setProfileLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // --- LOGOUT ---
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

  // --- FRIEND & FOLLOW STATE ---
  const initialFriendState = React.useMemo(() => {
    const friends = Array.isArray(profile?.friends) ? profile.friends : [];
    const outgoing = Array.isArray(profile?.outgoingFriendRequests)
      ? profile.outgoingFriendRequests
      : Array.isArray(profile?.outgoing)
      ? profile.outgoing
      : [];
    const incoming = Array.isArray(profile?.incomingFriendRequests)
      ? profile.incomingFriendRequests
      : Array.isArray(profile?.incoming)
      ? profile.incoming
      : [];
    const following = Array.isArray(profile?.followingPages)
      ? profile.followingPages
      : Array.isArray(profile?.follows)
      ? profile.follows
      : [];
    return { friends, outgoing, incoming, following };
  }, [profile]);

  const [friendState, setFriendState] = useState(initialFriendState);

  useEffect(() => {
    setFriendState(initialFriendState);
  }, [initialFriendState]);

  // --- ACTIONS ---
  async function onFollowPage(pageId: string) {
    const res = await fetch("/api/user/follows", {
      method: "POST",
      credentials: "include",
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
      method: "POST",
      credentials: "include",
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

  // ==============================================================
  //                       RENDER
  // ==============================================================

  return (
    <>
      {/* ================= MOBILE ================= */}
      <div className="md:hidden min-h-screen bg-black text-white pb-20">
        {/* Fixed Top Nav */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-lg border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-3 gap-3">
            {/* Center Tabs */}
            <div className="flex-1 flex justify-center overflow-x-auto no-scrollbar">
              <Suspense
                fallback={
                  <div className="h-10 flex items-center">
                    <div className="text-xs text-gray-400">Loading...</div>
                  </div>
                }
              >
                <HeaderTabs onNavigate={navigateToLayerById} />
              </Suspense>
            </div>

            {/* Profile */}
            <div className="flex-shrink-0">
              <ProfileMenu profile={profile} onLogout={handleLogout} compact />
            </div>
          </div>
        </div>

        <div className="h-16" />

        {/* Search (mobile) */}
        <div className="px-4 mb-3">
          <div className="max-w-6xl mx-auto">
            <UnifiedSearch
              placeholder="Search people or pages…"
              onFollowPage={onFollowPage}
              onSendFriend={onSendFriend}
              onActionComplete={onActionComplete}
              friendState={friendState}
            />
          </div>
        </div>

        {/* Main Content */}
        <main className="px-4 py-6">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>

        {/* Bottom Navigation */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-lg border-t border-white/10 transition-transform duration-300 ${
            showBottomNav ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="px-4 py-3">
            <ResponsiveWorldNav
              activeId={activeId}
              onSelect={(id) => navigateToLayerById(mapNavIdToLayerId(id))}
              compact
            />
          </div>
        </div>
      </div>

      {/* ================= DESKTOP ================= */}
      <div className="hidden md:flex md:flex-col min-h-screen bg-black text-white">
        {/* Fixed Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-lg border-b border-white/10">
          <div className="flex items-center justify-between px-6 py-3 gap-4">
            {/* Logo */}
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                Charaivati
              </h1>
            </div>

            {/* Tabs */}
            <div className="flex-1 flex justify-center">
              <Suspense
                fallback={
                  <div className="h-10 flex items-center">
                    <div className="text-sm text-gray-400">Loading...</div>
                  </div>
                }
              >
                <HeaderTabs onNavigate={navigateToLayerById} />
              </Suspense>
            </div>

            {/* Profile */}
            <div className="flex-shrink-0">
              <ProfileMenu profile={profile} onLogout={handleLogout} compact />
            </div>
          </div>
        </div>

        {/* Spacer for Header */}
        <div className="h-16" />

        {/* Global Search */}
        <div className="px-6 py-4 border-b border-white/5">
          <div className="max-w-6xl mx-auto">
            <UnifiedSearch
              placeholder="Search people or pages…"
              onFollowPage={onFollowPage}
              onSendFriend={onSendFriend}
              onActionComplete={onActionComplete}
              friendState={friendState}
            />
          </div>
        </div>

        {/* Sidebar + Main */}
        <div className="flex flex-1">
          {/* Left Sidebar */}
          <aside className="fixed top-[calc(4rem+64px)] left-0 h-[calc(100vh-4rem-64px)] w-64 bg-black border-r border-white/10 flex flex-col overflow-y-auto">
            <div className="p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Navigate
              </div>
              <ResponsiveWorldNav
                activeId={activeId}
                onSelect={(id) => navigateToLayerById(mapNavIdToLayerId(id))}
                compact={false}
              />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 ml-64">
            <div className="p-6">
              <div className="max-w-6xl mx-auto">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
