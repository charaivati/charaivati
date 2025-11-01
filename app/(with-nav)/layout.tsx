// app/layout.tsx
"use client";

import React, { useEffect, useState, Suspense, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import ResponsiveWorldNav from "@/components/ResponsiveWorldNav";
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

  // determine which layer is active
  const activeId = React.useMemo(() => {
    if (pathname.startsWith("/user") || pathname.startsWith("/self")) return "layer-self";
    if (pathname.startsWith("/society") || pathname.startsWith("/local")) return "layer-society-home";
    if (pathname.startsWith("/nation") || pathname.startsWith("/your_country")) return "layer-nation-birth";
    if (pathname.startsWith("/earth")) return "layer-earth";
    if (pathname.startsWith("/universe")) return "layer-universe";
    return "layer-self";
  }, [pathname]);

  // hide bottom nav when scrolling down (mobile)
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

  // nav routing helpers
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

  // -------------------------------------------------------
  // PROFILE FETCH
  // -------------------------------------------------------
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
          if (data?.ok) setProfile(data ?? null);
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

  // -------------------------------------------------------
  // FRIEND & FOLLOW STATE
  // -------------------------------------------------------
  const initialFriendState = React.useMemo(() => {
    return {
      friends: Array.isArray(profile?.friends) ? profile.friends : [],
      outgoing: Array.isArray(profile?.outgoing) ? profile.outgoing : [],
      incoming: Array.isArray(profile?.incoming) ? profile.incoming : [],
      following: Array.isArray(profile?.following) ? profile.following : [],
    };
  }, [profile]);

  const [friendState, setFriendState] = useState(initialFriendState);

  useEffect(() => {
    setFriendState(initialFriendState);
  }, [initialFriendState]);

  // -------------------------------------------------------
  // ACTION HANDLERS
  // -------------------------------------------------------
  async function onFollowPage(pageId: string) {
    const res = await fetch("/api/user/follows", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId }),
    });
    if (!res.ok) throw new Error("Failed to follow");
    setFriendState((s) => (s.following.includes(pageId) ? s : { ...s, following: [...s.following, pageId] }));
  }

  async function onSendFriend(userId: string) {
    const res = await fetch("/api/user/friends", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: userId }),
    });
    if (!res.ok) throw new Error("Failed to add friend");
    setFriendState((s) => (s.outgoing.includes(userId) ? s : { ...s, outgoing: [...s.outgoing, userId] }));
  }

  function onActionComplete(
    kind: "page" | "person",
    id: string,
    status: "following" | "requested" | "friends"
  ) {
    if (kind === "page" && status === "following") {
      setFriendState((s) => (s.following.includes(id) ? s : { ...s, following: [...s.following, id] }));
    } else if (kind === "person") {
      if (status === "requested") {
        setFriendState((s) => (s.outgoing.includes(id) ? s : { ...s, outgoing: [...s.outgoing, id] }));
      } else if (status === "friends") {
        setFriendState((s) => (s.friends.includes(id) ? s : { ...s, friends: [...s.friends, id] } ));
      }
    }
  }

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------
  return (
    <>
      {/* ------------------ MOBILE ------------------ */}
      <div className="md:hidden min-h-screen bg-black text-white pb-20">
        {/* fixed header: top row (logo | search | profile) and second row (tabs) */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-lg border-b border-white/10">
          {/* TOP ROW: logo left, search centered, profile right */}
          <div className="flex items-center px-4 py-2 gap-3">
            <div className="flex-none">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M3 18s4-6 9-6 9 6 9 6" stroke="#6CA8D9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="18" cy="6" r="2.2" fill="#6CA8D9"/>
                  </svg>
                </span>
              </div>
            </div>

            {/* center search — flex-1 and min-w-0 so it can shrink and stay centered */}
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

            <div className="flex-none">
              <ProfileMenu profile={profile?.profile} onLogout={handleLogout} compact />
            </div>
          </div>

          {/* SECOND ROW: page tabs centered and horizontally scrollable */}
          <div className="px-3 pb-3">
            <div className="flex justify-center">
              <div className="w-full max-w-3xl overflow-x-auto no-scrollbar">
                <Suspense fallback={<div className="h-10 flex items-center text-xs text-gray-400">Loading...</div>}>
                  <HeaderTabs onNavigate={navigateToLayerById} />
                </Suspense>
              </div>
            </div>
          </div>
        </div>

        {/* spacer: adjust height so content not hidden behind header (top row + tabs) */}
        <div className="h-[9.5rem]" />

        <main className="px-4 py-6">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>

        {/* bottom nav — keep global layer nav (different from page tabs) */}
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

      {/* ------------------ DESKTOP ------------------ */}
      <div className="hidden md:flex md:flex-col min-h-screen bg-black text-white">
        {/* fixed header: top row (logo | search | profile) and second row (tabs) */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-lg border-b border-white/10">
          {/* TOP ROW */}
          <div className="flex items-center px-6 py-3">
            <div className="flex-none">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                Charaivati
              </h1>
            </div>

            {/* center search — flex-1 and min-w-0 keeps it centered and prevents wrap */}
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
              <ProfileMenu profile={profile?.profile} onLogout={handleLogout} compact />
            </div>
          </div>

          {/* SECOND ROW: centered tabs */}
          <div className="flex justify-center px-6 pb-2">
            <div className="w-full max-w-3xl">
              <Suspense fallback={<div className="h-10 flex items-center text-sm text-gray-400">Loading...</div>}>
                <HeaderTabs onNavigate={navigateToLayerById} />
              </Suspense>
            </div>
          </div>
        </div>

        {/* spacer: top header total height (top row + tabs) */}
        <div className="h-20" />

        {/* left sidebar + content */}
        <div className="flex flex-1">
          <aside className="fixed top-[5rem] left-0 h-[calc(100vh-5rem)] w-64 bg-black border-r border-white/10 flex flex-col overflow-y-auto">
            <div className="p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Navigate</div>
              <ResponsiveWorldNav
                activeId={activeId}
                onSelect={(id) => navigateToLayerById(mapNavIdToLayerId(id))}
                compact={false}
              />
            </div>
          </aside>

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
