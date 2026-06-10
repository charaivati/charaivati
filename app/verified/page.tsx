"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Wordmark from "@/components/brand/Wordmark";

function sanitizeRedirect(candidate: string | null): string | null {
  if (!candidate || typeof candidate !== "string") return null;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return null;
  if (candidate.length > 2048) return null;
  try {
    const u = new URL(candidate, "http://example.invalid");
    return u.pathname + (u.search || "") + (u.hash || "");
  } catch {
    return null;
  }
}

function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-emerald-600/15 blur-[130px]" />
      <div className="absolute -bottom-56 -right-32 w-[520px] h-[520px] rounded-full bg-indigo-700/15 blur-[130px]" />
    </div>
  );
}

function VerifiedContent() {
  const sp = useSearchParams();
  const email = sp?.get("email") ?? "";
  const safeRedirect = sanitizeRedirect(sp?.get("redirect")) ?? "/self";

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black text-white p-6">
      <AmbientBackground />
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative w-full max-w-sm bg-white/5 border border-white/10 rounded-3xl p-10 backdrop-blur-sm text-center"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.15 }}
          className="mx-auto mb-6 w-[72px] h-[72px] rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/40"
        >
          <Check className="w-9 h-9 text-white" strokeWidth={3} />
        </motion.div>

        <h1 className="text-2xl font-bold mb-2">Email verified!</h1>

        <p className="text-sm text-gray-400 leading-relaxed mb-8">
          {email ? `${email} is now verified.` : "Your email is now verified."}{" "}
          Sign in to continue.
        </p>

        <a
          href={`/login?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(safeRedirect)}`}
          className="block w-full p-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white no-underline font-semibold text-[15px] transition"
        >
          Sign in to continue →
        </a>

        <p className="mt-6">
          <Wordmark size="sm" className="opacity-60" />
        </p>
      </motion.div>
    </div>
  );
}

export default function VerifiedPage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-emerald-600/15 blur-[130px]" />
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
                className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                style={{ animation: "splash-sweep 1.2s ease-in-out infinite" }}
              />
            </div>
          </div>
        </div>
      }
    >
      <VerifiedContent />
    </Suspense>
  );
}
