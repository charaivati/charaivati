"use client";

const apps = [
  {
    id: "store",
    name: "Charaivati Store",
    description: "Manage your store, track orders, and shop from anywhere. Built for store owners and customers.",
    icon: "🏪",
    features: [
      "Create and manage your store",
      "Track orders in real time",
      "Save stores and products",
      "Cash on delivery checkout",
    ],
    apkUrl: "https://github.com/charaivati/charaivati/releases/latest/download/app-release.apk",
    appUrl: "/app/home",
    color: "#6366f1",
  },
];

export default function AppsPage() {
  return (
    <div style={{ background: "#F3F4F6", minHeight: "100vh" }}>

      {/* Header */}
      <header style={{
        background: "#131921", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", position: "sticky", top: 0, zIndex: 50,
      }}>
        <span style={{ color: "#fff", fontFamily: "monospace", fontSize: 13, letterSpacing: "0.1em" }}>
          charaivati
        </span>
        <button
          onClick={() => window.history.back()}
          style={{ color: "#fff", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
          ← Back
        </button>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 600, margin: "0 auto", padding: "32px 24px 48px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>Apps</h1>
        <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 28px" }}>
          Download Charaivati apps for a better experience
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {apps.map((app) => (
            <div key={app.id} style={{
              background: "#fff", borderRadius: 16, border: "1px solid #E5E7EB",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)", padding: "24px",
            }}>
              {/* App header */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                  background: `${app.color}18`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
                }}>
                  {app.icon}
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>
                    {app.name}
                  </h2>
                  <p style={{ fontSize: 13, color: "#6B7280", margin: 0, lineHeight: 1.5 }}>
                    {app.description}
                  </p>
                </div>
              </div>

              {/* Features */}
              <ul style={{ listStyle: "none", margin: "0 0 20px", padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                {app.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>
                    <span style={{ color: app.color, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a
                  href={app.apkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "10px 20px", borderRadius: 8, textDecoration: "none",
                    background: app.color, color: "#fff",
                    fontSize: 13, fontWeight: 600,
                  }}>
                  📱 Download APK
                </a>
                <a
                  href={app.appUrl}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "10px 20px", borderRadius: 8, textDecoration: "none",
                    background: "#fff", color: app.color,
                    border: `1.5px solid ${app.color}`,
                    fontSize: 13, fontWeight: 600,
                  }}>
                  ▶ Open App
                </a>
              </div>
              <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", margin: "12px 0 0" }}>
                Always download from charaivati.com/apps — the official source.
              </p>
            </div>
          ))}
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#9CA3AF", marginTop: 32 }}>
          More apps coming soon
        </p>
      </main>
    </div>
  );
}
