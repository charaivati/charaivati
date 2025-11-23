"use client";

import React, { useEffect, useState } from "react";
import UnifiedSearch from "@/components/UnifiedSearch";

type Friend = { id: string; name?: string | null; avatarUrl?: string | null; };
type RequestRow = { id: string; sender?: Friend; receiver?: Friend; senderId?: string; receiverId?: string; message?: string; createdAt?: string; };
type FollowRow = { id: string; page: { id: string; title: string; description?: string | null; avatarUrl?: string | null } };

type Goal = { id: string; text: string; done: boolean; daily: boolean };

export default function SelfTab({ profile }: { profile?: any }) {
  // Social state (kept as your original)
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<RequestRow[]>([]);
  const [outgoing, setOutgoing] = useState<RequestRow[]>([]);
  const [follows, setFollows] = useState<FollowRow[]>([]);
  const [followPageId, setFollowPageId] = useState("");

  // Local personal state (persist to localStorage for immediate use)
  const [mood, setMood] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("self.mood") ?? "neutral" : "neutral"));
  const [journal, setJournal] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("self.journal") ?? "" : ""));
  const [water, setWater] = useState<number>(() => (typeof window !== "undefined" ? Number(localStorage.getItem("self.water") ?? 0) : 0));
  const [goals, setGoals] = useState<Goal[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("self.goals") || "[]"); } catch { return []; }
  });
  const [newGoalText, setNewGoalText] = useState("");
  const [newGoalDaily, setNewGoalDaily] = useState(true);

  // load all social data (unchanged logic mostly)
  async function loadAll() {
    setLoading(true);
    try {
      const [friendsRes, followsRes] = await Promise.all([
        fetch("/api/user/friends", { credentials: "include" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/user/follows", { credentials: "include" }).then((r) => r.json()).catch(() => ({})),
      ]);

      setFriends(friendsRes?.friends ?? []);
      setIncoming(friendsRes?.incomingRequests ?? friendsRes?.incoming ?? []);
      setOutgoing(friendsRes?.outgoingRequests ?? friendsRes?.outgoing ?? []);
      setFollows(followsRes?.follows ?? followsRes?.data ?? []);
    } catch (e) {
      console.error("loadAll error", e);
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
      setFollows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  // friend request / respond / follow / unfollow (unchanged)
  async function sendFriend(receiverId: string) {
    try {
      const res = await fetch("/api/user/friends", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId }),
      });
      const j = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(j?.error || "failed");
      await loadAll();
    } catch (e) {
      console.error("sendFriend error", e);
      alert("Failed to send friend request");
    }
  }

  async function respondRequest(requestId: string, action: "accept" | "reject") {
    try {
      const res = await fetch("/api/user/friends", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      const j = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(j?.error || "failed");
      await loadAll();
    } catch (e) {
      console.error("respondRequest error", e);
      alert("Failed to respond to request");
    }
  }

  async function followPage(pageId: string) {
    try {
      const res = await fetch("/api/user/follows", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      const text = await res.text();
      let j: any = null;
      try { j = JSON.parse(text); } catch (_e) {}
      if (!res.ok) {
        const serverMsg = j?.error || j?.message || text || `status ${res.status}`;
        throw new Error(serverMsg);
      }
      setFollowPageId("");
      await loadAll();
    } catch (err: any) {
      console.error("followPage error", err);
      alert(`Failed to follow page: ${err?.message || err}`);
    }
  }

  async function unfollowPage(pageId: string) {
    try {
      const res = await fetch("/api/user/follows", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      const j = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(j?.error || "failed");
      await loadAll();
    } catch (e) {
      console.error("unfollowPage error", e);
      alert("Failed to unfollow page");
    }
  }

  // ----------------------------
  // Personal feature handlers
  // ----------------------------
  useEffect(() => { localStorage.setItem("self.mood", mood); }, [mood]);
  useEffect(() => { localStorage.setItem("self.journal", journal); }, [journal]);
  useEffect(() => { localStorage.setItem("self.water", String(water)); }, [water]);
  useEffect(() => { localStorage.setItem("self.goals", JSON.stringify(goals)); }, [goals]);

  function addGoal(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = newGoalText.trim();
    if (!trimmed) return;
    const g: Goal = { id: String(Date.now()), text: trimmed, done: false, daily: newGoalDaily };
    setGoals((s) => [g, ...s]);
    setNewGoalText("");
    setNewGoalDaily(true);
  }

  function toggleGoal(id: string) {
    setGoals((s) => s.map((g) => (g.id === id ? { ...g, done: !g.done } : g)));
  }

  function removeGoal(id: string) {
    setGoals((s) => s.filter((g) => g.id !== id));
  }

  function incrementWater() { setWater((w) => Math.min(20, w + 1)); }
  function decrementWater() { setWater((w) => Math.max(0, w - 1)); }

  // Small accessible mood label map
  const moodLabels: { [k: string]: string } = {
    happy: "Happy",
    neutral: "Neutral",
    tired: "Tired",
    stressed: "Stressed",
    calm: "Calm",
  };

  if (loading) return <div className="p-4 text-gray-400">Loading social data…</div>;

  return (
    <div className="space-y-6">
      {/* Header / Overview */}
      <div className="rounded-2xl bg-white/6 p-5">
        <h3 className="text-lg font-semibold">Personal Overview</h3>
        <p className="text-sm text-gray-400 mt-1">Your quick health, relationships, goals and reflections — simple and private.</p>

        <div className="flex gap-4 mt-4">
          <div className="text-sm text-gray-300">Steps today: <span className="text-white">{profile?.stepsToday ?? "—"}</span></div>
          <div className="text-sm text-gray-300">Sleep: <span className="text-white">{profile?.sleepHours ? `${profile.sleepHours}h` : "—"}</span></div>
          <div className="text-sm text-gray-300">Water: <span className="text-white">{water} glasses</span></div>
        </div>
      </div>

      {/* 1. Mental & Physical Health */}
      <section aria-labelledby="health-heading" className="rounded-2xl bg-white/6 p-4">
        <div className="flex justify-between items-center">
          <h4 id="health-heading" className="font-semibold">1. Mental & Physical Health</h4>
          <span className="text-xs text-gray-400">Track mood, sleep, movement</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          {/* Mood */}
          <div className="p-3 bg-black/40 rounded-lg">
            <div className="text-sm text-gray-300">Mood</div>
            <div className="mt-2 flex gap-2 items-center" role="radiogroup" aria-label="Mood selection">
              {Object.keys(moodLabels).map((m) => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  aria-pressed={mood === m}
                  className={`px-3 py-1 rounded-full text-sm ${mood === m ? "bg-green-600 text-white" : "bg-white/6 text-gray-200"}`}
                >
                  {moodLabels[m]}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-2">Current: <span className="text-white">{moodLabels[mood] ?? mood}</span></div>
          </div>

          {/* Sleep */}
          <div className="p-3 bg-black/40 rounded-lg">
            <div className="text-sm text-gray-300">Sleep</div>
            <div className="mt-2 text-sm text-white">{profile?.sleepHours ? `${profile.sleepHours} hours` : "Not recorded"}</div>
            <div className="text-xs text-gray-400 mt-2">Tip: Try to keep a regular bedtime for better rest.</div>
          </div>

          {/* Activity / Steps */}
          <div className="p-3 bg-black/40 rounded-lg">
            <div className="text-sm text-gray-300">Activity</div>
            <div className="mt-2 text-sm text-white">{profile?.stepsToday ? `${profile.stepsToday} steps` : "—"}</div>
            <div className="text-xs text-gray-400 mt-2">Small walks add up — aim for a short walk after meals.</div>
          </div>
        </div>

        {/* Water controls */}
        <div className="flex items-center gap-3 mt-4">
          <div className="text-sm text-gray-300">Water intake</div>
          <div className="flex items-center gap-2">
            <button aria-label="Decrease water" onClick={decrementWater} className="px-2 py-1 rounded bg-white/6">-</button>
            <div className="w-16 text-center text-white">{water}x</div>
            <button aria-label="Increase water" onClick={incrementWater} className="px-2 py-1 rounded bg-white/10">+</button>
          </div>
          <div className="text-xs text-gray-400">glasses</div>
        </div>
      </section>

      {/* 2. Personal Relationships */}
      <section aria-labelledby="relationships-heading" className="rounded-2xl bg-white/6 p-4">
        <div className="flex justify-between items-center">
          <h4 id="relationships-heading" className="font-semibold">2. Personal Relationships</h4>
          <span className="text-xs text-gray-400">Friends, requests, pages</span>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Friends card */}
          <div className="p-3 bg-black/40 rounded-lg">
            <div className="text-sm text-gray-300">Friends</div>
            {friends.length === 0 ? (
              <div className="text-sm text-gray-400 mt-3">No friends yet. Use search to connect.</div>
            ) : (
              <ul className="mt-3 space-y-2" aria-live="polite">
                {friends.map((f) => (
                  <li key={f.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={f.avatarUrl ?? "/avatar-placeholder.png"} alt={`${f.name ?? f.id} avatar`} className="w-8 h-8 rounded-full" />
                      <div>
                        <div className="font-medium text-white">{f.name ?? f.id}</div>
                      </div>
                    </div>
                    <button className="px-3 py-1 rounded bg-white/10">View</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Incoming requests */}
          <div className="p-3 bg-black/40 rounded-lg">
            <div className="text-sm text-gray-300">Incoming Friend Requests</div>
            {incoming.length === 0 ? (
              <div className="text-sm text-gray-400 mt-3">No new requests.</div>
            ) : (
              <ul className="mt-3 space-y-2">
                {incoming.map((r) => (
                  <li key={r.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={r.sender?.avatarUrl ?? "/avatar-placeholder.png"} alt="request avatar" className="w-8 h-8 rounded-full" />
                      <div>
                        <div className="font-medium text-white">{r.sender?.name ?? r.sender?.id}</div>
                        {r.message && <div className="text-xs text-gray-400">{r.message}</div>}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => respondRequest(r.id, "accept")} className="px-3 py-1 rounded bg-green-600">Accept</button>
                      <button onClick={() => respondRequest(r.id, "reject")} className="px-3 py-1 rounded bg-gray-700">Reject</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Unified search */}
        <div className="mt-4">
          <UnifiedSearch
            initialMode="pages"
            placeholder="Search pages or switch to People"
            pageFetchUrl="/api/user/pages"
            onFollowPage={async (pageId: string) => { await followPage(pageId); }}
            onUnfollowPage={async (pageId: string) => { await unfollowPage(pageId); }}
            onSendFriend={async (userId: string) => { await sendFriend(userId); }}
            friendState={{
              friends: friends.map((f) => f.id),
              outgoing: outgoing.map((r) => (r.receiver?.id ?? r.receiverId ?? "") as string),
              incoming: incoming.map((r) => (r.sender?.id ?? r.senderId ?? "") as string),
            }}
          />
        </div>
      </section>

      {/* 3. Life Goals */}
      <section aria-labelledby="goals-heading" className="rounded-2xl bg-white/6 p-4">
        <div className="flex justify-between items-center">
          <h4 id="goals-heading" className="font-semibold">3. Life Goals & Daily Tasks</h4>
          <span className="text-xs text-gray-400">Short-term and long-term goals</span>
        </div>

        <form onSubmit={addGoal} className="mt-3 flex flex-col md:flex-row gap-2">
          <input
            aria-label="New goal"
            className="flex-1 p-2 rounded bg-black/30 text-white text-sm"
            placeholder="Add a goal (e.g. 'Read 15 pages' or 'Start learning guitar')"
            value={newGoalText}
            onChange={(e) => setNewGoalText(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-300 flex items-center gap-1">
              <input type="checkbox" checked={newGoalDaily} onChange={(e) => setNewGoalDaily(e.target.checked)} />
              <span className="text-xs">Daily</span>
            </label>
            <button type="submit" className="px-3 py-1 rounded bg-green-600">Add</button>
          </div>
        </form>

        <div className="mt-4">
          {goals.length === 0 ? (
            <div className="text-sm text-gray-400">No goals yet — add your first goal above.</div>
          ) : (
            <ul className="space-y-2">
              {goals.map((g) => (
                <li key={g.id} className="flex items-center justify-between p-2 bg-black/30 rounded">
                  <div className="flex items-center gap-3">
                    <input aria-label={`Mark ${g.text} as done`} type="checkbox" checked={g.done} onChange={() => toggleGoal(g.id)} />
                    <div>
                      <div className={`font-medium ${g.done ? "line-through text-gray-400" : "text-white"}`}>{g.text}</div>
                      <div className="text-xs text-gray-400">{g.daily ? "Daily" : "Long-term"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeGoal(g.id)} className="px-2 py-1 rounded bg-white/6">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 4. Self Reflection */}
      <section aria-labelledby="reflection-heading" className="rounded-2xl bg-white/6 p-4">
        <div className="flex justify-between items-center">
          <h4 id="reflection-heading" className="font-semibold">4. Self Reflection</h4>
          <span className="text-xs text-gray-400">Quick journal & gratitude</span>
        </div>

        <div className="mt-3">
          <textarea
            aria-label="Journal"
            className="w-full p-3 rounded bg-black/30 text-white text-sm min-h-[120px]"
            placeholder="Write a short note: what went well today? what would you like to improve?"
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
          />
          <div className="flex justify-between items-center mt-2">
            <div className="text-xs text-gray-400">Your journal is saved locally in your browser.</div>
            <button onClick={() => { setJournal(""); localStorage.removeItem("self.journal"); }} className="px-3 py-1 rounded bg-white/6">Clear</button>
          </div>
        </div>
      </section>

      {/* Following Pages (existing block) */}
      <div className="rounded-2xl bg-white/6 p-4">
        <h4 className="font-semibold mb-3">Following Pages</h4>

        {follows.length === 0 ? (
          <div className="text-sm text-gray-400 mt-3">You're not following any pages.</div>
        ) : (
          <ul className="space-y-2 mt-3">
            {follows.map((f) => (
              <li key={f.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">{f.page.title}</div>
                  {f.page.description && <div className="text-xs text-gray-400">{f.page.description}</div>}
                </div>
                <button onClick={() => unfollowPage(f.page.id)} className="px-2 py-1 rounded bg-white/10">Unfollow</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
