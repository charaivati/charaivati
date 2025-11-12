// components/LanguagePicker.tsx
"use client";

import React, { useEffect, useState } from "react";

type Lang = { code: string; name: string; id?: number };
type LanguagePickerProps = {
  onSelect: (code: string, name?: string) => void;
  onClose: () => void;
};

export default function LanguagePicker({ onSelect, onClose }: LanguagePickerProps) {
  const [langs, setLangs] = useState<Lang[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/languages");
        const json = await res.json();
        if (!alive) return;
        if (!json?.ok) {
          setErr(json?.error || "Failed to load languages");
          setLangs([]);
        } else {
          setLangs(json.data || []);
        }
      } catch (e: any) {
        setErr(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold">Choose language</h3>
          <button onClick={onClose} aria-label="Close" className="text-gray-600 hover:text-gray-900">✕</button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {loading && <div className="py-8 text-center text-gray-600">Loading…</div>}
          {err && <div className="py-4 text-red-600">{err}</div>}

          {!loading && !err && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {langs.map((l) => (
                <button
                  key={l.code}
                  onClick={() => onSelect(l.code, l.name)}
                  className="text-left p-3 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  <div className="font-medium text-gray-900">{l.name}</div>
                  <div className="text-xs text-gray-500">{l.code}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
