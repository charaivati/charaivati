export default function NotificationsLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB" }}>
      {/* Header placeholder */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 56, zIndex: 10 }}>
        <div className="animate-pulse" style={{ width: 16, height: 16, background: "#E2E8F0", borderRadius: 4 }} />
        <div className="animate-pulse" style={{ width: 110, height: 16, background: "#E2E8F0", borderRadius: 4 }} />
      </div>
      {/* Notification row placeholders */}
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", margin: 12, border: "1px solid #E5E7EB" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "14px 16px", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ paddingTop: 6, flexShrink: 0, width: 8 }}>
                <div className="animate-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#E2E8F0" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                  <div className="animate-pulse" style={{ width: "55%", height: 14, borderRadius: 4, background: "#E2E8F0" }} />
                  <div className="animate-pulse" style={{ width: 36, height: 10, borderRadius: 4, background: "#F1F5F9", flexShrink: 0 }} />
                </div>
                <div className="animate-pulse" style={{ width: "80%", height: 12, borderRadius: 4, background: "#F1F5F9" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
