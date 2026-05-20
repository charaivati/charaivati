// hooks/useTranslations.ts
// Shared translation hook used by every page/component that needs localised strings.
//
// Usage:
//   // Define slugs as a stable module-level constant to avoid re-fetching on render.
//   const SLUGS = "my-slug-1,my-slug-2,my-slug-3";
//
//   function MyComponent() {
//     const t = useTranslations(SLUGS);
//     return <h1>{t("my-slug-1", "English fallback")}</h1>;
//   }

"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

export function useTranslations(slugsCsv: string) {
  const { locale } = useLanguage();
  const [tMap, setTMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!locale || locale === "en") {
      setTMap({});
      return;
    }
    let alive = true;
    fetch(
      `/api/tab-translations?locale=${encodeURIComponent(locale)}&slugs=${encodeURIComponent(slugsCsv)}`
    )
      .then((r) => r.json())
      .then((json) => {
        if (!alive || !json.ok) return;
        const map: Record<string, string> = {};
        for (const [slug, v] of Object.entries(
          json.translations as Record<string, any>
        )) {
          if (v?.title) map[slug] = v.title;
        }
        setTMap(map);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [locale, slugsCsv]);

  return useCallback(
    (slug: string, fallback: string) => tMap[slug] || fallback,
    [tMap]
  );
}
