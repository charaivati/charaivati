// components/ProfileMenu.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import { User, LogOut, Settings, ChevronDown } from "lucide-react";

type Props = {
  profile: any | null;
  onLogout: () => void;
  compact?: boolean;
};

export default function ProfileMenu({ profile, onLogout, compact = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (!profile) {
    return (
      <a
        href="/auth/login"
        className="px-4 py-2 text-sm font-medium rounded-lg bg-white/10 hover:bg-white/15 transition-colors border border-white/10"
      >
        Sign In
      </a>
    );
  }

  const userName = profile.name || profile.username || "User";
  const userEmail = profile.email || "";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (compact) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {initials}
        </button>

        {isOpen && (
          <div className="absolute top-full right-0 mt-2 w-56 bg-black border border-white/20 rounded-lg shadow-xl overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="text-sm font-medium text-white">{userName}</div>
              {userEmail && <div className="text-xs text-gray-400 mt-0.5">{userEmail}</div>}
            </div>

            <div className="py-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = "/settings";
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = "/self";
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <User className="w-4 h-4" />
                Profile
              </button>
            </div>

            <div className="border-t border-white/10">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-white truncate">{userName}</div>
          {userEmail && <div className="text-xs text-gray-400 truncate">{userEmail}</div>}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-black border border-white/20 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                window.location.href = "/settings";
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                window.location.href = "/self";
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <User className="w-4 h-4" />
              Profile
            </button>
          </div>

          <div className="border-t border-white/10">
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
