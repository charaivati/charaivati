// components/FriendsList.tsx
"use client";
import React, { useEffect, useState } from "react";

export default function FriendsList() {
  const [friends, setFriends] = useState<any[] | null>(null);

  useEffect(() => {
    fetch("/api/user/friends", { credentials: "include" })
      .then(r => r.json()).then(d => {
        if (d?.ok) setFriends(d.friends || []);
        else setFriends([]);
      }).catch(e => { console.error(e); setFriends([]); });
  }, []);

  if (!friends) return <div>Loading friends…</div>;
  if (friends.length === 0) return <div>No friends yet</div>;

  return (
    <ul className="space-y-2">
      {friends.map(f => (
        <li key={f.id} className="flex items-center gap-3 p-2 bg-white/6 rounded">
          <img src={f.avatarUrl ?? "/avatar-placeholder.png"} alt="" className="w-8 h-8 rounded-full"/>
          <div>
            <div className="font-medium">{f.displayName ?? f.name ?? f.email}</div>
            <div className="text-xs text-gray-400">{f.email}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
