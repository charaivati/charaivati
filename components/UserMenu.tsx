"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User as UserIcon, LogOut, Settings } from "lucide-react";
import { useLanguage } from "./LanguageProvider"; // adjust if path differs

export default function UserMenu({ user: initialUser }: { user?: any }) {
  const router = useRouter();

  // ---- Language Provider (Safe Access) ----
  let provider: any = null;
  try {
    provider = useLanguage();
  } catch {
    provider = null;
  }

  const providerLocale: string | undefined = provider?.locale ?? undefined;
  const providerMeta: any = provider?.languageMeta ?? undefined;
  const providerSetLanguage: ((c: string, n?: string) => Promise<void>) | undefined = provider?.setLanguage;

  // ---- State ----
  const [user, setUser] = useState<any | null>(initialUser ?? null);
  const [loadingUser, setLoadingUser] = useState(!initialUser);
  const [languages, setLanguages] = useState<{ code: string; name: string }[] | null>(null);
  const [loadingLangs, setLoadingLangs] = useState(true);

  const [langOpen, setLangOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [locale, setLocale] = useState<string | undefined>(providerLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // ---- Load languages ----
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/languages");
        const json = await res.json().catch(() => null);
        if (!alive) return;

        const raw = Array.isArray(json?.data) ? json.data : [];
        const filtered = raw
          .filter((r: any) => r && typeof r.code === "string" && r.code.trim() && typeof r.name === "string" && r.name.trim())
          .map((r: any) => ({ code: r.code.trim(), name: r.name.trim() }));
        setLanguages(filtered);
      } catch (e) {
        console.warn("UserMenu: failed to load languages", e);
        setLanguages([]);
      } finally {
        if (alive) setLoadingLangs(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ---- Load user if not provided ----
  useEffect(() => {
    if (user) return;
    let alive = true;
    (async () => {
      setLoadingUser(true);
      try {
        const res = await fetch("/api/user/profile", { credentials: "include" });
        const json = await res.json().catch(() => null);
        if (!alive) return;

        if (res.ok && json?.ok && json.profile) setUser(json.profile);
        else setUser(null);
      } catch (err) {
        console.warn("UserMenu: fetch profile failed", err);
        if (alive) setUser(null);
      } finally {
        if (alive) setLoadingUser(false);
      }
    })();
    return () => { alive = false; };
  }, [initialUser, user]);

  // ---- Keep locale in sync with provider ----
  useEffect(() => {
    if (providerLocale && providerLocale !== locale) setLocale(providerLocale);
  }, [providerLocale]);

  // ---- Outside click / ESC to close ----
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      setLangOpen(false);
      setProfileOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLangOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // ---- Local fallback for locale ----
  function readLocaleFromCookieOrStorage(): string | null {
    try {
      const cookie = document.cookie || "";
      const match = cookie.split(";").map(s => s.trim()).find(s => s.startsWith("charaivati.locale="));
      if (match) return decodeURIComponent(match.split("=")[1] || "");
    } catch {}
    try {
      const saved = localStorage.getItem("charaivati.locale");
      if (saved) return saved;
    } catch {}
    try {
      return navigator.language?.split("-")[0] ?? null;
    } catch {}
    return null;
  }

  const effectiveLocale = locale ?? providerMeta?.code ?? readLocaleFromCookieOrStorage() ?? undefined;

  // ---- Safe label ----
  const safeLanguageLabel = (() => {
    if (Array.isArray(languages) && effectiveLocale) {
      const found = languages.find((l) => l.code === effectiveLocale);
      if (found?.name) return found.name;
    }
    if (providerMeta?.name) return providerMeta.name;
    if (providerMeta?.code) return providerMeta.code;
    if (effectiveLocale) return effectiveLocale;
    return loadingLangs ? "…" : "Language";
  })();

  const userLabel = user?.name ?? user?.email ?? "You";
  const renderedLabel = mounted ? (safeLanguageLabel ?? "Language") : "…";

  // ---- Language Switch ----
  async function switchLanguage(code: string) {
    if (code === effectiveLocale) {
      setLangOpen(false);
      return;
    }
    try {
      if (providerSetLanguage) {
        await providerSetLanguage(code);
        setLocale(code);
        setLangOpen(false);
        return;
      }
    } catch (e) {
      console.warn("provider.setLanguage failed", e);
    }

    try { localStorage.setItem("charaivati.locale", code); } catch {}
    try {
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `charaivati.locale=${encodeURIComponent(code)}; path=/; expires=${expires}; SameSite=Lax`;
    } catch (e) {
      console.warn("failed to set cookie", e);
    }
    setLocale(code);
    window.location.reload();
  }

  // ---- Logout ----
  async function logout() {
    setProfileOpen(false);
    try {
      const endpoints = ["/api/auth/logout", "/api/user/logout", "/api/logout"];
      for (const url of endpoints) {
        try {
          const res = await fetch(url, { method: "POST", credentials: "include" });
          if (res.ok) {
            window.location.href = "/login";
            return;
          }
        } catch {}
      }
      document.cookie = `session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
      document.cookie = `__Host-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
      window.location.href = "/login";
    } catch (e) {
      console.warn("logout failed", e);
      window.location.href = "/login";
    }
  }

  // ---- Render ----
  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center gap-3">
        {/* LANGUAGE BUTTON */}
        <button
          onClick={() => {
            setLangOpen((s) => !s);
            setProfileOpen(false);
          }}
          className="px-3 py-1 rounded bg-white/10 text-sm text-white hover:bg-white/20"
          title={`Language: ${renderedLabel}`}
          aria-haspopup="true"
          aria-expanded={langOpen}
        >
          {renderedLabel}
        </button>

        {/* PROFILE BUTTON */}
        <button
          onClick={() => {
            setProfileOpen((s) => !s);
            setLangOpen(false);
          }}
          className="ml-2 inline-flex items-center gap-2 px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white"
          aria-haspopup="true"
          aria-expanded={profileOpen}
          title={userLabel}
        >
          <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs">
            {loadingUser ? (
              <span className="inline-block w-3 h-3 rounded-full bg-white/30 animate-pulse" />
            ) : (
              user?.name?.[0]?.toUpperCase() ?? <UserIcon size={12} />
            )}
          </span>
          <span className="hidden sm:inline">{userLabel}</span>
        </button>
      </div>

      {/* LANGUAGE MENU */}
      {langOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-gray-900 rounded-xl shadow-lg border border-white/10 z-50 overflow-hidden">
          <div className="p-2">
            <div className="px-3 py-2 text-sm text-gray-300">Languages</div>
            <div className="max-h-44 overflow-y-auto">
              {loadingLangs && <div className="px-3 py-2 text-sm">Loading…</div>}
              {!loadingLangs && (!languages || languages.length === 0) && (
                <div className="px-3 py-2 text-sm text-gray-400">No languages</div>
              )}
              {!loadingLangs &&
                languages &&
                languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => switchLanguage(l.code)}
                    className={`w-full text-left px-3 py-2 rounded hover:bg-white/5 ${
                      l.code === effectiveLocale ? "bg-white/10" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{l.name}</span>
                      <span className="text-xs text-gray-400">{l.code}</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* PROFILE MENU */}
      {profileOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-gray-900 rounded-xl shadow-lg border border-white/10 z-50 overflow-hidden">
          <div className="p-2">
            <button
              onClick={() => {
                setProfileOpen(false);
                router.push("/user");
              }}
              className="w-full text-left px-3 py-2 rounded hover:bg-white/5 flex items-center gap-2"
            >
              <Settings size={14} />
              <span>Profile</span>
            </button>

            <div className="my-1 border-t border-white/10" />

            <button
              onClick={logout}
              className="w-full text-left px-3 py-2 rounded hover:bg-white/5 text-red-300 flex items-center gap-2"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
