// components/FriendButton.tsx
"use client";
import React, { useState } from "react";

type Status = "idle" | "sending" | "requested" | "friends" | "error";

const ALREADY_DONE_ERRORS = ["already friends", "pending request already exists"];

export default function FriendButton({ targetId }: { targetId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [err, setErr] = useState<string | null>(null);

  async function sendRequest() {
    // Prevent double-submit
    if (status !== "idle" && status !== "error") return;

    setStatus("sending");
    setErr(null);
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ receiverId: targetId }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok) {
        setStatus("requested");
        return;
      }

      // Treat "already done" states as success rather than errors
      const errMsg = (data?.error ?? "").toLowerCase();
      if (ALREADY_DONE_ERRORS.some((e) => errMsg.includes(e))) {
        setStatus(errMsg.includes("already friends") ? "friends" : "requested");
        return;
      }

      throw new Error(data?.error || "Failed to send request");
    } catch (e: any) {
      console.error("send friend request", e);
      setStatus("error");
      setErr(e?.message || "Network error");
    }
  }

  if (status === "sending")
    return <button disabled className="px-3 py-1 rounded bg-gray-600 opacity-60 text-sm">Sending…</button>;

  if (status === "requested")
    return <button disabled className="px-3 py-1 rounded bg-gray-600 text-sm">Requested</button>;

  if (status === "friends")
    return <button disabled className="px-3 py-1 rounded bg-green-800/50 text-green-300 text-sm">Friends</button>;

  return (
    <div>
      <button
        onClick={sendRequest}
        className="px-3 py-1 rounded bg-green-600 hover:bg-green-500 transition-colors text-sm"
      >
        {status === "error" ? "Retry" : "Add friend"}
      </button>
      {err && <div className="text-xs text-red-400 mt-1">{err}</div>}
    </div>
  );
}
