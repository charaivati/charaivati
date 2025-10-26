// components/FriendRequestsPanel.tsx
"use client";
import React, { useEffect, useState } from "react";

type Req = { id: string; senderId: string; message?: string; createdAt: string; };

export default function FriendRequestsPanel() {
  const [list, setList] = useState<Req[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/user/friends", { credentials: "include" });
      const d = await res.json().catch(()=>null);
      if (res.ok && d?.ok) {
        setList(d.incomingRequests || []);
      } else {
        setList([]);
      }
    } catch (e) {
      console.error(e);
      setList([]);
    } finally { setLoading(false); }
  }

  async function respond(id: string, action: "accept"|"reject") {
    try {
      const res = await fetch("/api/friends/respond", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, action }),
      });
      const d = await res.json().catch(()=>null);
      if (!res.ok || !d?.ok) throw new Error(d?.error || "failed");
      // refresh list
      setList(prev => prev ? prev.filter(x => x.id !== id) : prev);
    } catch (e) {
      console.error(e);
      alert("Failed to respond to request");
    }
  }

  if (loading) return <div>Loading requests…</div>;
  if (!list || list.length === 0) return <div>No friend requests</div>;

  return (
    <div className="space-y-2">
      {list.map(r => (
        <div key={r.id} className="p-3 bg-white/6 rounded flex justify-between items-start">
          <div>
            <div className="font-medium">From: {r.senderId}</div>
            {r.message && <div className="text-xs text-gray-400">{r.message}</div>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => respond(r.id, "accept")} className="px-3 py-1 rounded bg-green-600">Accept</button>
            <button onClick={() => respond(r.id, "reject")} className="px-3 py-1 rounded bg-gray-700">Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

