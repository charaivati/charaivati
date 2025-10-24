"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type StatusResp = {
  exists?: boolean;
  deletionScheduledAt?: string | null;
  deletedAt?: string | null;
  avatarUrl?: string | null;
  name?: string | null;
};

export default function AuthPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // Read params safely
  const registered = !!sp && sp.get("registered") === "1";
  const prefillEmail = !!sp ? sp.get("email") || "" : "";
  const redirectTo = !!sp ? sp.get("redirect") || "/self" : "/self";

  // Tab state
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Shared email state
  const [email, setEmail] = useState("");
  
  // Login form
  const [loginPassword, setLoginPassword] = useState("");
  
  // Register form
  const [registerPassword, setRegisterPassword] = useState("");
  const [name, setName] = useState("");
  
  const [message, setMessage] = useState("");

  // Status check state
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
  // Register busy state
  const [registerBusy, setRegisterBusy] = useState(false);

  // Prefill form + show message after registration
  useEffect(() => {
    if (registered) {
      setMessage(`📧 Verification link sent to ${prefillEmail || "your email"}.`);
      setActiveTab("login"); // Switch to login after registration
    }
    if (prefillEmail) {
      setEmail(prefillEmail);
      checkStatus(prefillEmail);
    }
  }, [registered, prefillEmail]);

  function remainingString(dateStr?: string | null) {
    if (!dateStr) return null;
    const ms = new Date(dateStr).getTime() - Date.now();
    if (ms <= 0) return "less than an hour";
    const days = Math.floor(ms / (24 * 3600 * 1000));
    const hours = Math.floor((ms % (24 * 3600 * 1000)) / 3600000);
    return `${days}d ${hours}h remaining`;
  }

  async function checkStatus(checkEmail?: string) {
    const e = checkEmail ?? email;
    if (!e) return;
    try {
      setCheckingStatus(true);
      const res = await fetch(`/api/user/status?email=${encodeURIComponent(e)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      const j: StatusResp = await res.json().catch(() => ({} as StatusResp));
      setStatus(j);
    } catch (err) {
      console.error("status check failed", err);
    } finally {
      setCheckingStatus(false);
    }
  }

  async function cancelDeletion() {
    try {
      setCancelling(true);
      const res = await fetch("/api/user/cancel-delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage("❌ Could not cancel deletion: " + (j?.error || res.statusText));
        return;
      }
      setMessage("✅ Account deletion cancelled. You can now login.");
      await checkStatus();
    } catch (err) {
      console.error(err);
      setMessage("Network error while cancelling");
    } finally {
      setCancelling(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage("Logging in...");

    try {
      const res = await fetch("/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        redirect: "manual",
        body: JSON.stringify({ email, password: loginPassword }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setMessage("❌ " + (data?.error || "Login failed"));
        return;
      }

      setMessage("✅ Login successful! Redirecting…");
      await new Promise((r) => setTimeout(r, 0));
      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      console.error(err);
      setMessage("Network error");
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setRegisterBusy(true);
    
    try {
      const res = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: registerPassword, name }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setMessage("❌ " + (data.error || "Registration failed"));
      } else {
        setMessage("✅ Registration successful! Check your email for verification link.");
        setRegisterPassword("");
        setName("");
        // Switch to login tab after successful registration
        setTimeout(() => setActiveTab("login"), 2000);
      }
    } catch (err: any) {
      setMessage("❌ Network error");
      console.error(err);
    } finally {
      setRegisterBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md bg-white/10 rounded-xl p-6 shadow-lg">
        
        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6 border-b border-white/20">
          <button
            onClick={() => setActiveTab("login")}
            className={`flex-1 pb-3 font-semibold transition-colors ${
              activeTab === "login"
                ? "text-white border-b-2 border-blue-500"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setActiveTab("register")}
            className={`flex-1 pb-3 font-semibold transition-colors ${
              activeTab === "register"
                ? "text-white border-b-2 border-emerald-500"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Register
          </button>
        </div>

        {/* Login Form */}
        {activeTab === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => checkStatus()}
              placeholder="Email"
              className="w-full p-2 rounded bg-black/50 border border-gray-600"
              required
            />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Password"
              className="w-full p-2 rounded bg-black/50 border border-gray-600"
              required
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 p-2 rounded-lg">
                Login
              </button>
              <button
                type="button"
                onClick={() => checkStatus()}
                className="px-3 py-2 bg-slate-700 rounded-lg"
              >
                Check
              </button>
            </div>
          </form>
        )}

        {/* Register Form */}
        {activeTab === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full p-2 rounded bg-black/50 border border-gray-600"
              required
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full p-2 rounded bg-black/50 border border-gray-600"
              required
            />
            <input
              type="password"
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
              placeholder="Password (min 8 characters)"
              className="w-full p-2 rounded bg-black/50 border border-gray-600"
              minLength={8}
              required
            />
            <button
              type="submit"
              disabled={registerBusy}
              className="w-full bg-emerald-600 hover:bg-emerald-700 p-2 rounded-lg disabled:opacity-50"
            >
              {registerBusy ? "Registering..." : "Register"}
            </button>
          </form>
        )}

        {/* Status check indicator */}
        {checkingStatus && <p className="mt-3 text-sm">Checking account status…</p>}

        {/* Status panel for scheduled deletion */}
        {status?.exists && status.deletionScheduledAt && (
          <div className="mt-4 p-3 border rounded bg-white/5">
            <div className="flex items-center gap-3">
              {status.avatarUrl ? (
                <img src={status.avatarUrl} alt="avatar" className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
                  ?
                </div>
              )}
              <div>
                <div className="font-medium">{status.name ?? "Account"}</div>
                <div className="text-sm text-slate-300">
                  Scheduled deletion: {new Date(status.deletionScheduledAt).toLocaleString()}
                </div>
                <div className="text-sm text-slate-300">
                  {remainingString(status.deletionScheduledAt)}
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={cancelDeletion}
                disabled={cancelling}
                className="flex-1 bg-green-600 hover:bg-green-700 p-2 rounded"
              >
                {cancelling ? "Cancelling…" : "Keep my account"}
              </button>
              <button
                onClick={() => {
                  setMessage("You can still login to cancel deletion from your account page.");
                }}
                className="px-3 py-2 bg-slate-700 rounded"
              >
                Continue to login
              </button>
            </div>
          </div>
        )}

        {/* Message display */}
        {message && (
          <div className="mt-4 p-3 rounded bg-white/5 text-sm">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}