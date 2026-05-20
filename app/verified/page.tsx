"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

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

function VerifiedContent() {
  const sp = useSearchParams();
  const email = sp?.get("email") ?? "";
  const safeRedirect = sanitizeRedirect(sp?.get("redirect")) ?? "/self";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0F172A",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        background: "#1E293B",
        borderRadius: 24,
        padding: 40,
        maxWidth: 400,
        width: "100%",
        textAlign: "center",
        border: "1px solid #334155",
      }}>
        {/* Success icon */}
        <div style={{
          width: 72, height: 72,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8B5CF6)",
          display: "flex", alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
          fontSize: 32,
        }}>
          ✓
        </div>

        <h1 style={{
          color: "#F1F5F9",
          fontSize: 24,
          fontWeight: 700,
          margin: "0 0 8px",
        }}>
          Email Verified!
        </h1>

        <p style={{
          color: "#94A3B8",
          fontSize: 15,
          lineHeight: 1.6,
          margin: "0 0 32px",
        }}>
          {email
            ? `${email} is now verified.`
            : "Your email is now verified."}
          {" "}Sign in to continue.
        </p>

        <a href={`/login?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(safeRedirect)}`}
          style={{
            display: "block",
            padding: "14px 24px",
            borderRadius: 12,
            background: "linear-gradient(135deg, #6366f1, #8B5CF6)",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 15,
          }}>
          Sign in to continue →
        </a>

        <p style={{
          color: "#475569",
          fontSize: 12,
          marginTop: 24,
        }}>
          charaivati
        </p>
      </div>
    </div>
  );
}

export default function VerifiedPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh", background: "#0F172A",
        display: "flex", alignItems: "center",
        justifyContent: "center", color: "#94A3B8",
      }}>
        Verifying...
      </div>
    }>
      <VerifiedContent />
    </Suspense>
  );
}
