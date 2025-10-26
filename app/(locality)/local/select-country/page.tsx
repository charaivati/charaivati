// app/(locality)/local/select-country/page.tsx
"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Simple select-country page:
 * - reads lang from query param ?lang=hi|en
 * - persists to localStorage and cookie
 * - shows email-first login card that calls existing endpoint /api/auth/send-magiclink
 * - after login (session cookie) tries GET /api/users/me to fetch lastSelectedLocalAreaId
 * - if lastSelectedLocalAreaId present, fetches /api/locations/:id?lang=...
 */

type UserMe = {
  id: string;
  email?: string;
  lastSelectedLocalAreaId?: number | null;
};

type LocationChain = {
  id: number;
  level?: number; // optional - your API may return type/level
  name: string;
  parentId?: number | null;
}[];

function SelectCountryContent() {
  const sp = useSearchParams();
  const qsLang = sp?.get("lang") ?? undefined;
  const qsSource = sp?.get("source") ?? undefined;

  const [lang, setLang] = useState<string>(qsLang ?? "en");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState<UserMe | null>(null);
  const [prefillChain, setPrefillChain] = useState<LocationChain | null>(null);
  const [loadingPrefill, setLoadingPrefill] = useState(false);

  // persist lang (run once on mount if query exists)
  useEffect(() => {
    const chosen =
      qsLang ||
      (typeof window !== "undefined" ? localStorage.getItem("lang") : null) ||
      (typeof navigator !== "undefined" ? navigator.language.split("-")[0] : "en") ||
      "en";

    setLang(chosen);
    if (typeof localStorage !== "undefined") localStorage.setItem("lang", chosen);
    // set cookie for SSR fallback; expires session-only
    if (typeof document !== "undefined") document.cookie = `lang=${chosen}; path=/`;
  }, [qsLang]);

  // After page loads, attempt to get authenticated user info
  useEffect(() => {
    (async () => {
      try {
        // try an authenticated endpoint; assumes session cookie will be sent
        const res = await fetch("/api/users/me", { credentials: "include" });
        if (!res.ok) return;
        const j = await res.json();
        if (j?.id) {
          setUser(j);
          // if backend returns lastSelectedLocalAreaId in this endpoint, use it
          const lastId = j.lastSelectedLocalAreaId ?? null;
          if (lastId) {
            // use the latest lang state (not qsLang) when prefetching
            await fetchLocationChainAndPrefill(lastId, lang);
          }
        }
      } catch (err) {
        // ignore - not logged in or fetch error
        // console.debug("not logged in or /api/users/me error", err);
      }
    })();
    // intentionally run once on mount (qsLang already handled above)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // helper to fetch location chain
  async function fetchLocationChainAndPrefill(localAreaId: number, language: string) {
    setLoadingPrefill(true);
    try {
      // your backend should expose an endpoint to return chain from localAreaId up to country
      const res = await fetch(`/api/locations/${localAreaId}?lang=${encodeURIComponent(language)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setPrefillChain(null);
        return;
      }
      const chain: LocationChain = await res.json();
      setPrefillChain(chain);
      // At this point you can programmatically set values for your 5 pickers
      // e.g., setCountry(chain[0]), setState(chain[1]) etc.
    } catch (err) {
      console.error("Failed to fetch location chain", err);
      setPrefillChain(null);
    } finally {
      setLoadingPrefill(false);
    }
  }

  // Call your existing send-magiclink endpoint, include redirect to preserve lang & source
  async function handleSendMagicLink(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!email) {
      setMessage("Enter your email");
      return;
    }

    setSending(true);
    setMessage(null);

    try {
      // build redirect path (internal path only)
      const redirectPath = `/select-country?lang=${encodeURIComponent(
        lang
      )}${qsSource ? `&source=${encodeURIComponent(qsSource)}` : ""}`;

      const res = await fetch("/api/auth/send-magiclink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirect: redirectPath }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setMessage("❌ " + (err?.error || "Failed to send magic link"));
        setSending(false);
        return;
      }

      setMessage(`✅ Verification link sent to ${email}. Open it to continue.`);
    } catch (err) {
      console.error(err);
      setMessage("Network error");
    } finally {
      setSending(false);
    }
  }

  // Simple UI skeleton (replace pickers with your components)
  return (
    <main className="min-h-screen flex items-start justify-center p-8">
      <div className="w-full max-w-2xl bg-white/5 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold">Select your area</h1>
          <div>
            <label className="text-sm mr-2">Language</label>
            <select
              value={lang}
              onChange={(e) => {
                const l = e.target.value;
                setLang(l);
                if (typeof localStorage !== "undefined") localStorage.setItem("lang", l);
                if (typeof document !== "undefined") document.cookie = `lang=${l}; path=/`;
                // re-fetch prefill in new language if we have last id
                if (user?.lastSelectedLocalAreaId) {
                  fetchLocationChainAndPrefill(user.lastSelectedLocalAreaId, l);
                }
              }}
              className="p-1 rounded bg-white/10"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>
          </div>
        </div>

        {/* Email-first card */}
        <section className="mb-6">
          <form onSubmit={handleSendMagicLink} className="flex gap-2">
            <input
              type="email"
              className="flex-1 p-2 rounded bg-white/10"
              placeholder={lang === "hi" ? "ईमेल दर्ज करें" : "Enter email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
            >
              {sending
                ? lang === "hi"
                  ? "भेज रहा..."
                  : "Sending..."
                : lang === "hi"
                ? "लॉगिन लिंक भेजें"
                : "Send login link"}
            </button>
          </form>
          {message && <p className="mt-2 text-sm">{message}</p>}
        </section>

        {/* If authenticated and prefilled */}
        <section className="mb-6">
          {loadingPrefill && <p>Loading your last saved location…</p>}
          {!loadingPrefill && prefillChain && prefillChain.length > 0 && (
            <div className="p-3 border rounded bg-white/3">
              <div className="text-sm font-medium mb-2">Your last saved area:</div>
              <ol className="list-decimal list-inside text-sm">
                {prefillChain.map((c) => (
                  <li key={c.id}>
                    {c.name} {c.level ? `(level ${c.level})` : ""}
                  </li>
                ))}
              </ol>
              <div className="mt-2 text-xs text-slate-300">You can change any of these below.</div>
            </div>
          )}

          {/* If user logged in but no prefill */}
          {user && !prefillChain && (
            <div className="p-3 border rounded bg-white/3 text-sm">
              No saved area yet. Please select your country/state/local below.
            </div>
          )}
        </section>

        {/* Placeholder pickers: replace with your autocomplete UI and wire parentId */}
        <section>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs block mb-1">Country</label>
              <input className="w-full p-2 rounded bg-white/5" placeholder={lang === "hi" ? "देश चुनें" : "Select country"} />
            </div>

            <div>
              <label className="text-xs block mb-1">State</label>
              <input className="w-full p-2 rounded bg-white/5" placeholder={lang === "hi" ? "राज्य चुनें" : "Select state"} />
            </div>

            <div>
              <label className="text-xs block mb-1">Legislative (Assembly)</label>
              <input className="w-full p-2 rounded bg-white/5" placeholder={lang === "hi" ? "विधानसभा क्षेत्र" : "Assembly constituency"} />
            </div>

            <div>
              <label className="text-xs block mb-1">Parliament (Lok Sabha)</label>
              <input className="w-full p-2 rounded bg-white/5" placeholder={lang === "hi" ? "संसदीय क्षेत्र" : "Parliament constituency"} />
            </div>

            <div>
              <label className="text-xs block mb-1">Local (Panchayat / Municipal)</label>
              <input className="w-full p-2 rounded bg-white/5" placeholder={lang === "hi" ? "पंचायत/नगर पालिका" : "Local area (ward/village)"} />
            </div>
          </div>

          <div className="mt-4">
            <button className="px-4 py-2 rounded bg-green-600 hover:bg-green-700">
              {lang === "hi" ? "सहेजें" : "Save selection"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function SelectCountryPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </main>
    }>
      <SelectCountryContent />
    </Suspense>
  );
}