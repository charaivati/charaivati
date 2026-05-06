"use client";

import React, { useState } from "react";
import { Upload } from "lucide-react";
import type { StoreBannerData } from "./BannerZone";

interface BannerEditFormProps {
  storeId: string;
  banner: StoreBannerData | null;
  isGlobal?: boolean;
  onSaved: (banner: StoreBannerData) => void;
  onCleared?: () => void;
}

export default function BannerEditForm({ storeId, banner, isGlobal = false, onSaved, onCleared }: BannerEditFormProps) {
  const [imageUrl, setImageUrl] = useState(banner?.imageUrl ?? "");
  const [heading, setHeading] = useState(banner?.heading ?? "");
  const [subheading, setSubheading] = useState(banner?.subheading ?? "");
  const [body, setBody] = useState(banner?.body ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function uploadImage(file: File) {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) { alert("Cloudinary not configured"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", uploadPreset);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.secure_url) setImageUrl(data.secure_url);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        isGlobal,
        imageUrl: imageUrl || null,
        heading: heading || null,
        subheading: subheading || null,
        body: body || null,
      };
      let res: Response;
      if (banner?.id) {
        res = await fetch(`/api/store/${storeId}/banners/${banner.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/store/${storeId}/banners`, {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (data.ok) onSaved(data.banner);
      else alert(data.error ?? "Failed to save banner");
    } finally {
      setSaving(false);
    }
  }

  async function clearBanner() {
    if (!banner?.id) { onCleared?.(); return; }
    if (!confirm("Remove this banner?")) return;
    await fetch(`/api/store/${storeId}/banners/${banner.id}`, { method: "DELETE", credentials: "include" });
    onCleared?.();
  }

  const inputCls = "w-full text-sm px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 outline-none focus:border-indigo-500 transition-colors";

  return (
    <div className="space-y-3">
      {/* Image upload */}
      <div>
        <label className="block text-[11px] font-mono font-semibold text-gray-500 uppercase tracking-[0.08em] mb-1.5">Banner Image</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://… or upload below"
            className={inputCls + " flex-1"}
          />
          <label className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-xs cursor-pointer transition-colors">
            <Upload size={13} />
            {uploading ? "Uploading…" : "Upload"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          </label>
        </div>
        {imageUrl && (
          <img src={imageUrl} alt="" className="mt-2 rounded-lg w-full max-h-24 object-cover" />
        )}
      </div>

      {/* Text fields */}
      <div>
        <label className="block text-[11px] font-mono font-semibold text-gray-500 uppercase tracking-[0.08em] mb-1.5">Heading</label>
        <input type="text" value={heading} onChange={(e) => setHeading(e.target.value)} placeholder="Bold headline" className={inputCls} />
      </div>
      <div>
        <label className="block text-[11px] font-mono font-semibold text-gray-500 uppercase tracking-[0.08em] mb-1.5">Subheading</label>
        <input type="text" value={subheading} onChange={(e) => setSubheading(e.target.value)} placeholder="Supporting text" className={inputCls} />
      </div>
      <div>
        <label className="block text-[11px] font-mono font-semibold text-gray-500 uppercase tracking-[0.08em] mb-1.5">Body</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Additional detail" rows={2} className={inputCls + " resize-none"} />
      </div>

      <div className="flex justify-between items-center pt-1">
        {onCleared && (
          <button onClick={clearBanner} className="text-xs text-red-400 hover:text-red-300 transition-colors">
            Remove banner
          </button>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="ml-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save banner"}
        </button>
      </div>
    </div>
  );
}
