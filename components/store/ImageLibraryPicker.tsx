"use client";

import { useEffect, useState } from "react";

type LibImage = { id: string; name: string; imageUrl: string; imageKey: string | null };

interface Props {
  storeId: string;
  onSelect: (imageUrl: string, imageKey: string | null) => void;
  /** Optional dark theme for use inside dark panels like BannerEditForm */
  dark?: boolean;
}

export default function ImageLibraryPicker({ storeId, onSelect, dark = false }: Props) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<LibImage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/store/${storeId}/images`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : { images: [] })
      .then((d) => setImages(d.images ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, storeId]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontSize: 11, color: "#6366f1", background: "none", border: "none",
          cursor: "pointer", padding: 0, textDecoration: "underline", textAlign: "left",
        }}>
        📂 Choose from library
      </button>
    );
  }

  return (
    <div style={{
      border: `1px solid ${dark ? "#374151" : "#DDDDDD"}`,
      borderRadius: 8, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "7px 10px",
        background: dark ? "#1F2937" : "#F9FAFB",
        borderBottom: `1px solid ${dark ? "#374151" : "#EEEEEE"}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: dark ? "#D1D5DB" : "#565959" }}>
          Image Library
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{ fontSize: 11, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>
          ✕ Close
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#9CA3AF", background: dark ? "#111827" : "#fff" }}>
          Loading…
        </div>
      ) : images.length === 0 ? (
        <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#9CA3AF", background: dark ? "#111827" : "#fff" }}>
          No images in library yet.<br />
          <span style={{ color: "#6366f1" }}>Use "Bulk image upload" to add some.</span>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
          gap: 6, padding: 8,
          maxHeight: 210, overflowY: "auto",
          background: dark ? "#111827" : "#fff",
        }}>
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              title={img.name}
              onClick={() => { onSelect(img.imageUrl, img.imageKey); setOpen(false); }}
              style={{
                padding: 0, border: "2px solid transparent", borderRadius: 6,
                overflow: "hidden", cursor: "pointer", background: "none",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
            >
              <img
                src={img.imageUrl}
                alt={img.name}
                style={{ width: "100%", height: 54, objectFit: "cover", display: "block" }}
              />
              <p style={{
                fontSize: 9, margin: "2px 3px 3px",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                color: dark ? "#9CA3AF" : "#565959",
              }}>
                {img.name}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
