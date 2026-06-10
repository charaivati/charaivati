//app/(auth)/login/page.tsx
"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Mail, Lock, User, Phone, Eye, EyeOff, MailCheck } from "lucide-react";
import Wordmark from "@/components/brand/Wordmark";
import { useLanguage } from "@/components/LanguageProvider";

type StatusResp = {
  exists?: boolean;
  deletionScheduledAt?: string | null;
  deletedAt?: string | null;
  avatarUrl?: string | null;
  name?: string | null;
};

const AUTH_SLUGS = [
  "auth-welcome-title","auth-welcome-subtitle","auth-welcome-back","auth-create-title",
  "auth-email-label","auth-email-placeholder","auth-email-hint","auth-continue-btn","auth-checking",
  "auth-password-label","auth-password-placeholder","auth-login-btn","auth-logging-in","auth-diff-email",
  "auth-name-label","auth-name-placeholder","auth-email-label-2","auth-password-hint",
  "auth-create-btn","auth-creating","auth-guest-btn","auth-guest-hint",
  "auth-terms-prefix","auth-terms-link","auth-too-many-attempts",
  "auth-msg-logging-in","auth-msg-login-ok","auth-msg-login-fail","auth-msg-network-error",
  "auth-msg-creating-account","auth-msg-account-ok","auth-msg-reg-fail",
  "auth-msg-creating-guest","auth-msg-guest-ok","auth-msg-guest-fail",
  "auth-msg-email-required","auth-msg-email-error",
].join(",");

function StepCard({
  children,
  ...props
}: { children: React.ReactNode } & React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

function AuthForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const { locale } = useLanguage();

  const [tMap, setTMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!locale || locale === "en") { setTMap({}); return; }
    fetch(`/api/tab-translations?locale=${encodeURIComponent(locale)}&slugs=${encodeURIComponent(AUTH_SLUGS)}`)
      .then(r => r.json())
      .then(json => {
        if (!json.ok) return;
        const map: Record<string, string> = {};
        for (const [slug, v] of Object.entries(json.translations as Record<string, any>)) {
          if (v?.title) map[slug] = v.title;
        }
        setTMap(map);
      })
      .catch(() => {});
  }, [locale]);

  const t = useCallback((slug: string, fallback: string) => tMap[slug] || fallback, [tMap]);

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

  let redirectTo =
  validateRedirect(initialRedirect) ||
  (sp?.get("container") === "app" ? "/app/home" : null) ||
  "/self";
  if (redirectTo === "/login" || redirectTo.startsWith("/login?"))
    redirectTo = "/self";

  useEffect(() => {
    try {
      if (redirectTo)
        sessionStorage.setItem("charaivati.redirect", redirectTo);
    } catch {}
  }, [redirectTo]);

  // State machine
  const [step, setStep] = useState<"email" | "login" | "register" | "verify-pending">("email");
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

  // Phone OTP login state
  const [loginMode, setLoginMode] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<"phone" | "otp">("phone");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isPhoneSubmitting, setIsPhoneSubmitting] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Verify-pending state
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendVerifyMessage, setResendVerifyMessage] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
      return () => clearTimeout(timer);
    } else if (cooldown === 0 && attempts >= 3) setAttempts(0);
  }, [cooldown, attempts]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    setShowPassword(false);
  }, [step]);

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

      if (!res.ok) {
        setMessage("⚠️ " + t(
          "auth-msg-server-unavailable",
          "Service temporarily unavailable. Please try again in a moment."
        ));
        return;
      }

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
      setMessage(t("auth-msg-email-error", "Error checking email. Please try again."));
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogin() {
    if (cooldown > 0)
      return setMessage(`⏳ Wait ${cooldown}s before retrying.`);

    setMessage(t("auth-msg-logging-in", "Logging in..."));
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
        setMessage("❌ " + (data?.error || t("auth-msg-login-fail", "Login failed")));
        return;
      }

      setMessage("✅ " + t("auth-msg-login-ok", "Login successful! Redirecting..."));
      if (data.preferredLanguage && data.preferredLanguage !== "en") {
        try { localStorage.setItem("lang", data.preferredLanguage); } catch {}
      }
      await new Promise((r) => setTimeout(r, 200));
      await router.replace(redirectTo);
      try {
        sessionStorage.removeItem("charaivati.redirect");
      } catch {}
      router.refresh();
    } catch (err) {
      console.error("login error", err);
      setMessage(t("auth-msg-network-error", "Network error. Please retry."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegister() {
    if (cooldown > 0)
      return setMessage(`⏳ Wait ${cooldown}s before retrying.`);

    setMessage(t("auth-msg-creating-account", "Creating your account..."));
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
        setMessage("❌ " + (data.message || t("auth-msg-reg-fail", "Registration failed. Please try again.")));
        return;
      }

      setStep("verify-pending");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGuestLogin() {
    setMessage(t("auth-msg-creating-guest", "Creating a guest session..."));
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/user/guest", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setMessage("❌ " + t("auth-msg-guest-fail", "Unable to start guest session. Please try again."));
        return;
      }
      setMessage("✅ " + t("auth-msg-guest-ok", "Guest session ready! Redirecting..."));
      await new Promise((r) => setTimeout(r, 200));
      await router.replace(redirectTo);
      try {
        sessionStorage.removeItem("charaivati.redirect");
      } catch {}
      router.refresh();
    } catch (err) {
      console.error("guest login error", err);
      setMessage(t("auth-msg-network-error", "Network error. Please retry."));
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

  function switchMode(mode: "email" | "phone") {
    setLoginMode(mode);
    setPhoneStep("phone");
    setPhone("");
    setOtpDigits(["", "", "", "", "", ""]);
    setPhoneMessage("");
    setResendCooldown(0);
    setStep("email");
    setMessage("");
  }

  async function sendOtpRequest(fullPhone: string): Promise<boolean> {
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: fullPhone, targetType: "PHONE" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setPhoneMessage("❌ " + (data?.error || "Failed to send OTP"));
        return false;
      }
      return true;
    } catch {
      setPhoneMessage("❌ Network error. Please try again.");
      return false;
    }
  }

  async function handlePhoneSubmit() {
    if (!phone.trim()) {
      setPhoneMessage("Please enter your phone number");
      return;
    }
    const fullPhone = `+91${phone.trim()}`;
    setIsPhoneSubmitting(true);
    setPhoneMessage("");
    const ok = await sendOtpRequest(fullPhone);
    setIsPhoneSubmitting(false);
    if (ok) {
      setResendCooldown(30);
      setPhoneStep("otp");
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    const fullPhone = `+91${phone.trim()}`;
    setIsPhoneSubmitting(true);
    setPhoneMessage("");
    const ok = await sendOtpRequest(fullPhone);
    setIsPhoneSubmitting(false);
    if (ok) setResendCooldown(30);
  }

  async function handleResendVerification() {
    if (resendingVerification) return;
    setResendingVerification(true);
    setResendVerifyMessage("");
    try {
      const res = await fetch("/api/auth/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirect: redirectTo }),
      });
      if (!res.ok) {
        setResendVerifyMessage("failed");
      } else {
        setResendVerifyMessage("sent");
        setTimeout(() => setResendVerifyMessage(""), 3000);
      }
    } catch {
      setResendVerifyMessage("failed");
    } finally {
      setResendingVerification(false);
    }
  }

  async function handleOtpVerify() {
    const code = otpDigits.join("");
    if (code.length < 6) {
      setPhoneMessage("Please enter all 6 digits");
      return;
    }
    const fullPhone = `+91${phone.trim()}`;
    setIsPhoneSubmitting(true);
    setPhoneMessage("Verifying...");
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target: fullPhone, targetType: "PHONE", code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setPhoneMessage("❌ " + (data?.error || "Invalid OTP"));
        return;
      }
      setPhoneMessage("✅ Verified! Redirecting...");
      await new Promise((r) => setTimeout(r, 200));
      await router.replace(redirectTo);
      try { sessionStorage.removeItem("charaivati.redirect"); } catch {}
      router.refresh();
    } catch {
      setPhoneMessage("❌ Network error. Please try again.");
    } finally {
      setIsPhoneSubmitting(false);
    }
  }

  function handleOtpDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black text-white p-4">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-indigo-600/20 blur-[130px]" />
        <div className="absolute -bottom-56 -right-32 w-[520px] h-[520px] rounded-full bg-violet-700/15 blur-[130px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo/Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center mb-8"
        >
          <p className="mb-3">
            <Wordmark size="sm" />
          </p>
          <h1 className="text-3xl font-bold mb-2">{t("auth-welcome-title", "Welcome")}</h1>
          <p className="text-gray-400">{t("auth-welcome-subtitle", "Sign in or create an account to continue")}</p>
        </motion.div>

        {/* Email / Phone Mode Toggle — hidden after registration succeeds */}
        {step !== "verify-pending" && (
          <div className="flex rounded-lg bg-white/5 border border-white/10 p-1 gap-1 mb-4">
            <button
              onClick={() => switchMode("email")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                loginMode === "email"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Email
            </button>
            <button
              onClick={() => switchMode("phone")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
                loginMode === "phone"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Phone
            </button>
          </div>
        )}

        {/* Email Flow */}
        {loginMode === "email" && (
          <AnimatePresence mode="wait" initial={false}>
            {/* Email Step */}
            {step === "email" && (
              <StepCard key="email" className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    {t("auth-email-label", "Email Address")}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                      placeholder={t("auth-email-placeholder", "you@example.com")}
                      className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/50 border border-gray-600 focus:border-blue-500 focus:outline-none transition"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t("auth-email-hint", "We'll check if you have an account or help you create one")}
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
                      {t("auth-checking", "Checking...")}
                    </>
                  ) : (
                    <>
                      {t("auth-continue-btn", "Continue")}
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

              </StepCard>
            )}

            {/* Login Step */}
            {step === "login" && (
              <StepCard key="login" className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
                <h2 className="text-xl font-semibold text-center mb-6">{t("auth-welcome-back", "Welcome Back!")}</h2>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    {t("auth-email-label-2", "Email")}
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
                    {t("auth-password-label", "Password")}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      placeholder={t("auth-password-placeholder", "Enter your password")}
                      className="w-full pl-10 pr-12 py-3 rounded-lg bg-black/50 border border-gray-600 focus:border-blue-500 focus:outline-none transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300 transition"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
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
                    {t("auth-too-many-attempts", "Too many attempts. Please wait")} {cooldown}s.
                  </div>
                )}

                <button
                  onClick={handleLogin}
                  disabled={isSubmitting || cooldown > 0}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-lg font-semibold transition"
                >
                  {isSubmitting ? t("auth-logging-in", "Logging in...") : t("auth-login-btn", "Login")}
                </button>

                <button
                  onClick={handleBackToEmail}
                  className="w-full p-3 rounded-lg font-semibold border border-gray-600 hover:border-gray-500 hover:bg-white/5 transition"
                >
                  {t("auth-diff-email", "Use different email")}
                </button>
              </StepCard>
            )}

            {/* Register Step */}
            {step === "register" && (
              <StepCard key="register" className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
                <h2 className="text-xl font-semibold text-center mb-2">{t("auth-create-title", "Create Your Account")}</h2>
                {message && (
                  <p className="text-center text-sm text-gray-300 mb-4">{message}</p>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    {t("auth-name-label", "Full Name")}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("auth-name-placeholder", "John Doe")}
                      className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/50 border border-gray-600 focus:border-emerald-500 focus:outline-none transition"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">
                    {t("auth-email-label-2", "Email")}
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
                    {t("auth-password-label", "Password")}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                      placeholder={t("auth-password-hint", "At least 8 characters")}
                      className="w-full pl-10 pr-12 py-3 rounded-lg bg-black/50 border border-gray-600 focus:border-emerald-500 focus:outline-none transition"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-3.5 text-gray-500 hover:text-gray-300 transition"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">{t("auth-password-hint", "Must be at least 8 characters")}</p>
                </div>

                {message && message.includes("❌") && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-200">
                    {message}
                  </div>
                )}

                {cooldown > 0 && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-200">
                    {t("auth-too-many-attempts", "Too many attempts. Please wait")} {cooldown}s.
                  </div>
                )}

                <button
                  onClick={handleRegister}
                  disabled={isSubmitting || cooldown > 0}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-lg font-semibold transition"
                >
                  {isSubmitting ? t("auth-creating", "Creating account...") : t("auth-create-btn", "Create Account")}
                </button>

                <button
                  onClick={handleBackToEmail}
                  className="w-full p-3 rounded-lg font-semibold border border-gray-600 hover:border-gray-500 hover:bg-white/5 transition"
                >
                  {t("auth-diff-email", "Use different email")}
                </button>
              </StepCard>
            )}

            {/* Verify Pending Step */}
            {step === "verify-pending" && (
              <StepCard key="verify-pending" className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm text-center space-y-4">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                  className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center"
                >
                  <MailCheck className="w-7 h-7 text-emerald-400" />
                </motion.div>
                <h2 className="text-lg font-semibold">Check your inbox</h2>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Account created! We&apos;ve sent a verification link to{" "}
                  <span className="text-white font-medium">{email}</span>. Click it to activate
                  your account, then come back to sign in.
                </p>

                <button
                  onClick={() => setStep("login")}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 p-3 rounded-lg font-semibold transition"
                >
                  I&apos;ve verified — sign in
                </button>

                <button
                  onClick={handleResendVerification}
                  disabled={resendingVerification}
                  className="w-full p-3 rounded-lg text-sm font-medium border border-gray-600 hover:border-gray-500 hover:bg-white/5 disabled:opacity-50 transition"
                >
                  {resendingVerification
                    ? "Sending…"
                    : resendVerifyMessage === "sent"
                    ? "✅ Email sent again"
                    : "Resend verification email"}
                </button>
                {resendVerifyMessage === "failed" && (
                  <p className="text-xs text-rose-400">Couldn&apos;t resend right now — try again in a moment.</p>
                )}
                <p className="text-xs text-gray-500">Didn&apos;t get it? Check your spam folder.</p>
              </StepCard>
            )}
          </AnimatePresence>
        )}

        {/* Phone Flow */}
        {loginMode === "phone" && (
          <AnimatePresence mode="wait" initial={false}>
            {/* Phone Number Step */}
            {phoneStep === "phone" && (
              <StepCard key="phone" className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
                <h2 className="text-xl font-semibold text-center mb-6">Sign in with Phone</h2>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Phone Number</label>
                  <div className="flex gap-2">
                    <div className="flex items-center px-3 rounded-lg bg-black/50 border border-gray-600 text-gray-300 text-sm font-medium select-none whitespace-nowrap">
                      +91
                    </div>
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={(e) => e.key === "Enter" && handlePhoneSubmit()}
                        placeholder="9876543210"
                        maxLength={10}
                        className="w-full pl-10 pr-4 py-3 rounded-lg bg-black/50 border border-gray-600 focus:border-indigo-500 focus:outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                {phoneMessage && (
                  <div className={`p-3 rounded-lg text-sm ${
                    phoneMessage.includes("❌")
                      ? "bg-red-500/10 border border-red-500/20 text-red-200"
                      : "bg-blue-500/10 border border-blue-500/20 text-blue-200"
                  }`}>
                    {phoneMessage}
                  </div>
                )}

                <button
                  onClick={handlePhoneSubmit}
                  disabled={isPhoneSubmitting}
                  className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                >
                  {isPhoneSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Send OTP
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </StepCard>
            )}

            {/* OTP Verify Step */}
            {phoneStep === "otp" && (
              <StepCard key="otp" className="space-y-4 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
                <h2 className="text-xl font-semibold text-center mb-2">Enter OTP</h2>
                <p className="text-center text-sm text-gray-400 mb-4">
                  Sent to +91 {phone}
                </p>

                <div className="flex gap-2 justify-center">
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-11 h-12 text-center text-lg font-semibold rounded-lg bg-black/50 border border-gray-600 focus:border-indigo-500 focus:outline-none transition"
                    />
                  ))}
                </div>

                {phoneMessage && (
                  <div className={`p-3 rounded-lg text-sm ${
                    phoneMessage.includes("❌")
                      ? "bg-red-500/10 border border-red-500/20 text-red-200"
                      : phoneMessage.includes("✅")
                      ? "bg-green-500/10 border border-green-500/20 text-green-200"
                      : "bg-blue-500/10 border border-blue-500/20 text-blue-200"
                  }`}>
                    {phoneMessage}
                  </div>
                )}

                <button
                  onClick={handleOtpVerify}
                  disabled={isPhoneSubmitting || otpDigits.join("").length < 6}
                  className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed p-3 rounded-lg font-semibold transition"
                >
                  {isPhoneSubmitting ? "Verifying..." : "Verify OTP"}
                </button>

                <button
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isPhoneSubmitting}
                  className="w-full p-3 rounded-lg font-semibold border border-gray-600 hover:border-gray-500 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                >
                  {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
                </button>

                <button
                  onClick={() => setPhoneStep("phone")}
                  className="w-full p-3 rounded-lg font-semibold border border-gray-600 hover:border-gray-500 hover:bg-white/5 transition text-sm"
                >
                  Change number
                </button>
              </StepCard>
            )}
          </AnimatePresence>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
        >
          {step !== "verify-pending" && (
            <div className="mt-4">
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[11px] uppercase tracking-wider text-gray-600">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <button
                onClick={handleGuestLogin}
                disabled={isSubmitting || checkingStatus}
                className="w-full p-3 rounded-lg font-semibold border border-gray-600 hover:border-gray-500 hover:bg-white/5 disabled:opacity-50 transition"
              >
                {t("auth-guest-btn", "Skip for now (Continue as guest)")}
              </button>
              <p className="text-center text-xs text-gray-500 mt-2">
                {t("auth-guest-hint", "Guest mode is read-only until you log in or register.")}
              </p>
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-gray-500 mt-6">
            {t("auth-terms-prefix", "By continuing, you agree to our")}{" "}
            <Link href="/terms-of-service" className="underline hover:text-gray-300">
              {t("auth-terms-link", "terms of service")}
            </Link>
          </p>
        </motion.div>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-indigo-600/20 blur-[130px]" />
          </div>
          <div className="relative text-center">
            <p style={{ animation: "fade-up 0.5s ease-out both" }}>
              <Wordmark size="md" />
            </p>
            <div
              className="mt-6 mx-auto h-[3px] w-32 rounded-full bg-white/10 overflow-hidden"
              style={{ animation: "fade-up 0.5s ease-out 0.15s both" }}
            >
              <div
                className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent"
                style={{ animation: "splash-sweep 1.2s ease-in-out infinite" }}
              />
            </div>
          </div>
        </main>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
