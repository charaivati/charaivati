export default function SavedLoading() {
  return (
    <div style={{ background: "#F3F4F6", minHeight: "100vh" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px" }}>
        <div className="h-7 w-14 bg-gray-200 rounded animate-pulse mb-5" />

        {/* Pinned Stores skeleton */}
        <section style={{ marginBottom: 28 }}>
          <div className="h-4 w-28 bg-gray-200 rounded animate-pulse mb-2.5" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1].map((i) => (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: "#fff", borderRadius: 12,
                  border: "1px solid #E5E7EB", overflow: "hidden",
                }}
              >
                <div className="w-16 h-16 bg-gray-200 animate-pulse flex-shrink-0" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="h-3.5 bg-gray-200 rounded animate-pulse mb-1.5" style={{ width: "60%" }} />
                  <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: "40%" }} />
                </div>
                <div className="h-7 w-14 bg-gray-200 rounded animate-pulse flex-shrink-0 mr-3" />
              </div>
            ))}
          </div>
        </section>

        {/* Wishlist skeleton */}
        <section style={{ marginBottom: 34 }}>
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-3" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: "#fff", borderRadius: 10,
                  border: "1px solid #E5E7EB", overflow: "hidden",
                }}
              >
                <div className="w-full bg-gray-200 animate-pulse" style={{ aspectRatio: "1/1" }} />
                <div style={{ padding: "8px 10px" }}>
                  <div className="h-3 bg-gray-200 rounded animate-pulse mb-1" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse mb-1" style={{ width: "75%" }} />
                  <div className="h-3 bg-gray-200 rounded animate-pulse mb-2.5" style={{ width: "50%" }} />
                  <div style={{ display: "flex", gap: 5 }}>
                    <div className="h-6 bg-gray-200 rounded animate-pulse flex-1" />
                    <div className="h-6 bg-gray-200 rounded animate-pulse flex-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Browse skeleton */}
        <section>
          <div className="h-4 w-28 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="h-12 w-full bg-gray-200 rounded-xl animate-pulse mb-3.5" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  background: "#fff", borderRadius: 14,
                  border: "1px solid #E5E7EB",
                  display: "flex", alignItems: "center", gap: 12, padding: 12,
                }}
              >
                <div className="w-20 h-20 bg-gray-200 rounded-lg animate-pulse flex-shrink-0" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="h-3.5 bg-gray-200 rounded animate-pulse mb-1.5" style={{ width: "55%" }} />
                  <div className="h-3 bg-gray-200 rounded animate-pulse mb-1" style={{ width: "80%" }} />
                  <div className="h-3 bg-gray-200 rounded animate-pulse mb-3" style={{ width: "65%" }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
                    <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
