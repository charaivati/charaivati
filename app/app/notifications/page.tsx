"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/utils/timeAgo";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

function groupNotifs(notifs: Notif[]) {
  const todayStart     = new Date(); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  return {
    today:     notifs.filter((n) => new Date(n.createdAt) >= todayStart),
    yesterday: notifs.filter((n) => new Date(n.createdAt) >= yesterdayStart && new Date(n.createdAt) < todayStart),
    earlier:   notifs.filter((n) => new Date(n.createdAt) < yesterdayStart),
  };
}

function NotifRow({
  n,
  onRead,
}: {
  n: Notif;
  onRead: (id: string) => void;
}) {
  function handleClick() {
    if (!n.read) onRead(n.id);
    if (n.link) window.location.href = n.link;
  }

  return (
    <div
      onClick={handleClick}
      style={{
        display: "flex",
        gap: 12,
        padding: "14px 16px",
        borderBottom: "1px solid #F3F4F6",
        background: n.read ? "#FAFAFA" : "#fff",
        cursor: n.link ? "pointer" : "default",
        transition: "background 0.1s",
      }}
    >
      {/* Unread dot */}
      <div style={{ paddingTop: 4, flexShrink: 0, width: 8 }}>
        {!n.read && (
          <span style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: n.read ? 400 : 600, color: n.read ? "#6B7280" : "#111827" }}>
            {n.title}
          </span>
          <span style={{ fontSize: 11, color: "#9CA3AF", flexShrink: 0, paddingTop: 2 }}>
            {timeAgo(n.createdAt)}
          </span>
        </div>
        <p style={{ fontSize: 13, color: "#6B7280", margin: "2px 0 0", lineHeight: 1.45 }}>
          {n.body}
        </p>
      </div>
    </div>
  );
}

function NotifRowSkeleton() {
  return (
    <div style={{ display: "flex", gap: 12, padding: "14px 16px", borderBottom: "1px solid #F3F4F6" }}>
      <div style={{ paddingTop: 6, flexShrink: 0, width: 8 }}>
        <div className="animate-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#E2E8F0" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
          <div className="animate-pulse" style={{ width: "55%", height: 14, borderRadius: 4, background: "#E2E8F0" }} />
          <div className="animate-pulse" style={{ width: 36, height: 10, borderRadius: 4, background: "#F1F5F9", flexShrink: 0 }} />
        </div>
        <div className="animate-pulse" style={{ width: "80%", height: 12, borderRadius: 4, background: "#F1F5F9" }} />
      </div>
    </div>
  );
}

function Section({ label, items, onRead }: { label: string; items: Notif[]; onRead: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", background: "#F9FAFB" }}>
        {label}
      </div>
      {items.map((n) => <NotifRow key={n.id} n={n} onRead={onRead} />)}
    </div>
  );
}

export default function NotificationsPage() {
  const [notifs,    setNotifs]    = useState<Notif[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [markingAll,setMarkingAll]= useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setNotifs(data.notifications ?? []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRead(id: string) {
    try {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    } catch {}
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await fetch("/api/notifications/read", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
    setMarkingAll(false);
  }

  const groups = groupNotifs(notifs);
  const hasUnread = notifs.some((n) => !n.read);
  const isEmpty = notifs.length === 0;

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB" }}>
      {/* Header */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #E5E7EB",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 56,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/app/home" style={{ color: "#6B7280", textDecoration: "none", fontSize: 13 }}>←</Link>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>Notifications</h1>
        </div>
        {hasUnread && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#6366f1",
              background: "none",
              border: "none",
              cursor: "pointer",
              opacity: markingAll ? 0.5 : 1,
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {loading ? (
          <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", margin: 12, border: "1px solid #E5E7EB" }}>
            <NotifRowSkeleton />
            <NotifRowSkeleton />
            <NotifRowSkeleton />
            <NotifRowSkeleton />
            <NotifRowSkeleton />
          </div>
        ) : isEmpty ? (
          <div style={{ textAlign: "center", padding: "64px 16px", color: "#9CA3AF" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#6B7280", margin: 0 }}>No notifications yet.</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>You&apos;ll see updates about your orders and assignments here.</p>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", margin: 12, border: "1px solid #E5E7EB" }}>
            <Section label="Today"     items={groups.today}     onRead={handleRead} />
            <Section label="Yesterday" items={groups.yesterday} onRead={handleRead} />
            <Section label="Earlier"   items={groups.earlier}   onRead={handleRead} />
          </div>
        )}
      </div>
    </div>
  );
}
