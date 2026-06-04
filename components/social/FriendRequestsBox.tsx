"use client";
// components/social/FriendRequestsBox.tsx
import React, { useEffect, useState } from "react";
import { UserCheck, UserX, Clock, Mail } from "lucide-react";

// ---------------------------------------------------------------------------
// InviteFriend — standalone invite-by-email widget
// Server always returns the same message regardless of whether the email exists.
// ---------------------------------------------------------------------------
export function InviteFriend() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setStatus("error");
        setErrorMsg(d.error ?? "You've reached the invite limit for today.");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(d.error ?? "Something went wrong.");
        return;
      }
      setStatus("sent");
      setEmail("");
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-800/60 border border-gray-700/50 text-sm text-green-400">
        <Mail className="w-4 h-4 shrink-0" />
        If they&apos;re not already on Charaivati, they&apos;ll get an email to join.
      </div>
    );
  }

  return (
    <form onSubmit={sendInvite} className="flex flex-col gap-2">
      <p className="text-xs text-gray-400">Invite a friend by email</p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
          placeholder="friend@example.com"
          required
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
        >
          {status === "loading" ? "…" : "Invite"}
        </button>
      </div>
      {status === "error" && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}
    </form>
  );
}

type IncomingReq = {
  id: string;
  senderId: string;
  message?: string | null;
  createdAt: string;
  sender: { id: string; name?: string | null; email?: string | null; avatarUrl?: string | null };
};

export default function FriendRequestsBox({
  onCountChange,
}: {
  onCountChange?: (n: number) => void;
}) {
  const [requests, setRequests] = useState<IncomingReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/user/friends", { credentials: "include" });
      const d = await res.json().catch(() => null);
      if (d?.ok) {
        const incoming = d.incomingRequests ?? [];
        setRequests(incoming);
        onCountChange?.(incoming.length);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function respond(id: string, action: "accept" | "reject") {
    setResponding(id);
    try {
      const res = await fetch("/api/friends/respond", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, action }),
      });
      const d = await res.json().catch(() => null);
      if (!d?.ok) throw new Error(d?.error ?? "Failed");
      const next = requests.filter((r) => r.id !== id);
      setRequests(next);
      onCountChange?.(next.length);
    } catch (e: any) {
      console.error(e);
    } finally {
      setResponding(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
        <Clock className="w-4 h-4 animate-pulse" />
        Loading requests…
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-2">No pending friend requests.</p>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => {
        const name =
          r.sender.name ?? r.sender.email ?? r.senderId;
        const letter = name[0].toUpperCase();
        const busy = responding === r.id;

        return (
          <div
            key={r.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/60 border border-gray-700/50"
          >
            {r.sender.avatarUrl ? (
              <img
                src={r.sender.avatarUrl}
                alt=""
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
                {letter}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{name}</p>
              {r.message && (
                <p className="text-xs text-gray-400 truncate">"{r.message}"</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => respond(r.id, "accept")}
                disabled={busy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Accept
              </button>
              <button
                onClick={() => respond(r.id, "reject")}
                disabled={busy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium disabled:opacity-50 transition-colors"
              >
                <UserX className="w-3.5 h-3.5" />
                Decline
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
