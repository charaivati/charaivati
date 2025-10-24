"use client";

import React, { useState } from "react";

function sanitizeName(n: string) {
  return n
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\- _\.]/gu, "")
    .slice(0, 30);
}

export default function RegistrationPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "info" | "error" | "success"; text: string } | null>(null);
  const [fieldError, setFieldError] = useState<{ name?: string; email?: string; password?: string } | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setFieldError(null);
    setDevToken(null);

    // basic client validation
    const sanitized = sanitizeName(name || email.split("@")[0] || "");
    if (sanitized.length < 2) {
      setFieldError({ name: "Enter a name (2+ chars)." });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError({ email: "Please enter a valid email address." });
      return;
    }
    if (!password || password.length < 6) {
      setFieldError({ password: "Password must be at least 6 characters." });
      return;
    }
    if (password !== confirm) {
      setFieldError({ password: "Passwords do not match." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: sanitized }),
      });

      const j = await res.json().catch(() => ({}));
      // Prefer explicit reason fields returned by your updated server
      if (res.ok && j.ok) {
        // created or resent (server returns ok:true)
        if (j.reason === "created") {
          setMessage({
            type: "success",
            text: "Account created — verification email sent. Please check your inbox (and spam).",
          });
        } else if (j.reason === "resent_verification") {
          setMessage({
            type: "info",
            text: "A fresh verification email was sent. Please check your inbox (and spam).",
          });
        } else {
          setMessage({ type: "success", text: j.message || "Success. Check your email." });
        }

        // dev fallback: server might return token in dev if email send failed
        if (j.token) setDevToken(String(j.token));
        return;
      }

      // Handle known server reasons / errors
      // Your backend returns a variety of shapes: { error, reason, message }
      const reason = j.reason ?? j.error ?? null;

      if (reason === "username_taken" || j.error === "Username already taken" || (j.message && /username/i.test(j.message))) {
        setFieldError({ name: "This username is already taken. Try another." });
        setMessage({ type: "error", text: "Choose a different username." });
        return;
      }

      if (reason === "awaiting_verification") {
        setMessage({
          type: "info",
          text: "You already signed up but haven't verified your email. Please check your inbox or spam for the verification link.",
        });
        return;
      }

      if (reason === "already_verified") {
        setMessage({
          type: "error",
          text: "An account with this email is already verified. Please log in or reset your password.",
        });
        return;
      }

      if (res.status === 429 || reason === "too_many_requests_ip" || reason === "too_many_requests_email") {
        setMessage({
          type: "error",
          text: j.message || "Too many attempts. Please wait before trying again.",
        });
        return;
      }

      // Generic fallback
      setMessage({
        type: "error",
        text: j.message || j.error || `Registration failed (status ${res.status}).`,
      });
      // If the server returned a dev token (rare), show it
      if (j.token) setDevToken(String(j.token));
    } catch (err: any) {
      console.error("Registration error:", err);
      setMessage({ type: "error", text: "Network or server error. Try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="max-w-lg w-full bg-white/6 rounded-xl p-6">
        <h1 className="text-2xl font-semibold mb-4">Create account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. madhu"
              className="w-full p-2 rounded bg-black/10 text-white"
            />
            {fieldError?.name && <div className="text-red-400 text-sm mt-1">{fieldError.name}</div>}
          </div>

          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full p-2 rounded bg-black/10 text-white"
            />
            {fieldError?.email && <div className="text-red-400 text-sm mt-1">{fieldError.email}</div>}
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password"
              className="w-full p-2 rounded bg-black/10 text-white"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className="w-full p-2 rounded bg-black/10 text-white"
              autoComplete="new-password"
            />
            {fieldError?.password && <div className="text-red-400 text-sm mt-1">{fieldError.password}</div>}
          </div>

          <div className="flex gap-2 items-center">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-2 rounded"
            >
              {loading ? "Signing up…" : "Create account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setName("");
                setEmail("");
                setPassword("");
                setConfirm("");
                setMessage(null);
                setFieldError(null);
              }}
              className="px-3 py-2 bg-gray-700 rounded"
            >
              Reset
            </button>
          </div>
        </form>

        {message && (
          <div className={`mt-4 p-3 rounded ${message.type === "error" ? "bg-red-900" : message.type === "success" ? "bg-green-900" : "bg-yellow-900"}`}>
            <div className="text-sm">{message.text}</div>
          </div>
        )}

        {devToken && (
          <div className="mt-3 p-2 bg-white/5 text-xs rounded">
            <div className="font-medium">Dev token (email send failed)</div>
            <div className="break-all text-xs mt-1">{devToken}</div>
            <div className="text-gray-300 text-xs mt-1">Use this token to verify in dev only.</div>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-300">
          By creating an account you agree to our terms. If you already registered but didn't verify,
          the server may tell you to check your inbox or will send a fresh link (rate-limited).
        </div>
      </div>
    </main>
  );
}
