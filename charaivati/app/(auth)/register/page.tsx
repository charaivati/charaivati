// app/(auth)/register/page.tsx  (or wherever your registration UI lives)
"use client";
import React, { useEffect, useState, useRef } from "react";

function sanitizeLocalName(s = "") {
  return s.trim();
}

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null); // null = unchecked
  const [checkingName, setCheckingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // debounce id
  const debounceId = useRef<number | null>(null);

  async function checkName(n: string) {
    n = sanitizeLocalName(n);
    if (!n) {
      setNameAvailable(null);
      return;
    }
    setCheckingName(true);
    try {
      const res = await fetch("/api/user/check-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) setNameAvailable(Boolean(j.available));
      else setNameAvailable(false);
    } catch (e) {
      console.error("name check failed", e);
      setNameAvailable(null);
    } finally {
      setCheckingName(false);
    }
  }

  // debounce on typing
  useEffect(() => {
    if (debounceId.current) window.clearTimeout(debounceId.current);
    // only check if user typed at least 2 chars
    if (!name || name.length < 2) {
      setNameAvailable(null);
      return;
    }
    debounceId.current = window.setTimeout(() => checkName(name), 400);
    return () => { if (debounceId.current) window.clearTimeout(debounceId.current); };
  }, [name]);

  // on blur do immediate check
  async function handleNameBlur() {
    if (!name || name.length < 2) { setNameAvailable(null); return; }
    await checkName(name);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Simple client validation
    if (!email || !password || !name) {
      setError("Please fill name, email and password");
      return;
    }
    if (nameAvailable === false) {
      setError("Please choose a different username");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const j = await res.json().catch(() => ({}));

      if (!res.ok) {
        // surface server-side messages
        const msg = j?.error || j?.message || `Status ${res.status}`;
        setError(msg === "name_taken" ? "Username already taken. Choose another." : msg);
        setSubmitting(false);
        return;
      }

      // success
      // Optionally redirect to the login page or show success message
      window.location.href = "/login?registered=1&email=" + encodeURIComponent(email);
    } catch (err) {
      console.error("register network error", err);
      setError("Network error");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="w-full max-w-md bg-white/6 rounded-xl p-6">
        <h1 className="text-2xl mb-4">Create account</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <div className="text-sm mb-1">Username</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              placeholder="Pick a username"
              className="w-full p-2 rounded bg-black/50 border border-gray-600"
              required
            />
            <div className="mt-1 text-xs h-4">
              {/* small status text */}
              {checkingName && <span className="text-gray-300">Checking availability…</span>}
              {name && nameAvailable === true && <span className="text-green-300">Available ✓</span>}
              {name && nameAvailable === false && <span className="text-red-400">Username taken — try another</span>}
            </div>
          </label>

          <label className="block">
            <div className="text-sm mb-1">Email</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-2 rounded bg-black/50 border border-gray-600"
              required
            />
          </label>

          <label className="block">
            <div className="text-sm mb-1">Password</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-2 rounded bg-black/50 border border-gray-600"
              required
            />
          </label>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-emerald-600 p-2 rounded disabled:opacity-60"
              disabled={submitting || checkingName || nameAvailable === false}
            >
              {submitting ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
  