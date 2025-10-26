// components/ProfileMenu.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  shortBio?: string | null;
};

export default function ProfileMenu({
  profile,
  onLogout,
  compact,
}: {
  profile: Profile | null;
  onLogout: () => Promise<void> | void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 ${
          compact ? "px-2 py-0.5" : ""
        }`}
        aria-label="Open profile menu"
        type="button"
      >
        <img
          src={profile?.avatarUrl ?? "/avatar-placeholder.png"}
          alt="avatar"
          className={`w-8 h-8 rounded-full object-cover border border-white/10 ${compact ? "w-9 h-9" : ""}`}
        />
        {!compact && <span className="hidden sm:inline">{profile?.name ?? profile?.email ?? "Guest"}</span>}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 bg-black/90 rounded-lg shadow-lg py-1 px-1 min-w-[180px] z-40 border border-white/6">
          <button
            onClick={() => {
              setOpen(false);
              router.push("/self");
            }}
            className="block w-full text-left text-sm px-3 py-2 rounded hover:bg-white/6"
          >
            Profile
          </button>

          <button
            onClick={() => {
              setOpen(false);
              router.push("/self/analytics");
            }}
            className="block w-full text-left text-sm px-3 py-2 rounded hover:bg-white/6"
          >
            Analytics
          </button>

          <div className="border-t border-white/6 my-1" />

          <button
            onClick={async () => {
              setOpen(false);
              try {
                await onLogout();
              } catch (err) {
                console.warn("Logout handler error:", err);
                router.replace("/");
              }
            }}
            className="block w-full text-left text-sm px-3 py-2 rounded hover:bg-red-600/40 text-red-400"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
