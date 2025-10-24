// app/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

export default function LandingPage() {
  const router = useRouter();
  const { setLanguage } = useLanguage();

  const [langs, setLangs] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingLogin, setCheckingLogin] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newLangName, setNewLangName] = useState("");
  const [debugInfo, setDebugInfo] = useState<string>("");

  // Check if user is already logged in
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { credentials: "include" });
        if (!alive) return;

        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.ok && data.profile) {
            router.replace("/self");
            return;
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (alive) setCheckingLogin(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  // Load languages from API
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/languages");
        const json = await res.json().catch(() => null);
        if (!alive) return;

        if (json?.ok && Array.isArray(json.data)) {
          const filtered = json.data
            .filter((r: any) => typeof r.id === "number" && typeof r.name === "string" && r.name.trim())
            .map((r: any) => ({ id: r.id, name: r.name.trim() }));
          setLangs(filtered);
        } else {
          setLangs([]);
        }
      } catch (e) {
        setDebugInfo(String(e));
        setLangs([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (checkingLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-sm opacity-70">Loading…</div>
      </div>
    );
  }

  async function onChoose(lang: { id: number; name: string }) {
    try {
      await setLanguage(lang.name);
    } catch (e) {
      alert(`Failed to set language: ${e}`);
    }
  }

  async function addLanguage() {
    const trimmedName = newLangName.trim();
    if (!trimmedName) {
      alert("Please provide language name");
      return;
    }

    try {
      const res = await fetch("/api/languages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const json = await res.json();

      if (!json.ok) throw new Error(json.error || "Failed to add language");

      setLangs((p) => [...p, { id: json.data.id, name: json.data.name }]);
      setShowAdd(false);
      setNewLangName("");
      alert(`Successfully added ${json.data.name}`);
    } catch (err: any) {
      alert(String(err.message ?? err));
    }
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#001021] via-[#000510] to-black" />

      {/* Debug panel (optional, can remove later) */}
      <div className="fixed top-4 right-4 z-50 max-w-md bg-gray-800 p-4 rounded text-xs overflow-auto max-h-64">
        <div className="font-bold mb-2">Debug Info:</div>
        <div className="mb-2">Languages loaded: {langs.length}</div>
        <div className="mb-2">Loading: {loading ? "Yes" : "No"}</div>
        <pre className="text-[10px] overflow-auto">{debugInfo}</pre>
      </div>

      {/* Center area */}
      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen pt-28 p-6">
        <div className="w-full max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Welcome to Charaivati</h1>
            <p className="text-gray-400">Choose your language to continue</p>
          </div>

          <div className="flex flex-wrap justify-center gap-6">
            {/* Add language tile */}
            <button
              onClick={() => setShowAdd(true)}
              className="w-44 h-28 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-4 flex flex-col items-center justify-center gap-2 transform hover:scale-105 transition-all"
              aria-label="Add language"
            >
              <div className="text-2xl font-bold">+</div>
              <div className="text-xs text-gray-400">Add language</div>
            </button>

            {/* Loading placeholders */}
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-44 h-28 rounded-2xl bg-white/3 animate-pulse" />
              ))}

            {/* Empty state */}
            {!loading && langs.length === 0 && (
              <div className="w-full text-center py-12">
                <p className="text-red-400 mb-4">⚠️ No languages loaded!</p>
                <p className="text-sm text-gray-400 mb-2">
                  Check the debug panel (top right) and browser console
                </p>
                <p className="text-sm text-gray-500">
                  Or click "+" to add a language
                </p>
              </div>
            )}

            {/* Language tiles */}
            {!loading &&
              langs.map((l) => (
                <button
                  key={l.id}
                  onClick={() => onChoose(l)}
                  className="w-44 h-28 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-4 flex flex-col items-center justify-center gap-1 transform hover:scale-105 transition-all"
                  title={`Select ${l.name}`}
                >
                  <div className="text-xl font-semibold">{l.name}</div>
                  <div className="text-xs text-gray-400">ID: {l.id}</div>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Add language modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900/95 rounded-xl p-6 w-96 border border-white/10">
            <h3 className="text-xl font-semibold mb-4">Add Language</h3>
            <input
              className="w-full p-3 rounded bg-white/10 mb-4 focus:outline-none focus:ring-2 focus:ring-white/20"
              placeholder="Language name (e.g. हिन्दी, English, বাংলা)"
              value={newLangName}
              onChange={(e) => setNewLangName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addLanguage();
                if (e.key === "Escape") {
                  setShowAdd(false);
                  setNewLangName("");
                }
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAdd(false);
                  setNewLangName("");
                }}
                className="px-4 py-2 rounded bg-white/10 hover:bg-white/20"
              >
                Cancel
              </button>
              <button
                onClick={addLanguage}
                className="px-4 py-2 rounded bg-green-700 hover:bg-green-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
