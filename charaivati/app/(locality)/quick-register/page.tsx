"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LocationAutocomplete, { LocationItem } from "@/components/LocationAutocomplete";
import Link from "next/link";

type TempResp = { ok: true; tempPassword: string } | { ok: false; error?: string };

export default function QuickRegisterPage() {
  const router = useRouter();

  // auth form
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // location state (same as before)
  const [country, setCountry] = useState<LocationItem | null>(null);
  const [stateItem, setStateItem] = useState<LocationItem | null>(null);
  const [assembly, setAssembly] = useState<LocationItem | null>(null);
  const [parliament, setParliament] = useState<LocationItem | null>(null);
  const [localArea, setLocalArea] = useState<LocationItem | null>(null);

  useEffect(() => {
    // preserve language cookie if needed or other init
    const lang = localStorage.getItem("lang") || "en";
    document.cookie = `lang=${lang}; path=/`;
  }, []);

  async function handleCreateTemp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setTempPassword(null);
    setError(null);

    if (!email) {
      setError("Enter email or username");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/user/register-temp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const j: TempResp = await res.json();
      if (!res.ok || !j.ok) {
        setError((j as any)?.error || "Failed to create");
      } else {
        // show temp password to user (note: one-time)
        setTempPassword((j as any).tempPassword);
      }
    } catch (err) {
      console.error(err);
      setError("Network error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      {/* simple header: top-right login/register */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">Quick Register & Select Area</h1>
        <nav className="flex items-center gap-3">
          <Link href="/auth/login" className="px-3 py-2 rounded bg-blue-600 text-white">Login</Link>
          <Link href="/(user)/user/registration" className="px-3 py-2 rounded bg-white border">Register</Link>
        </nav>
      </header>

      <section className="max-w-3xl mx-auto bg-white p-6 rounded shadow">
        <h2 className="text-lg font-medium mb-2">Create account (temporary password)</h2>
        <p className="text-sm text-slate-600 mb-4">
          Enter an email or username below. The server will create an account (if missing) and return a temporary password you can use to login.
        </p>

        <form onSubmit={handleCreateTemp} className="flex gap-2 mb-4">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="flex-1 p-2 border rounded"
            type="email"
            required
          />
          <button disabled={creating} className="px-4 py-2 bg-green-600 text-white rounded">
            {creating ? "Creating…" : "Create account"}
          </button>
        </form>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        {tempPassword && (
          <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400">
            <div className="text-sm">Temporary password (one-time — copy now):</div>
            <div className="mt-2 font-mono text-lg bg-white p-2 rounded">{tempPassword}</div>
            <div className="mt-2 text-xs text-slate-500">
              For security, the temporary password is shown only once. We recommend logging in and changing your password right away.
            </div>
          </div>
        )}

        <hr className="my-4" />

        {/* location pickers (same flow) */}
        <div className="grid gap-3">
          <div>
            <label className="text-sm block mb-1">Country</label>
            <LocationAutocomplete level={1} value={country} onChange={setCountry} placeholder="Select country" />
          </div>
          <div>
            <label className="text-sm block mb-1">State</label>
            <LocationAutocomplete level={2} parentId={country?.id} value={stateItem} onChange={(v) => { setStateItem(v); setAssembly(null); setParliament(null); setLocalArea(null); }} placeholder="Select state" />
          </div>
          <div>
            <label className="text-sm block mb-1">Assembly</label>
            <LocationAutocomplete level={3} parentId={stateItem?.id} value={assembly} onChange={(v) => { setAssembly(v); setParliament(null); setLocalArea(null); }} placeholder="Assembly constituency" />
          </div>
          <div>
            <label className="text-sm block mb-1">Parliament</label>
            <LocationAutocomplete level={4} parentId={stateItem?.id} value={parliament} onChange={(v) => { setParliament(v); setLocalArea(null); }} placeholder="Parliament constituency" />
          </div>
          <div>
            <label className="text-sm block mb-1">Local (Panchayat / Municipal)</label>
            <LocationAutocomplete level={5} parentId={assembly?.id ?? stateItem?.id ?? parliament?.id} value={localArea} onChange={setLocalArea} placeholder="Local area (ward/village)" allowCreate />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={async () => {
              // if user is logged in you can POST to /api/user/selection to save selection
              if (!localArea) return alert("Choose local area first");
              const r = await fetch("/api/user/selection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ localAreaId: localArea.id }),
              });
              if (!r.ok) alert("Save failed");
              else alert("Saved");
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Save selection
          </button>
          <button onClick={() => router.push("/select-country")} className="px-4 py-2 bg-gray-100 rounded">Open Select page</button>
        </div>
      </section>
    </main>
  );
}
