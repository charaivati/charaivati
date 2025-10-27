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
 */

type Lang = { id: number; name: string; code?: string };

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

export default function LandingPage() {
  const router = useRouter();
  const { setLanguage } = useLanguage();

  const [status, setStatus] = useState<"checking" | "showPicker" | "redirect">("checking");
  const [langs, setLangs] = useState<Lang[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // 1) Quick auth check
        const base = getBaseUrl();
        const res = await fetch(`${base}/api/user/profile`, { credentials: "include" });
        if (!alive) return;

        // 401 is expected for anonymous users - this is not an error
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
          // localStorage may be unavailable in some contexts
        }

        if (!savedLang) {
          // no guest language -> show language picker
          setStatus("showPicker");
        } else {
          // have guest language -> go to login
          setStatus("redirect");
          router.replace("/login");
        }
      } catch (err) {
        // Only log truly unexpected errors
        if (!alive) return;
        console.error("[Landing] Unexpected error:", err);
        // On error, default to login page
        setStatus("redirect");
        router.replace("/login");
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  // load languages for the picker
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingLangs(true);
      try {
        const base = getBaseUrl();
        const res = await fetch(`${base}/api/languages`);
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (json?.ok && Array.isArray(json.data)) {
          setLangs(json.data.map((r: any) => ({ id: r.id, name: r.name, code: r.code })));
        } else {
          setLangs([]);
        }
      } catch (e) {
        console.warn("[Landing] failed to load languages", e);
        setLangs([]);
      } finally {
        if (alive) setLoadingLangs(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function onChoose(lang: Lang) {
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

  async function onAddLanguage() {
    const name = prompt("Language name (e.g. English):")?.trim();
    if (!name) return;
    const code = prompt("Language code (optional, e.g. en):")?.trim() || undefined;

    setAdding(true);
    setAddError(null);
    try {
      const base = getBaseUrl();
      const res = await fetch(`${base}/api/languages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg = json?.error || `HTTP ${res.status}`;
        setAddError(String(msg));
        alert(`Failed to add language: ${msg}`);
        return;
      }
      const newLang: Lang = { id: json.data.id, name: json.data.name, code: json.data.code };
      setLangs((prev) => [...prev, newLang]);
      try {
        localStorage.setItem("app.language", newLang.name);
      } catch {}
      await setLanguage(newLang.name);
      router.replace("/login");
    } catch (e: any) {
      setAddError(String(e?.message ?? e));
      alert(`Failed to add language: ${e}`);
    } finally {
      setAdding(false);
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

          <div className="mb-6">
            <button
              onClick={onAddLanguage}
              disabled={adding}
              className="px-4 py-2 rounded-md bg-white/6 hover:bg-white/10 border border-white/10 text-white inline-flex items-center gap-2"
            >
              {adding ? "Adding…" : "+"} Add language
            </button>
            {addError ? <div className="text-sm text-rose-400 mt-2">Last add error: {addError}</div> : null}
          </div>

          {loadingLangs ? (
            <div className="flex justify-center gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-44 h-28 rounded-2xl bg-white/3 animate-pulse" />
              ))}
            </div>
          ) : langs.length === 0 ? (
            <div className="text-sm text-gray-400">No languages found. Use "+ Add language" to create one.</div>
          ) : (
            <div className="flex flex-wrap justify-center gap-6">
              {langs.map((l) => (
                <button
                  key={l.id}
                  onClick={() => onChoose(l)}
                  className="w-44 h-28 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-4 flex flex-col items-center justify-center gap-1 transform hover:scale-105 transition-all"
                >
                  <div className="text-xl font-semibold">{l.name}</div>
                  <div className="text-xs text-gray-400">ID: {l.id}{l.code ? ` • ${l.code}` : ""}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}