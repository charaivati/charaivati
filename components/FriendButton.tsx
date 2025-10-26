// components/FriendButton.tsx
"use client";
import React, { useState } from "react";

export default function FriendButton({ targetId }: { targetId: string }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle"|"requested"|"error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function sendRequest() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ receiverId: targetId, message: "Hi — want to connect?" }),
      });
      const data = await res.json().catch(()=>null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || data?.rawText || "Failed");
      setStatus("requested");
    } catch (e: any) {
      console.error("send friend request", e);
      setStatus("error");
      setErr(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  if (status === "requested") return <button className="px-3 py-1 rounded bg-gray-600">Requested</button>;

  return (
    <button onClick={sendRequest} className="px-3 py-1 rounded bg-green-600" disabled={loading}>
      {loading ? "Sending…" : "Add friend"}
      {err && <div className="text-xs text-red-400 mt-1">{err}</div>}
    </button>
  );
}
