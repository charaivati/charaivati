"use client";

import { useState } from "react";
import type { ListenAction } from "@/lib/listener/actionTypes";
import ActionAvatar from "@/components/listen/ActionAvatar";

const CARD_STYLE = { background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.25)" } as const;
const BUTTON_STYLE = { background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" } as const;

type CardStatus = "idle" | "sending" | "accepted" | "ignored" | "error";

// FRIEND-NOTIFY-1: renders pending FriendRequest cards surfaced conversationally
// by the Listener. "Accept" calls the existing /api/friends/accept (unchanged).
// "Ignore" is dismiss-only — it does NOT decline the request server-side; the
// request stays pending and the sender can still be handled from the Social page.
export default function FriendRequestCard({ action }: { action: ListenAction }) {
  if (action.type !== "friend_requests_pending") return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {action.requests.map((r) => (
        <RequestCard key={r.id} requestId={r.id} sender={r.sender} />
      ))}
    </div>
  );
}

function RequestCard({
  requestId,
  sender,
}: {
  requestId: string;
  sender: { id: string; name: string | null; avatarUrl: string | null; location: string | null };
}) {
  const [status, setStatus] = useState<CardStatus>("idle");

  async function accept() {
    if (status === "sending" || status === "accepted") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/friends/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("accepted");
      } else if (data.error === "Request not pending") {
        // already handled elsewhere — treat as accepted/resolved
        setStatus("accepted");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "accepted") {
    return <p className="text-xs text-green-400 mt-2">✓ You&apos;re now friends with {sender.name ?? "them"}.</p>;
  }
  if (status === "ignored") {
    return null;
  }

  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center gap-3" style={CARD_STYLE}>
      <ActionAvatar name={sender.name} url={sender.avatarUrl} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-100 truncate">{sender.name ?? "Unnamed"}</p>
        {sender.location && <p className="text-xs text-gray-500 truncate">{sender.location}</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0 items-center">
        {status === "error" && (
          <button onClick={accept} className="text-xs text-red-400 hover:text-red-300">
            Failed — retry
          </button>
        )}
        {(status === "idle" || status === "sending") && (
          <>
            <button
              onClick={accept}
              disabled={status === "sending"}
              className="text-xs px-2.5 py-1 rounded-lg disabled:opacity-50"
              style={BUTTON_STYLE}
            >
              {status === "sending" ? "Accepting…" : "Accept"}
            </button>
            <button onClick={() => setStatus("ignored")} className="text-xs text-gray-500 hover:text-gray-400">
              Ignore
            </button>
          </>
        )}
      </div>
    </div>
  );
}
