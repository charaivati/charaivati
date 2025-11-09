//components/TopBar
"use client";

import React, { useEffect, useState } from "react";
import { useAuthRedirect } from "@/components/authRedirect";

export default function TopBar() {
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { goToAuth } = useAuthRedirect();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { credentials: "include" });
        if (!active) return;
        if (res.ok) {
          const j = await res.json();
          if (j?.ok) setProfile(j.profile);
        } else setProfile(null);
      } catch {
        setProfile(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("Logout failed:", err);
    } finally {
      // Clear profile immediately
      setProfile(null);

      // Clear any cached auth and language data
      const keysToClear = [
        "charaivati.redirect",
        "app.language",
        "charaivati.lang",
        "language",
        "preferredLanguage"
      ];
      keysToClear.forEach((k) => {
        try {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        } catch {}
      });

      // Always redirect to homepage (happens in finally so always runs)
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  }

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-black text-white">
      <div className="text-lg font-semibold">Charaivati</div>

      {profile ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={profile.avatarUrl || "/avatar-placeholder.png"}
            alt="avatar"
            className="w-8 h-8 rounded-full object-cover"
          />
          <span className="hidden sm:inline text-sm">{profile.name || profile.email}</span>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="ml-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => goToAuth("login")}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm"
          >
            Login
          </button>
          <button
            onClick={() => goToAuth("login")}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-sm"
          >
            Register
          </button>
        </div>
      )}
    </header>
  );
}