"use client";

export interface StoreMapCardStore {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  previewImage?: string | null;
  acceptingOrders?: boolean;
  distanceKm?: number | null;
}

interface StoreMapCardProps {
  store: StoreMapCardStore;
  onClose: () => void;
}

export default function StoreMapCard({ store, onClose }: StoreMapCardProps) {
  return (
    <div
      style={{
        background: "#fff",
        border: "0.5px solid #e2e8f0",
        borderRadius: 14,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {store.previewImage ? (
          <img
            src={store.previewImage}
            alt={store.name}
            style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              flexShrink: 0,
              background: "linear-gradient(135deg,#6366f1,#818cf8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            🏪
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: "#111827",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {store.name}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 18,
            color: "#9CA3AF",
            lineHeight: 1,
            padding: "0 2px",
            flexShrink: 0,
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Description */}
      {store.description && (
        <div
          style={{
            fontSize: 12,
            color: "#6B7280",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {store.description}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: 99,
              background: store.acceptingOrders ? "#dcfce7" : "#fef3c7",
              color: store.acceptingOrders ? "#15803d" : "#92400e",
            }}
          >
            {store.acceptingOrders ? "Open ✓" : "Closed"}
          </span>
          {store.distanceKm != null && (
            <span
              style={{
                fontSize: 11,
                color: "#6B7280",
                padding: "2px 7px",
                borderRadius: 99,
                background: "#F3F4F6",
              }}
            >
              {store.distanceKm.toFixed(1)} km
            </span>
          )}
        </div>
        <a
          href={`/store/${store.slug ?? store.id}`}
          style={{
            padding: "5px 12px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
            background: "#6366f1",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          Visit store →
        </a>
      </div>
    </div>
  );
}
