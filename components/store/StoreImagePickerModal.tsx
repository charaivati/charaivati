"use client";

import { useEffect, useRef, useState } from "react";
import { uploadStoreImage, type StoreImageRecord } from "@/lib/store/uploadImage";

interface Props {
  storeId: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}

export default function StoreImagePickerModal({ storeId, onSelect, onClose }: Props) {
  const [images, setImages] = useState<StoreImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dupNote, setDupNote] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/store/images/list?storeId=${storeId}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setImages(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId]);

  async function handleUpload(file: File) {
    setUploading(true);
    setDupNote(false);
    try {
      const result = await uploadStoreImage(file, storeId);
      if (result.alreadyExisted) {
        setDupNote(true);
        setTimeout(() => setDupNote(false), 3000);
        // Make sure it's in the list (it already is in DB)
        setImages((prev) => prev.some((i) => i.id === result.id) ? prev : [result, ...prev]);
      } else {
        setImages((prev) => [result, ...prev]);
      }
      setSelectedId(result.id);
    } catch {
      alert("Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  }

  const filtered = query.trim()
    ? images.filter((img) =>
        (img.fileName ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : images;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        style={{ background: "#fff", maxHeight: "88vh", boxShadow: "0 -8px 40px rgba(0,0,0,0.2)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "#EEEEEE" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#0F1111" }}>Image Library</h2>
            <p className="text-xs" style={{ color: "#565959" }}>{images.length} image{images.length !== 1 ? "s" : ""} saved</p>
          </div>
          <div className="flex items-center gap-2">
            {dupNote && (
              <span className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ background: "#DCFCE7", color: "#16A34A" }}>
                Already in library — reused
              </span>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs px-3 py-1.5 rounded-md font-medium"
              style={{ background: "#6366f1", color: "#fff", opacity: uploading ? 0.6 : 1, cursor: uploading ? "default" : "pointer" }}
            >
              {uploading ? "Uploading…" : "+ Upload new"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            <button onClick={onClose} className="text-sm" style={{ color: "#9CA3AF" }}>✕</button>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b shrink-0" style={{ borderColor: "#EEEEEE" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by filename…"
            className="w-full text-sm px-3 py-2 rounded-md outline-none"
            style={{ background: "#F9FAFB", border: "1px solid #DDDDDD", color: "#0F1111" }}
          />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-2xl mb-2">🖼️</p>
              <p className="text-sm" style={{ color: "#565959" }}>
                {query ? "No images match that name." : "No images yet. Click "Upload new" to add some."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
              {filtered.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelectedId(img.id)}
                  onDoubleClick={() => { onSelect(img.url); onClose(); }}
                  className="rounded-lg overflow-hidden transition-all text-left"
                  style={{
                    border: selectedId === img.id ? "2px solid #6366f1" : "2px solid transparent",
                    background: "#F9FAFB",
                    outline: "none",
                  }}
                >
                  <img
                    src={img.url}
                    alt={img.fileName ?? ""}
                    className="w-full object-cover"
                    style={{ height: 88 }}
                  />
                  <p className="text-[10px] px-1.5 py-1 truncate" style={{ color: "#565959" }}>
                    {img.fileName ?? "image"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t flex justify-end gap-2" style={{ borderColor: "#EEEEEE" }}>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-md"
            style={{ border: "1px solid #DDDDDD", color: "#565959", background: "#fff" }}>
            Cancel
          </button>
          <button
            disabled={!selectedId}
            onClick={() => {
              const img = images.find((i) => i.id === selectedId);
              if (img) { onSelect(img.url); onClose(); }
            }}
            className="text-sm px-4 py-2 rounded-md font-semibold"
            style={{
              background: selectedId ? "#6366f1" : "#E5E7EB",
              color: selectedId ? "#fff" : "#9CA3AF",
              cursor: selectedId ? "pointer" : "default",
            }}
          >
            Use selected
          </button>
        </div>
      </div>
    </div>
  );
}
