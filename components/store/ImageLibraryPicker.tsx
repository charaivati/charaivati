"use client";

import { useEffect, useState } from "react";

type LibImage = { id: string; fileName: string | null; url: string };

interface Props {
  storeId: string;
  onSelect: (url: string) => void;
  dark?: boolean;
}

export default function ImageLibraryPicker({ storeId, onSelect, dark = false }: Props) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<LibImage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/store/images/list?storeId=${storeId}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setImages(Array.isArray(data) ? data : []))
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
    <div style={{ border: `1px solid ${dark ? "#374151" : "#DDDDDD"}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "7px 10px",
        background: dark ? "#1F2937" : "#F9FAFB",
        borderBottom: `1px solid ${dark ? "#374151" : "#EEEEEE"}`,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: dark ? "#D1D5DB" : "#565959" }}>Image Library</span>
        <button type="button" onClick={() => setOpen(false)}
          style={{ fontSize: 11, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>
          ✕ Close
        </button>
      </div>

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
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
          gap: 6, padding: 8, maxHeight: 210, overflowY: "auto",
          background: dark ? "#111827" : "#fff",
        }}>
          {images.map((img) => (
            <button key={img.id} type="button" title={img.fileName ?? ""}
              onClick={() => { onSelect(img.url); setOpen(false); }}
              style={{
                padding: 0, border: "2px solid transparent", borderRadius: 6,
                overflow: "hidden", cursor: "pointer", background: "none", transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}>
              <img src={img.url} alt={img.fileName ?? ""} style={{ width: "100%", height: 54, objectFit: "cover", display: "block" }} />
              <p style={{ fontSize: 9, margin: "2px 3px 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: dark ? "#9CA3AF" : "#565959" }}>
                {img.fileName ?? "image"}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
