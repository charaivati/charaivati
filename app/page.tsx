// app/page.tsx
"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import Wordmark from "@/components/brand/Wordmark";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Landing page behavior:
 * - Logged in -> /self
 * - Not logged in:
 *    - if a saved guest language exists (localStorage cookie) -> /login
 *    - if no saved language -> show language picker (so logged-out user picks language)
 */

type Lang = { id: number; name: string; code?: string; nativeName?: string | null };

function getLoginUrl(): string {
  try {
    const redirect = new URLSearchParams(window.location.search).get("redirect");
    if (redirect) return `/login?redirect=${encodeURIComponent(redirect)}`;
  } catch {}
  return "/login";
}

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

// Open-redirect guard: only an in-app path is a valid return target. Reject, don't sanitize.
function getValidFrom(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/app")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw.includes("http:") || raw.includes("https:") || raw.includes("javascript:")) return null;
  return raw;
}

function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-indigo-600/20 blur-[130px]" />
      <div className="absolute -bottom-56 -right-32 w-[520px] h-[520px] rounded-full bg-violet-700/15 blur-[130px]" />
      <div className="absolute -bottom-40 -left-40 w-[420px] h-[420px] rounded-full bg-sky-700/10 blur-[120px]" />
    </div>
  );
}

function BrandSplash() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-black text-white overflow-hidden">
      <AmbientBackground />
      <div className="relative text-center px-6">
        <h1 style={{ animation: "fade-up 0.6s ease-out both" }}>
          <Wordmark size="xl" />
        </h1>
        <p
          className="mt-3 text-sm text-gray-400"
          style={{ animation: "fade-up 0.6s ease-out 0.15s both" }}
        >
          चरैवेति · keep moving forward
        </p>
        <div
          className="mt-10 mx-auto h-[3px] w-40 rounded-full bg-white/10 overflow-hidden"
          style={{ animation: "fade-up 0.6s ease-out 0.3s both" }}
        >
          <div
            className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent"
            style={{ animation: "splash-sweep 1.2s ease-in-out infinite" }}
          />
        </div>
        <p className="sr-only" role="status">Checking your session…</p>
      </div>
    </div>
  );
}

const pickerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } },
};

const pickerItem = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: "easeOut" as const } },
};

function LandingPageInner() {
  const router = useRouter();
  const { setLanguage } = useLanguage();
  const searchParams = useSearchParams();
  const validFrom = getValidFrom(searchParams.get("from"));

  const [status, setStatus] = useState<"checking" | "showPicker" | "redirect">("checking");
  const [langs, setLangs] = useState<Lang[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<number | null>(null);

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
            if (validFrom) {
              setStatus("showPicker");
              return;
            }
            router.replace("/self");
            return;
          }
        }

        // 2) Not logged in -> see if guest language exists in storage
        // "lang" is the key LanguageProvider reads/writes — must be first
        const candidateKeys = ["lang", "app.language", "charaivati.lang", "language", "preferredLanguage"];
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
          // have guest language -> go to login, forwarding any ?redirect= the middleware passed
          setStatus("redirect");
          router.replace(getLoginUrl());
        }
      } catch (err) {
        // Only log truly unexpected errors
        if (!alive) return;
        console.error("[Landing] Unexpected error:", err);
        setStatus("redirect");
        router.replace(getLoginUrl());
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, validFrom]);

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
          setLangs(json.data.map((r: any) => ({ id: r.id, name: r.name, code: r.code, nativeName: r.nativeName ?? null })));
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
    if (choosing !== null) return;
    const code = lang.code || "en";
    setChoosing(lang.id);
    try {
      await setLanguage(code);
      router.replace(validFrom ? validFrom : getLoginUrl());
    } catch (e) {
      setChoosing(null);
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
      const newLang: Lang = { id: json.data.id, name: json.data.name, code: json.data.code, nativeName: json.data.nativeName ?? null };
      setLangs((prev) => [...prev, newLang]);
      const newCode = newLang.code || "en";
      await setLanguage(newCode);
      router.replace(validFrom ? validFrom : getLoginUrl());
    } catch (e: any) {
      setAddError(String(e?.message ?? e));
      alert(`Failed to add language: ${e}`);
    } finally {
      setAdding(false);
    }
  }

  if (status === "checking" || status === "redirect") {
    return <BrandSplash />;
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      <AmbientBackground />
      <div className="relative max-w-3xl mx-auto px-6 pt-20 sm:pt-28 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <h1>
            <Wordmark size="xl" />
          </h1>
          <p className="mt-3 text-base sm:text-lg text-gray-300">Welcome — let&apos;s begin.</p>
          <p className="mt-1 text-sm text-gray-500">Choose your language to continue</p>
        </motion.div>

        <div className="mt-10 sm:mt-12">
          {loadingLangs ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 sm:h-28 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <motion.div
              variants={pickerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4"
            >
              {langs.map((l) => (
                <motion.button
                  key={l.id}
                  variants={pickerItem}
                  onClick={() => onChoose(l)}
                  disabled={choosing !== null}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  className={`group h-24 sm:h-28 rounded-2xl border bg-white/5 backdrop-blur-sm p-4 flex flex-col items-center justify-center gap-1.5 transition-colors ${
                    choosing === l.id
                      ? "border-indigo-400/70 bg-indigo-500/15"
                      : "border-white/10 hover:border-indigo-400/40 hover:bg-white/10"
                  } disabled:cursor-wait`}
                >
                  {choosing === l.id ? (
                    <div className="w-5 h-5 border-2 border-indigo-300/40 border-t-indigo-300 rounded-full animate-spin" />
                  ) : (
                    <span className="text-lg sm:text-xl font-semibold text-white group-hover:text-indigo-200 transition-colors">
                      {l.nativeName || l.name}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {l.name}
                    {l.code ? ` · ${l.code}` : ""}
                  </span>
                </motion.button>
              ))}

              <motion.button
                variants={pickerItem}
                onClick={onAddLanguage}
                disabled={adding || choosing !== null}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                className="h-24 sm:h-28 rounded-2xl border border-dashed border-white/15 hover:border-white/30 bg-transparent hover:bg-white/5 p-4 flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                <Plus className="w-5 h-5" />
                <span className="text-xs font-medium">{adding ? "Adding…" : "Add language"}</span>
              </motion.button>
            </motion.div>
          )}

          {!loadingLangs && langs.length === 0 && (
            <p className="mt-6 text-sm text-gray-400">
              No languages found yet — use &quot;Add language&quot; above to create one.
            </p>
          )}

          {addError ? <p className="mt-4 text-sm text-rose-400">Last add error: {addError}</p> : null}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-12 text-xs text-gray-600"
        >
          चरैवेति · keep moving forward
        </motion.p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<BrandSplash />}>
      <LandingPageInner />
    </Suspense>
  );
}
