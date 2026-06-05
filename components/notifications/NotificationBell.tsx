"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/utils/timeAgo";

// ── Types ─────────────────────────────────────────────────────────────────────

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

function BellSvg({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [notifs,      setNotifs]      = useState<Notif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open,        setOpen]        = useState(false);
  const [markingAll,  setMarkingAll]  = useState(false);
  const [readingId,   setReadingId]   = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const esRef       = useRef<EventSource | null>(null);

  function applyUpdate(data: { notifications: Notif[]; unreadCount: number }) {
    setNotifs(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  }

  async function load() {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) return;
      applyUpdate(await res.json());
    } catch {}
  }

  useEffect(() => {
    load();

    // Polling fallback at 10 s — covers SSE failures and keeps state in sync
    intervalRef.current = setInterval(load, 10000);

    // Immediate refresh when user returns to this tab
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);

    // SSE connection — real-time push; updates bell without waiting for next poll
    if (typeof EventSource !== "undefined") {
      const es = new EventSource("/api/notifications/stream");
      esRef.current = es;

      es.onmessage = (e) => {
        try { applyUpdate(JSON.parse(e.data)); } catch {}
      };

      es.onerror = () => {
        // Connection lost — polling fallback already running, nothing to do
        es.close();
        esRef.current = null;
      };
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      esRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function markRead(ids: string[]) {
    try {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setNotifs((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, read: true } : n));
      setUnreadCount((prev) => Math.max(0, prev - ids.filter((id) => notifs.find((n) => n.id === id && !n.read)).length));
    } catch {}
  }

  async function markAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
    setMarkingAll(false);
  }

  function handleRowClick(n: Notif) {
    if (!n.read && readingId !== n.id) {
      setReadingId(n.id);
      markRead([n.id]).finally(() => setReadingId(null));
    }
    setOpen(false);
    if (n.link) window.location.href = n.link;
  }

  const preview = notifs.slice(0, 10);

  return (
    <div style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 6,
          borderRadius: 6,
          position: "relative",
        }}
      >
        <BellSvg size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute",
            top: 2,
            right: 2,
            background: "#EF4444",
            color: "#fff",
            fontSize: 9,
            fontWeight: 700,
            borderRadius: "50%",
            minWidth: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 3px",
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Click-outside overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 40 }}
        />
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          top: 44,
          zIndex: 50,
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
          width: 340,
          maxHeight: 420,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 14px",
            borderBottom: "1px solid #F3F4F6",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600, opacity: markingAll ? 0.5 : 1 }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {preview.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                No notifications yet.
              </div>
            ) : (
              preview.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleRowClick(n)}
                  disabled={readingId === n.id}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "center",
                    padding: "10px 14px",
                    borderBottom: "1px solid #F9FAFB",
                    background: n.read ? "#FAFAFA" : "#fff",
                    cursor: "pointer",
                    border: "none",
                    borderBottomColor: "#F3F4F6",
                    borderBottomWidth: 1,
                    borderBottomStyle: "solid",
                    opacity: readingId === n.id ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: n.read ? "#6B7280" : "#111827" }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: 10, color: "#9CA3AF", flexShrink: 0 }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2, lineHeight: 1.4 }}>
                    {n.body}
                  </div>
                  {!n.read && (
                    <span style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#6366f1",
                      marginTop: 4,
                    }} />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #F3F4F6", padding: "8px 14px", flexShrink: 0, textAlign: "center" }}>
            <Link
              href="/app/notifications"
              onClick={() => setOpen(false)}
              style={{ fontSize: 12, color: "#6366f1", textDecoration: "none", fontWeight: 600 }}
            >
              See all →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
