"use client";

import { Pencil } from "lucide-react";

export type StoreBannerData = {
  id: string;
  isGlobal: boolean;
  imageUrl: string | null;
  heading: string | null;
  subheading: string | null;
  body: string | null;
};

export interface BannerZoneProps {
  banner: StoreBannerData | null;
  globalBanner: StoreBannerData | null;
  editMode: boolean;
  onEdit: () => void;
}

export default function BannerZone({ banner, globalBanner, editMode, onEdit }: BannerZoneProps) {
  const active = banner ?? globalBanner;

  if (!active) {
    if (!editMode) return null;
    return (
      <div
        onClick={onEdit}
        className="w-full flex items-center justify-center h-20 border-2 border-dashed border-indigo-600/50 text-indigo-400 text-sm cursor-pointer hover:border-indigo-500 hover:text-indigo-300 transition-colors bg-gray-900/40"
      >
        + Add banner
      </div>
    );
  }

  const hasImage = !!active.imageUrl;
  const hasText = active.heading || active.subheading || active.body;

  const BANNER_H = 200;

  return (
    <div className="relative w-full overflow-hidden" style={{ height: BANNER_H }}>
      {hasImage ? (
        <div
          className="w-full h-full"
          style={{ background: `url(${active.imageUrl}) center/cover no-repeat` }}
        >
          {hasText && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              {active.heading && <h2 className="text-2xl font-bold text-white mb-1" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>{active.heading}</h2>}
              {active.subheading && <p className="text-lg text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>{active.subheading}</p>}
              {active.body && <p className="text-sm text-white/90 mt-1" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}>{active.body}</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center text-center px-4">
          {active.heading && <h2 className="text-2xl font-bold text-white mb-1">{active.heading}</h2>}
          {active.subheading && <p className="text-lg text-gray-300">{active.subheading}</p>}
          {active.body && <p className="text-sm text-gray-400 mt-1">{active.body}</p>}
        </div>
      )}
      {editMode && (
        <button
          onClick={onEdit}
          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
          title="Edit banner"
        >
          <Pencil size={12} />
        </button>
      )}
    </div>
  );
}
