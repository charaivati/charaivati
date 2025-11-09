"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Mail, Lock, User } from "lucide-react";

type StatusResp = {
  exists?: boolean;
  deletionScheduledAt?: string | null;
  deletedAt?: string | null;
  avatarUrl?: string | null;
  name?: string | null;
};

function AuthForm() {
  const router = useRouter();
  const sp = useSearchParams();

  const prefillEmail = sp?.get("email") || "";

  // --- redirect management ---
  function validateRedirect(candidate?: string | null): string | null {
    if (!candidate || typeof candidate !== "string") return null;
    if (!candidate.startsWith("/")) return null;
    if (candidate.startsWith("//")) return null;
    if (candidate.length > 2048) return null;
    try {
      const u = new URL(candidate, "http://example.invalid");
      return u.pathname + (u.search || "") + (u.hash || "");
    } catch {
      return null;
    }
  }

  let initialRedirect = sp?.get("redirect") || null;
  if (!initialRedirect) {
    try {
      initialRedirect = sessionStorage.getItem("charaivati.redirect");
    } catch {
      initialRedirect = null;
    }
  }

  let redirectTo = validateRedirect(initialRedirect) || "/self";
  if (redirectTo === "/login" || redirectTo.startsWith("/login?"))
    redirectTo = "/self";

  useEffect(() => {
    try {
      if (redirectTo)
        sessionStorage.setItem("charaivati.redirect", redirectTo);
    } catch {}
  }, [redirectTo]);

  // State machine
  const [step, setStep] = useState<"email" | "login" | "register">("email");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const [status, setStatus] = useState<StatusResp | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  const statusAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
      return () => clearTimeout(timer);
    } else if (cooldown === 0 && attempts >= 3) setAttempts(0);
  }, [cooldown, attempts]);

  async function checkStatus(checkEmail?: string) {
    const e = checkEmail ?? email;
    if (!e) return;

    statusAbortRef.current?.abort();
    const ac = new AbortController();
    statusAbortRef.current = ac;

    try {
      setCheckingStatus(true);
      const res = await fetch(`/api/user/status?email=${encodeURIComponent(e)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
        signal: ac.signal,
      });

      const j: StatusResp = res.ok ? await res.json().catch(() => ({})) : {};
      setStatus(j);
    } catch (err: any) {
      if (err?.name !== "AbortError") console.warn("Status check failed:", err);
    } finally {
      setCheckingStatus(false);
      statusAbortRef.current = null;
    }
  }

  async function handleEmailSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email.trim()) {
      setMessage("Please enter your email");
      return;
    }

    setMessage("");
    setIsSubmitting(true);
    
    try {
      const res = await fetch(`/api/user/status?email=${encodeURIComponent(email)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
      });

      const userData = res && res.ok ? await res.json().catch(() => ({})) : {};

      if (userData.exists && userData.emailVerified) {
        setStep("login");
        setMessage("");
      } else if (userData.exists && !userData.emailVerified) {
        setStep("register");
        setMessage("Your account is pending verification. Complete your registration:");
      } else {
        setStep("register");
        setMessage("");
      }
    } catch (err) {
      setMessage("Error checking email. Please try again.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogin() {
    if (cooldown > 0)
      return setMessage(`⏳ Wait ${cooldown}s before retrying.`);

    setMessage("Logging in...");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        redirect: "manual",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setAttempts((n) => n + 1);
        if (attempts + 1 >= 3) setCooldown(60);
        setMessage("❌ " + (data?.error || "Login failed"));
        return;
      }

      setMessage("✅ Login successful! Redirecting...");
      await new Promise((r) => setTimeout(r, 200));
      await router.replace(redirectTo);
      try {
        sessionStorage.removeItem("charaivati.redirect");
      } catch {}
      router.refresh();
    } catch (err) {
      console.error("login error", err);
      setMessage("Network error. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegister() {
    if (cooldown > 0)
      return setMessage(`⏳ Wait ${cooldown}s before retrying.`);

    setMessage("Creating your account...");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          redirect: redirectTo,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAttempts((n) => n + 1);
        if (attempts + 1 >= 3) setCooldown(60);
        setMessage("❌ " + (data.error || "Registration failed"));
        return;
      }

      setMessage("✅ Check your email for a verification link. Redirecting you to login...");
      setPassword("");
      setName("");
      await new Promise((r) => setTimeout(r, 2000));
      setStep("email");
      setEmail("");
      setMessage("");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackToEmail() {
    setStep("email");
    setPassword("");
    setName("");
    setMessage("");
    setAttempts(0);
    setCooldown(0);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black text-white p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome</h1>
          <p className="text-gray-400">Sign in or create an account to continue</p>
        </div>

        {/* Email Step */}
        {step === "email" && (
          <div className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/50 border border-gray-600 focus:border-blue-500 focus:outline-none transition"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                We'll check if you have an account or help you create one
              </p>
            </div>

            {message && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-200">
                {message}
              </div>
            )}

            <button
              onClick={handleEmailSubmit}
              disabled={isSubmitting || checkingStatus}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
            >
              {isSubmitting || checkingStatus ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Login Step */}
        {step === "login" && (
          <div className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-center mb-6">Welcome Back!</h2>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/50 border border-gray-600 text-gray-400 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/50 border border-gray-600 focus:border-blue-500 focus:outline-none transition"
                  required
                />
              </div>
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm ${
                message.includes("❌")
                  ? "bg-red-500/10 border border-red-500/20 text-red-200"
                  : "bg-green-500/10 border border-green-500/20 text-green-200"
              }`}>
                {message}
              </div>
            )}

            {cooldown > 0 && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-200">
                Too many attempts. Please wait {cooldown} seconds.
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={isSubmitting || cooldown > 0}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-lg font-semibold transition"
            >
              {isSubmitting ? "Logging in..." : "Login"}
            </button>

            <button
              onClick={handleBackToEmail}
              className="w-full p-3 rounded-lg font-semibold border border-gray-600 hover:border-gray-500 hover:bg-white/5 transition"
            >
              Use different email
            </button>
          </div>
        )}

        {/* Register Step */}
        {step === "register" && (
          <div className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-center mb-2">Create Your Account</h2>
            {message && (
              <p className="text-center text-sm text-gray-300 mb-4">{message}</p>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/50 border border-gray-600 focus:border-emerald-500 focus:outline-none transition"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/50 border border-gray-600 text-gray-400 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                  placeholder="At least 8 characters"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/50 border border-gray-600 focus:border-emerald-500 focus:outline-none transition"
                  minLength={8}
                  required
                />
              </div>
              <p className="text-xs text-gray-500">Must be at least 8 characters</p>
            </div>

            {message && message.includes("❌") && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-200">
                {message}
              </div>
            )}

            {cooldown > 0 && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-200">
                Too many attempts. Please wait {cooldown} seconds.
              </div>
            )}

            <button
              onClick={handleRegister}
              disabled={isSubmitting || cooldown > 0}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-lg font-semibold transition"
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
            </button>

            <button
              onClick={handleBackToEmail}
              className="w-full p-3 rounded-lg font-semibold border border-gray-600 hover:border-gray-500 hover:bg-white/5 transition"
            >
              Use different email
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          By continuing, you agree to our terms of service
        </p>
      </div>
    </main>
  );
}

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