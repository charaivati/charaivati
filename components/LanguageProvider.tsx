// components/LanguageProvider.tsx
"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

type LangContextValue = {
  // canonical fields used in different files
  lang: string;
  locale: string;

  // updater names some files expect
  setLang: (l: string) => void;
  setLanguage: (l: string) => void;
  setLocale: (l: string) => void;
};

const LangContext = createContext<LangContextValue | null>(null);

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  // single source of truth for language; keep locale in sync
  const [lang, setLangState] = useState<string>(() => {
    try {
      // try to read user preference from localStorage (client-only; this runs in client components)
      const stored = typeof window !== "undefined" ? localStorage.getItem("lang") : null;
      return stored ?? "en";
    } catch {
      return "en";
    }
  });

  // keep a duplicate 'locale' value for code expecting that name
  const locale = lang;

  // unified setter that updates state and persists
  function setLang(l: string) {
    setLangState(l);
    try {
      if (typeof window !== "undefined") localStorage.setItem("lang", l);
    } catch {}
  }

  // alias for other consumer names
  function setLanguage(l: string) {
    setLang(l);
  }
  function setLocale(l: string) {
    setLang(l);
  }

  const value = useMemo<LangContextValue>(
    () => ({ lang, locale, setLang, setLanguage, setLocale }),
    [lang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
