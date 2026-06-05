// app/admin/users/page.tsx
// Admin direct-create UI — accessible only to emails in ADMIN_EMAILS env var.
// Pattern mirrors app/admin/security/page.tsx (same cookie-based server auth).
"use client";
import { useState, useEffect } from "react";

export default function AdminUsersPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Verify admin status: 400 = admin (passed gate, bad input), 401/403 = not admin
  useEffect(() => {
    fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    }).then((r) => setIsAdmin(r.status === 400 || r.status === 409 || r.status === 200))
      .catch(() => setIsAdmin(false));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, tempPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus({ ok: true, msg: `Account created for ${email}.` });
        setEmail("");
        setTempPassword("");
      } else {
        setStatus({ ok: false, msg: data.error ?? "Failed." });
      }
    } catch {
      setStatus({ ok: false, msg: "Network error." });
    } finally {
      setLoading(false);
    }
  }

  if (isAdmin === null) {
    return <div style={{ padding: "2rem", color: "#94a3b8", fontFamily: "monospace" }}>Verifying…</div>;
  }
  if (isAdmin === false) {
    return <div style={{ padding: "2rem", color: "#f87171", fontFamily: "monospace" }}>Access denied.</div>;
  }

  return (
    <div style={{ fontFamily: "monospace", padding: "2rem", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: "0.25rem", color: "#f1f5f9" }}>Admin — Create User</h1>
      <p style={{ color: "#94a3b8", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
        Creates a <strong>lite</strong> account with a temporary password.
        The user must change their password on first login.
      </p>

      <form onSubmit={create} style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
            Target email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="user@example.com"
            style={{ width: "100%", padding: "9px 12px", background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
            Temporary password (min 8 chars)
          </label>
          <input
            type="password"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Tell the user this separately"
            style={{ width: "100%", padding: "9px 12px", background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" }}
          />
        </div>

        {status && (
          <p style={{ margin: 0, fontSize: "13px", color: status.ok ? "#4ade80" : "#f87171" }}>
            {status.msg}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ padding: "10px 20px", background: "#D85A30", color: "#fff", border: "none", borderRadius: "6px", fontSize: "14px", fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>

      <p style={{ marginTop: "2rem", fontSize: "12px", color: "#475569" }}>
        This action is logged server-side (admin ID + target email + timestamp).
        The user will be required to set a new password on first login.
        <br />
        <code>contactVerified</code> remains <em>false</em> until inbox ownership is verified separately.
      </p>
    </div>
  );
}
