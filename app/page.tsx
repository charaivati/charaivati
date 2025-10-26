// app/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Landing page behavior:
 * - Logged in -> /self
 * - Not logged in:
 *    - if a saved guest language exists (localStorage cookie) -> /login
 *    - if no saved language -> show language picker (so logged-out user picks language)
 *
 * This preserves your "clear language on logout" flow: after logout we clear localStorage,
 * user hits "/", no language found -> they see the picker.
 */
export default function LandingPage() {
  const router = useRouter();
  const { setLanguage } = useLanguage();
  const [status, setStatus] = useState<"checking" | "showPicker" | "redirect">("checking");
  const [langs, setLangs] = useState<{ id: number; name: string }[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // 1) Quick auth check
        const res = await fetch("/api/user/profile", { credentials: "include" });
        if (!alive) return;

        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.ok && data.profile) {
            // logged in -> profile
            router.replace("/self");
            return;
          }
        }

        // 2) Not logged in -> see if guest language exists in storage
        const candidateKeys = ["app.language", "charaivati.lang", "language", "preferredLanguage"];
        let savedLang: string | null = null;
        try {
          for (const k of candidateKeys) {
            const v = localStorage.getItem(k);
            if (v && v.trim()) {
              savedLang = v;
              break;
            }
          }
        } catch (e) {
          // localStorage may be unavailable in some contexts — ignore
        }

        if (!savedLang) {
          // no guest language -> show language picker (so logged-out user picks one)
          setStatus("showPicker");
        } else {
          // have guest language -> go to login
          setStatus("redirect");
          router.replace("/login");
        }
      } catch (err) {
        console.error("[Landing] Auth check failed:", err);
        router.replace("/login");
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  // load languages for the picker (only used when showing the picker)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/languages");
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (json?.ok && Array.isArray(json.data)) {
          setLangs(json.data.map((r: any) => ({ id: r.id, name: r.name })));
        } else {
          setLangs([]);
        }
      } catch (e) {
        setLangs([]);
      } finally {
        if (alive) setLoadingLangs(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // user selected language handler (keeps current provider behavior)
  async function onChoose(lang: { id: number; name: string }) {
    try {
      try {
        localStorage.setItem("app.language", lang.name);
      } catch {}
      await setLanguage(lang.name);
      router.replace("/login");
    } catch (e) {
      alert(`Failed to set language: ${e}`);
    }
  }

  if (status === "checking") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white text-center">
        <div className="text-3xl font-bold mb-4 tracking-wide">Charaivati</div>
        <div className="text-sm opacity-70">Checking session…</div>
        <div className="mt-6 w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "showPicker") {
    return (
      <div className="relative min-h-screen bg-black text-white p-6">
        <div className="max-w-4xl mx-auto pt-20 text-center">
          <h1 className="text-4xl font-bold mb-2">Welcome to Charaivati</h1>
          <p className="text-gray-400 mb-6">Choose your language to continue</p>

          {loadingLangs ? (
            <div className="flex justify-center gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-44 h-28 rounded-2xl bg-white/3 animate-pulse" />
              ))}
            </div>
          ) : langs.length === 0 ? (
            <div className="text-sm text-gray-400">No languages found. Please add one later.</div>
          ) : (
            <div className="flex flex-wrap justify-center gap-6">
              {langs.map((l) => (
                <button
                  key={l.id}
                  onClick={() => onChoose(l)}
                  className="w-44 h-28 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-4 flex flex-col items-center justify-center gap-1 transform hover:scale-105 transition-all"
                >
                  <div className="text-xl font-semibold">{l.name}</div>
                  <div className="text-xs text-gray-400">ID: {l.id}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // fallback (shouldn't reach here because redirect already handled)
  return null;
}
