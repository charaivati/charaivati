// components/UserFormModal.tsx
"use client";
import React, { useState } from "react";

export default function UserFormModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Registration failed");
      } else {
        setMsg("Check your email for verification link.");
        setEmail("");
        setPassword("");
        setName("");
        setOpen(false);
      }
    } catch (err: any) {
      setMsg("Network error");
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="px-4 py-2 bg-white/10 rounded" onClick={() => setOpen(true)}>
        Open registration form
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form onSubmit={handleSubmit} className="bg-black/80 p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-3">Register</h3>
            <input className="w-full mb-2 p-2 rounded bg-white/5" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="email" className="w-full mb-2 p-2 rounded bg-white/5" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" className="w-full mb-2 p-2 rounded bg-white/5" placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} />
            <div className="flex gap-2 mt-3">
              <button type="submit" disabled={busy} className="px-3 py-2 bg-green-600 rounded">{busy ? "Saving…" : "Register"}</button>
              <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 bg-gray-700 rounded">Cancel</button>
            </div>
            {msg && <p className="mt-3 text-sm">{msg}</p>}
          </form>
        </div>
      )}
    </>
  );
}
