// components/FriendRequestsPanel.tsx
"use client";
import React, { useEffect, useState } from "react";

type Req = { id: string; senderId: string; message?: string; createdAt: string };
type ReqState = "idle" | "accepting" | "rejecting" | "accepted" | "rejected";

export default function FriendRequestsPanel() {
  const [list, setList] = useState<Req[] | null>(null);
  const [loading, setLoading] = useState(false);
  // per-request action state
  const [states, setStates] = useState<Record<string, ReqState>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/user/friends", { credentials: "include" });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.ok) setList(d.incomingRequests || []);
      else setList([]);
    } catch (e) {
      console.error(e);
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  function setReqState(id: string, s: ReqState) {
    setStates((prev) => ({ ...prev, [id]: s }));
  }

  async function respond(id: string, action: "accept" | "reject") {
    const busy = states[id];
    if (busy === "accepting" || busy === "rejecting" || busy === "accepted" || busy === "rejected") return;

    setReqState(id, action === "accept" ? "accepting" : "rejecting");
    try {
      const res = await fetch("/api/friends/respond", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, action }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) throw new Error(d?.error || "failed");

      setReqState(id, action === "accept" ? "accepted" : "rejected");
      // remove from list after brief delay so user sees the state change
      setTimeout(() => setList((prev) => prev ? prev.filter((x) => x.id !== id) : prev), 800);
    } catch (e) {
      console.error(e);
      setReqState(id, "idle");
    }
  }

  if (loading) return <div className="text-sm text-gray-400">Loading requests…</div>;
  if (!list || list.length === 0) return <div className="text-sm text-gray-500">No friend requests</div>;

  return (
    <div className="space-y-2">
      {list.map((r) => {
        const s = states[r.id] ?? "idle";
        const busy = s === "accepting" || s === "rejecting";

        return (
          <div key={r.id} className="p-3 bg-white/6 rounded flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="font-medium truncate">From: {r.senderId}</div>
              {r.message && <div className="text-xs text-gray-400">{r.message}</div>}
            </div>

            <div className="flex gap-2 shrink-0">
              {s === "accepted" && (
                <span className="px-3 py-1 rounded bg-green-700/40 text-green-300 text-sm">Accepted</span>
              )}
              {s === "rejected" && (
                <span className="px-3 py-1 rounded bg-gray-700/40 text-gray-400 text-sm">Rejected</span>
              )}
              {(s === "idle" || s === "accepting" || s === "rejecting") && (
                <>
                  <button
                    onClick={() => respond(r.id, "accept")}
                    disabled={busy}
                    className="px-3 py-1 rounded bg-green-600 disabled:opacity-50 text-sm min-w-[80px] transition-opacity"
                  >
                    {s === "accepting" ? "Accepting…" : "Accept"}
                  </button>
                  <button
                    onClick={() => respond(r.id, "reject")}
                    disabled={busy}
                    className="px-3 py-1 rounded bg-gray-700 disabled:opacity-50 text-sm min-w-[76px] transition-opacity"
                  >
                    {s === "rejecting" ? "Rejecting…" : "Reject"}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
