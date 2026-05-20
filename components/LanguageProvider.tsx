// components/LanguageProvider.tsx
"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

type LangContextValue = {
  lang: string;
  locale: string;
  setLang: (l: string) => void;
  setLanguage: (l: string) => void;
  setLocale: (l: string) => void;
};

const LangContext = createContext<LangContextValue | null>(null);

const LANG_COOKIE_RE = /(?:^|;\s*)lang=([^;]+)/;
const LOCALE_CODE_RE = /^[a-z]{2,8}(-[a-zA-Z]{2,4})?$/;

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<string>(() => {
    try {
      if (typeof window === "undefined") return "en";
      // Prefer localStorage (written first; survives cookie clearing).
      const stored = localStorage.getItem("lang");
      if (stored && LOCALE_CODE_RE.test(stored)) return stored;
      // Fallback: read from cookie (set by setLang below; readable by middleware).
      const match = document.cookie.match(LANG_COOKIE_RE);
      if (match?.[1]) {
        const fromCookie = decodeURIComponent(match[1]);
        if (LOCALE_CODE_RE.test(fromCookie)) return fromCookie;
      }
      return "en";
    } catch {
      return "en";
    }
  });

  const locale = lang;

  function setLang(l: string) {
    setLangState(l);
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem("lang", l);
      // Mirror to a cookie so the edge middleware can gate on language selection
      // without needing to access localStorage (which is unavailable at the edge).
      const secure = location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `lang=${encodeURIComponent(l)}; path=/; max-age=31536000; SameSite=Lax${secure}`;
    } catch {}
  }

  function setLanguage(l: string) {
    setLang(l);
  }
  function setLocale(l: string) {
    setLang(l);
  }

  const value = useMemo<LangContextValue>(() => ({ lang, locale, setLang, setLanguage, setLocale }), [lang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
