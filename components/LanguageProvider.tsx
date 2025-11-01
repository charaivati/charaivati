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

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<string>(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("lang") : null;
      return stored ?? "en";
    } catch {
      return "en";
    }
  });

  const locale = lang;

  function setLang(l: string) {
    setLangState(l);
    try {
      if (typeof window !== "undefined") localStorage.setItem("lang", l);
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
