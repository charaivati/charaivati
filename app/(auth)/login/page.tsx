// app/(auth)/login/page.tsx
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type StatusResp = {
  exists?: boolean;
  deletionScheduledAt?: string | null;
  deletedAt?: string | null;
  avatarUrl?: string | null;
  name?: string | null;
};

/**
 * Helper to safely extract an error message from unknown
 */
function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return String(err);
  } catch {
    return "Unknown error";
  }
}

// Separate component that uses useSearchParams
function AuthForm() {
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

  // Abort controller ref for checkStatus so fast repeated calls cancel previous
  const statusAbortRef = useRef<AbortController | null>(null);

  // Prefill form + show message after registration
  useEffect(() => {
    if (registered) {
      setMessage(`📧 Verification link sent to ${prefillEmail || "your email"}.`);
      setActiveTab("login");
    }
    if (prefillEmail) {
      setEmail(prefillEmail);
      void checkStatus(prefillEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registered, prefillEmail]);

  // Login cooldown timer
  useEffect(() => {
    if (loginCooldown > 0) {
      const timer = setTimeout(() => setLoginCooldown((s) => s - 1), 1000);
      return () => clearTimeout(timer);
    } else if (loginCooldown === 0 && loginAttempts >= 3) {
      setLoginAttempts(0);
    }
  }, [loginCooldown, loginAttempts]);

  // Register cooldown timer
  useEffect(() => {
    if (registerCooldown > 0) {
      const timer = setTimeout(() => setRegisterCooldown((s) => s - 1), 1000);
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

  /**
   * checkStatus:
   * - Prefer POST /api/user/status with JSON body to avoid leaking email in URL.
   * - If server doesn't accept POST, fallback to GET query param.
   *
   * Note: If you update server to accept POST, keep the POST branch.
   */
  async function checkStatus(checkEmail?: string) {
    const e = checkEmail ?? email;
    if (!e) return;
    // Abort previous request if still ongoing
    statusAbortRef.current?.abort();
    const ac = new AbortController();
    statusAbortRef.current = ac;

    try {
      setCheckingStatus(true);

      // Try POST first (preferred for privacy). If server returns 405/4xx, fallback to GET.
      const postRes = await fetch("/api/user/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: e }),
        signal: ac.signal,
      }).catch((err) => {
        // network/abort error — rethrow for outer catch
        throw err;
      });

      let j: StatusResp = {};
      if (postRes.ok) {
        j = await postRes.json().catch(() => ({} as StatusResp));
      } else if (postRes.status === 405 || postRes.status === 400) {
        // Server doesn't support POST -> fallback to GET (legacy)
        const getRes = await fetch(
          `/api/user/status?email=${encodeURIComponent(e)}`,
          {
            method: "GET",
            headers: { Accept: "application/json" },
            credentials: "include",
            signal: ac.signal,
          }
        );
        j = await getRes.json().catch(() => ({} as StatusResp));
      } else {
        // Server returned an error for POST; try to parse JSON body for an error message
        try {
          const errBody = await postRes.json().catch(() => null);
          console.warn("status check POST error", postRes.status, errBody);
        } catch {
          /* ignore */
        }
        j = {};
      }

      setStatus(j);
    } catch (err: unknown) {
      if ((err as any)?.name === "AbortError") {
        // request was aborted — ignore
        return;
      }
      console.error("status check failed", err);
      // don't show raw error to user; show friendly message
      setMessage("Unable to check account status right now.");
    } finally {
      setCheckingStatus(false);
      statusAbortRef.current = null;
    }
  }

  async function cancelDeletion() {
    if (!email) {
      setMessage("Please enter the account email to cancel deletion.");
      return;
    }

    try {
      setCancelling(true);
      const res = await fetch("/api/user/cancel-delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        const errMsg = (j && (j.error || j.message)) || res.statusText;
        setMessage("❌ Could not cancel deletion: " + errMsg);
        return;
      }
      setMessage("✅ Account deletion cancelled. You can now login.");
      await checkStatus();
    } catch (err: unknown) {
      console.error("cancelDeletion error", err);
      setMessage("Network error while cancelling. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

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

      if (res.status === 429) {
        const retryAfterHeader = res.headers.get("Retry-After");
        const retrySec =
          retryAfterHeader && !Number.isNaN(Number(retryAfterHeader))
            ? parseInt(retryAfterHeader, 10)
            : null;

        if (retrySec && retrySec > 0) {
          setLoginCooldown(retrySec);
          setMessage(`❌ Too many attempts. Please wait ${retrySec} seconds.`);
        } else {
          setMessage("❌ Too many requests. Please try again later.");
        }
        return;
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (
        res.status === 403 ||
        data?.error === "account_locked" ||
        data?.error === "Please verify your email first" ||
        data?.error === "captcha_required"
      ) {
        const retryAfterHeader = res.headers.get("Retry-After");
        const retrySec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;

        if (data?.error === "Please verify your email first") {
          setMessage(
            "❌ Please verify your email first. Check your inbox for the verification link."
          );
        } else if (data?.error === "captcha_required") {
          setMessage("❌ Please complete the CAPTCHA to continue.");
        } else {
          setMessage(data?.message || "❌ Account locked. Try again later.");
        }

        if (retrySec && !Number.isNaN(retrySec) && retrySec > 0) {
          setLoginCooldown(retrySec);
        }
        return;
      }

      if (!res.ok || !data?.ok) {
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);

        if (newAttempts >= 3) {
          const cooldown = 30;
          setLoginCooldown(cooldown);
          setMessage("❌ Too many failed attempts. Please wait 30 seconds.");
        } else {
          setMessage(
            `❌ ${data?.error || "Login failed"}. ${3 - newAttempts} attempts remaining.`
          );
        }
        return;
      }

      setLoginAttempts(0);
      setMessage("✅ Login successful! Redirecting…");
      await new Promise((r) => setTimeout(r, 0));
      // replace and refresh
      router.replace(redirectTo);
      router.refresh();
    } catch (err: unknown) {
      console.error("login error", err);
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
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const newAttempts = registerAttempts + 1;
        setRegisterAttempts(newAttempts);

        if (newAttempts >= 3) {
          setRegisterCooldown(30);
          setMessage("❌ Too many failed attempts. Please wait 30 seconds.");
        } else {
          setMessage(
            `❌ ${data.error || "Registration failed"}. ${3 - newAttempts} attempts remaining.`
          );
        }
      } else {
        setRegisterAttempts(0);
        setMessage("✅ Registration successful! Check your email for verification link.");
        setRegisterPassword("");
        setName("");
        setTimeout(() => setActiveTab("login"), 2000);
      }
    } catch (err: unknown) {
      console.error("register error", err);
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
              onBlur={() => void checkStatus()}
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
                onClick={() => void checkStatus()}
                className="px-3 py-2 bg-slate-700 rounded-lg hover:bg-slate-600"
                disabled={checkingStatus}
              >
                {checkingStatus ? "Checking…" : "Check"}
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
              {registerCooldown > 0
                ? `Wait ${registerCooldown}s`
                : registerBusy
                ? "Registering..."
                : "Register"}
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
                // eslint-disable-next-line @next/next/no-img-element
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

// Main export wrapped in Suspense
export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-black text-white">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        </main>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
