"use client";
// app/(auth)/change-password/page.tsx
// Shown after login when mustChangePassword === true (admin-created accounts).
// Also reachable voluntarily from account settings.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Detect whether this is a forced change (came from login redirect)
  // by checking if there's a "forced" query param or if we can infer it.
  // We leave the currentPassword field visible for voluntary changes.

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword, currentPassword: currentPassword || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setDone(true);
      setTimeout(() => router.replace("/self"), 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main style={wrap}>
        <div style={card}>
          <p style={logo}>चरैवेति · Charaivati</p>
          <h1 style={h1}>Password updated</h1>
          <p style={body}>Taking you in…</p>
        </div>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <div style={card}>
        <p style={logo}>चरैवेति · Charaivati</p>
        <h1 style={h1}>Set a new password</h1>
        <p style={body}>Choose a password you haven't used before.</p>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={label}>Current password (if you know it)</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Leave blank if not set"
              style={input}
              autoComplete="current-password"
            />
          </div>

          <div>
            <label style={label}>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
              style={input}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label style={label}>Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="Repeat password"
              style={input}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: "14px", color: "#dc2626" }}>{error}</p>
          )}

          <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.6 : 1 }}>
            {loading ? "Saving…" : "Save password"}
          </button>
        </form>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f4f4f5",
  padding: "1rem",
};
const card: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e4e4e7",
  padding: "2rem",
  maxWidth: "400px",
  width: "100%",
  fontFamily: "system-ui, -apple-system, sans-serif",
};
const logo: React.CSSProperties = {
  fontSize: "13px",
  color: "#71717a",
  letterSpacing: "0.04em",
  marginTop: 0,
  marginBottom: "1.5rem",
};
const h1: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 500,
  color: "#18181b",
  marginTop: 0,
  marginBottom: "0.5rem",
};
const body: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: 1.6,
  color: "#52525b",
  marginTop: 0,
  marginBottom: "1.5rem",
};
const label: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  color: "#3f3f46",
  marginBottom: "4px",
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d4d4d8",
  borderRadius: "6px",
  fontSize: "15px",
  boxSizing: "border-box",
};
const btn: React.CSSProperties = {
  padding: "13px",
  background: "#D85A30",
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  fontSize: "15px",
  fontWeight: 600,
  cursor: "pointer",
};
