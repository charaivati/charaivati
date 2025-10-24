// app/(auth)/login/page.tsx
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

  // Rate limiting state
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [loginCooldown, setLoginCooldown] = useState(0);
  const [registerAttempts, setRegisterAttempts] = useState(0);
  const [registerCooldown, setRegisterCooldown] = useState(0);

  // Prefill form + show message after registration
  useEffect(() => {
    if (registered) {
      setMessage(`📧 Verification link sent to ${prefillEmail || "your email"}.`);
      setActiveTab("login");
    }
    if (prefillEmail) {
      setEmail(prefillEmail);
      checkStatus(prefillEmail);
    }
  }, [registered, prefillEmail]);

  // Login cooldown timer
  useEffect(() => {
    if (loginCooldown > 0) {
      const timer = setTimeout(() => setLoginCooldown(loginCooldown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (loginCooldown === 0 && loginAttempts >= 3) {
      setLoginAttempts(0);
    }
  }, [loginCooldown, loginAttempts]);

  // Register cooldown timer
  useEffect(() => {
    if (registerCooldown > 0) {
      const timer = setTimeout(() => setRegisterCooldown(registerCooldown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (registerCooldown === 0 && registerAttempts >= 3) {
      setRegisterAttempts(0);
    }
  }, [registerCooldown, registerAttempts]);

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

  // Improved handleLogin that respects server guidance (Retry-After, 429, captcha_required, account_locked)
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    // client-side cooldown guard
    if (loginCooldown > 0) {
      setMessage(`⏳ Too many attempts. Please wait ${loginCooldown} seconds.`);
      return;
    }

    setMessage("Logging in...");

    try {
      const res = await fetch("/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        redirect: "manual",
        body: JSON.stringify({ email, password: loginPassword }),
      });

      // If server-side rate limit
      if (res.status === 429) {
        const retryAfterHeader = res.headers.get("Retry-After");
        const retrySec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;

        if (retrySec && !Number.isNaN(retrySec) && retrySec > 0) {
          setLoginCooldown(retrySec);
          setMessage(`❌ Too many attempts. Please wait ${retrySec} seconds.`);
        } else {
          setMessage("❌ Too many requests. Please try again later.");
        }
        return;
      }

      // Try parse body
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      // Handle locked / captcha / verify responses
      if (res.status === 403 || data?.error === "account_locked" || data?.error === "Please verify your email first" || data?.error === "captcha_required") {
        const retryAfterHeader = res.headers.get("Retry-After");
        const retrySec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;

        if (data?.error === "Please verify your email first") {
          setMessage("❌ Please verify your email first. Check your inbox for the verification link.");
        } else if (data?.error === "captcha_required") {
          setMessage("❌ Please complete the CAPTCHA to continue.");
          // optionally show captcha UI by setting a state flag here
        } else {
          setMessage(data?.message || "❌ Account locked. Try again later.");
        }

        if (retrySec && !Number.isNaN(retrySec) && retrySec > 0) {
          setLoginCooldown(retrySec);
        }
        return;
      }

      // Standard unsuccessful login
      if (!res.ok || !data?.ok) {
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);

        if (newAttempts >= 3) {
          const cooldown = 30;
          setLoginCooldown(cooldown);
          setMessage("❌ Too many failed attempts. Please wait 30 seconds.");
        } else {
          setMessage(`❌ ${data?.error || "Login failed"}. ${3 - newAttempts} attempts remaining.`);
        }
        return;
      }

      // Success
      setLoginAttempts(0);
      setMessage("✅ Login successful! Redirecting…");
      // Let cookie commit then navigate
      await new Promise((r) => setTimeout(r, 0));
      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      console.error(err);
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      if (newAttempts >= 3) {
        setLoginCooldown(30);
        setMessage("❌ Too many failed attempts. Please wait 30 seconds.");
      } else {
        setMessage(`❌ Network error. ${3 - newAttempts} attempts remaining.`);
      }
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    // Check cooldown
    if (registerCooldown > 0) {
      setMessage(`⏳ Too many attempts. Please wait ${registerCooldown} seconds.`);
      return;
    }

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
        const newAttempts = registerAttempts + 1;
        setRegisterAttempts(newAttempts);

        if (newAttempts >= 3) {
          setRegisterCooldown(30);
          setMessage("❌ Too many failed attempts. Please wait 30 seconds.");
        } else {
          setMessage(`❌ ${data.error || "Registration failed"}. ${3 - newAttempts} attempts remaining.`);
        }
      } else {
        // Success - reset attempts
        setRegisterAttempts(0);
        setMessage("✅ Registration successful! Check your email for verification link.");
        setRegisterPassword("");
        setName("");
        setTimeout(() => setActiveTab("login"), 2000);
      }
    } catch (err: any) {
      console.error(err);
      const newAttempts = registerAttempts + 1;
      setRegisterAttempts(newAttempts);

      if (newAttempts >= 3) {
        setRegisterCooldown(30);
        setMessage("❌ Too many failed attempts. Please wait 30 seconds.");
      } else {
        setMessage(`❌ Network error. ${3 - newAttempts} attempts remaining.`);
      }
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
              <button
                type="submit"
                disabled={loginCooldown > 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loginCooldown > 0 ? `Wait ${loginCooldown}s` : "Login"}
              </button>
              <button
                type="button"
                onClick={() => checkStatus()}
                className="px-3 py-2 bg-slate-700 rounded-lg hover:bg-slate-600"
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
              disabled={registerBusy || registerCooldown > 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {registerCooldown > 0 ? `Wait ${registerCooldown}s` : registerBusy ? "Registering..." : "Register"}
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
                className="flex-1 bg-green-600 hover:bg-green-700 p-2 rounded disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Keep my account"}
              </button>
              <button
                onClick={() => {
                  setMessage("You can still login to cancel deletion from your account page.");
                }}
                className="px-3 py-2 bg-slate-700 rounded hover:bg-slate-600"
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
