// app/claim-error/page.tsx
export default function ClaimErrorPage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f5", padding: "1rem" }}>
      <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e4e4e7", padding: "2rem", maxWidth: "440px", width: "100%", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <p style={{ fontSize: "13px", color: "#71717a", letterSpacing: "0.04em", marginTop: 0, marginBottom: "1.5rem" }}>चरैवेति · Charaivati</p>
        <h1 style={{ fontSize: "22px", fontWeight: 500, color: "#18181b", marginTop: 0, marginBottom: "0.75rem" }}>
          This invite link is invalid or has expired.
        </h1>
        <p style={{ fontSize: "15px", lineHeight: 1.6, color: "#52525b", marginTop: 0, marginBottom: "1.5rem" }}>
          Ask your friend to send a fresh invite link.
        </p>
        <a href="/login" style={{ display: "inline-block", padding: "13px 28px", background: "#18181b", color: "#ffffff", textDecoration: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 600 }}>
          Back to sign in
        </a>
      </div>
    </main>
  );
}
