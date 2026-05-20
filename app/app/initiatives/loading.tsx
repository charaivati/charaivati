export default function InitiativesLoading() {
  return (
    <div style={{ background: "#F3F4F6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px" }}>
        {/* Page title skeleton */}
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-1.5" />
        <div className="h-3.5 w-56 bg-gray-200 rounded animate-pulse mb-5" />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                borderRadius: 14,
                border: "1px solid #E5E7EB",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                padding: 16,
              }}
            >
              {/* Card header: icon area + title + badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse flex-shrink-0" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="h-4 bg-gray-200 rounded animate-pulse mb-1.5" style={{ width: "65%" }} />
                  <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: "40%" }} />
                </div>
                <div className="h-5 w-14 bg-gray-200 rounded-full animate-pulse flex-shrink-0" />
              </div>

              {/* Action button row */}
              <div style={{ display: "flex", gap: 8 }}>
                <div className="h-8 bg-gray-200 rounded-lg animate-pulse flex-1" />
                <div className="h-8 bg-gray-200 rounded-lg animate-pulse flex-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
