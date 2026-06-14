"use client";

import { useState } from "react";

interface SecureChatCardProps {
  onDismiss?: () => void;
  onSuccess?: () => void;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
// LOGIN-IN-CHAT-1: simple shape check only — the auth route is the source of truth.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "signup" | "login";

export function SecureChatCard({ onDismiss, onSuccess }: SecureChatCardProps) {
  const [mode, setMode] = useState<Mode>("signup");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isUsernameValid = username.length > 0 && USERNAME_RE.test(username);
  const isEmailValid = email.length > 0 && EMAIL_RE.test(email);
  const isPasswordValid = mode === "signup" ? password.length >= 8 : password.length > 0;

  const canSubmit =
    mode === "signup"
      ? isUsernameValid && isPasswordValid && !loading
      : isEmailValid && isPasswordValid && !loading;

  // LOGIN-IN-CHAT-1: credentials post directly to the auth routes below — never
  // into ConsultMessage, the model prompt, or any /api/listen call.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const res = await fetch("/api/user/guest-upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Upgrade failed");
          return;
        }

        const data = await res.json();
        if (data.success) {
          setSuccess(true);
          if (onSuccess) onSuccess();
          setTimeout(() => {
            if (onDismiss) onDismiss();
          }, 2000);
        }
      } else {
        const res = await fetch("/api/user/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          credentials: "include",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          setError(data.error || "Login failed");
          return;
        }

        setSuccess(true);
        if (onSuccess) onSuccess();
        setTimeout(() => {
          if (onDismiss) onDismiss();
        }, 2000);
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        {mode === "signup" ? "✓ Account created! Your conversations are now saved." : "✓ Signed in! Picking up your conversation…"}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <p className="mb-3 text-sm font-medium text-blue-900">
        {mode === "signup" ? "Save our conversations — create your account" : "Sign in to your account"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-2">
        {mode === "signup" ? (
          <div>
            <input
              type="text"
              placeholder="Username (3–20 characters)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              className="w-full rounded border border-blue-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
            {username && !isUsernameValid && (
              <p className="mt-1 text-xs text-red-600">
                3–20 letters, numbers, or underscores only
              </p>
            )}
          </div>
        ) : (
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              className="w-full rounded border border-blue-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
            {email && !isEmailValid && <p className="mt-1 text-xs text-red-600">Enter a valid email address</p>}
          </div>
        )}

        <div>
          <input
            type="password"
            placeholder={mode === "signup" ? "Password (min 8 characters)" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="w-full rounded border border-blue-300 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          {mode === "signup" && password && !isPasswordValid && (
            <p className="mt-1 text-xs text-red-600">At least 8 characters</p>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (mode === "signup" ? "Creating…" : "Signing in…") : mode === "signup" ? "Create Account" : "Sign In"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={loading}
            className="rounded border border-blue-300 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            Later
          </button>
        </div>
      </form>

      <p className="mt-3 text-xs text-gray-600">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setError("");
                setMode("login");
              }}
              className="text-blue-600 underline hover:text-blue-700"
            >
              Log in here
            </button>
          </>
        ) : (
          <>
            New here?{" "}
            <button
              type="button"
              onClick={() => {
                setError("");
                setMode("signup");
              }}
              className="text-blue-600 underline hover:text-blue-700"
            >
              Create an account
            </button>
          </>
        )}
      </p>
    </div>
  );
}
