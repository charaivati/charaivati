export default function OrdersLoading() {
  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh", paddingBottom: 80, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
        {/* Heading placeholder */}
        <div className="animate-pulse" style={{ width: 80, height: 18, background: "#E2E8F0", borderRadius: 4, margin: "16px 16px 8px" }} />
        {/* Tab bar placeholder */}
        <div style={{ display: "flex", background: "#fff", borderBottom: "0.5px solid #e2e8f0" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ flex: 1, padding: "14px 0", display: "flex", justifyContent: "center" }}>
              <div className="animate-pulse" style={{ width: 52, height: 12, background: "#F1F5F9", borderRadius: 4 }} />
            </div>
          ))}
        </div>
        {/* Order card placeholders */}
        <div style={{ padding: "12px 16px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div className="animate-pulse" style={{ width: 110, height: 14, borderRadius: 6, background: "#E2E8F0" }} />
                <div className="animate-pulse" style={{ width: 72, height: 20, borderRadius: 99, background: "#F1F5F9" }} />
              </div>
              <div className="animate-pulse" style={{ width: "65%", height: 12, borderRadius: 4, background: "#F1F5F9", marginBottom: 10 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="animate-pulse" style={{ width: 56, height: 14, borderRadius: 4, background: "#E2E8F0" }} />
                <div className="animate-pulse" style={{ width: 76, height: 28, borderRadius: 6, background: "#F1F5F9" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
