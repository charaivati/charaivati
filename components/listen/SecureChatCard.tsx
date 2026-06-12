"use client";

import { useState } from "react";

interface SecureChatCardProps {
  onDismiss?: () => void;
  onSuccess?: () => void;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function SecureChatCard({ onDismiss, onSuccess }: SecureChatCardProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isUsernameValid = username.length > 0 && USERNAME_RE.test(username);
  const isPasswordValid = password.length >= 8;
  const canSubmit = isUsernameValid && isPasswordValid && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
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
        // After 2s, clear the card
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
        ✓ Account created! Your conversations are now saved.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <p className="mb-3 text-sm font-medium text-blue-900">
        Save our conversations — create your account
      </p>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <input
            type="text"
            placeholder="Username (3–20 characters)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            className="w-full rounded border border-blue-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          {username && !isUsernameValid && (
            <p className="mt-1 text-xs text-red-600">
              3–20 letters, numbers, or underscores only
            </p>
          )}
        </div>

        <div>
          <input
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full rounded border border-blue-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          {password && !isPasswordValid && (
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
            {loading ? "Creating…" : "Create Account"}
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
        Already have an account?{" "}
        <a href="/login?next=/listen" className="text-blue-600 underline hover:text-blue-700">
          Log in
        </a>
      </p>
    </div>
  );
}
