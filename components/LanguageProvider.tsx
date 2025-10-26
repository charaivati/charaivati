//comonents/languageProvider
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Lang = { name: string } | null;

type LangCtx = {
  locale: string | null;
  setLanguage: (name: string) => Promise<void>;
  languageMeta: Lang;
};

const COOKIE_NAME = "charaivati.locale";

const Context = createContext<LangCtx>({
  locale: null,
  setLanguage: async () => {},
  languageMeta: null,
});

export function useLanguage() {
  return useContext(Context);
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<string | null>(null);
  const [languageMeta, setLanguageMeta] = useState<Lang>(null);
  const router = useRouter();

  // Read initial language from cookie -> localStorage (client only)
  useEffect(() => {
    try {
      let savedLanguage: string | null = null;

      // Try cookie first
      try {
        const cookies = typeof document !== "undefined" ? document.cookie : "";
        const match = cookies
          .split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith(`${COOKIE_NAME}=`));
        if (match) {
          savedLanguage = decodeURIComponent(match.split("=")[1] || "");
        }
      } catch (e) {
        // ignore cookie read errors
      }

      // Fallback to localStorage
      if (!savedLanguage) {
        try {
          savedLanguage =
            typeof window !== "undefined"
              ? localStorage.getItem(COOKIE_NAME) || localStorage.getItem("charaivati.locale")
              : null;
        } catch (e) {
          // ignore localStorage errors
        }
      }

      if (savedLanguage) {
        setLocale(savedLanguage);
        setLanguageMeta({ name: savedLanguage });
      }
    } catch (e) {
      // swallow init errors to avoid breaking app
    }
  }, []);

  // Helper to set cookie (client)
  function setCookie(name: string, val: string, days = 365) {
    try {
      const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
      const secure = typeof window !== "undefined" && window.location?.protocol === "https:" ? "; Secure" : "";
      // Path and SameSite are important for client reads + SSR checks
      document.cookie = `${name}=${encodeURIComponent(val)}; path=/; expires=${expires}; SameSite=Lax${secure}`;
    } catch (e) {
      // ignore cookie set errors
    }
  }

  /**
   * Set language for the app
   * - sets cookie + localStorage
   * - updates context
   * - redirects appropriately (-> /self when logged-in; else -> /login)
   */
  async function setLanguage(name: string) {
    const languageName = (name || "").trim();
    if (!languageName) throw new Error("Language name cannot be empty");

    // Set cookie + localStorage
    setCookie(COOKIE_NAME, languageName);
    try {
      localStorage.setItem("charaivati.locale", languageName);
      localStorage.setItem(COOKIE_NAME, languageName);
    } catch (e) {
      // ignore localStorage errors
    }

    // Update state
    setLocale(languageName);
    setLanguageMeta({ name: languageName });

    // Check authentication (best-effort) and route accordingly
    try {
      const res = await fetch("/api/user/profile", { credentials: "include" });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.ok && data.profile) {
          // user is logged in — go to /self (you moved /user -> /self)
          router.push("/self");
          return;
        }
      }
    } catch (e) {
      // ignore network/auth check error — fallthrough to login
    }

    // not logged in -> go to login (so user can register / sign in)
    router.push("/login");
  }

  return (
    <Context.Provider value={{ locale, setLanguage, languageMeta }}>
      {children}
    </Context.Provider>
  );
}
