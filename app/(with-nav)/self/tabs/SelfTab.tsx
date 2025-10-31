//app/(with-nav)/self/tabs/SelfTab.tsx

"use client";

import React, { useEffect, useState } from "react";
import UnifiedSearch from "@/components/UnifiedSearch";

type Friend = { id: string; name?: string | null; avatarUrl?: string | null; };
type RequestRow = { id: string; sender?: Friend; receiver?: Friend; senderId?: string; receiverId?: string; message?: string; createdAt?: string; };
type FollowRow = { id: string; page: { id: string; title: string; description?: string | null; avatarUrl?: string | null } };

type Goal = { id: string; text: string; done: boolean; daily: boolean };

// New hobby / todo types (local-first)
type Todo = { id: string; text: string; freq: "daily" | "weekly" | "monthly" };
type Hobby = { id: string; title: string; description?: string; todos: Todo[] };

export default function SelfTab({ profile }: { profile?: any }) {
  // Social state (unchanged)
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<RequestRow[]>([]);
  const [outgoing, setOutgoing] = useState<RequestRow[]>([]);
  const [follows, setFollows] = useState<FollowRow[]>([]);
  const [followPageId, setFollowPageId] = useState("");

  // Health / personal state (persist to localStorage)
  const [mood, setMood] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("self.mood") ?? "neutral" : "neutral"));
  const [journal, setJournal] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem("self.journal") ?? "" : ""));
  const [water, setWater] = useState<number>(() => (typeof window !== "undefined" ? Number(localStorage.getItem("self.water") ?? 0) : 0));

  // Goals (kept for backward compat)
  const [goals, setGoals] = useState<Goal[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("self.goals") || "[]"); } catch { return []; }
  });
  const [newGoalText, setNewGoalText] = useState("");
  const [newGoalDaily, setNewGoalDaily] = useState(true);

  // -----------------------
  // Hobbies & Dreams (new - left column)
  // -----------------------
  const prompts = [
    "What brings you joy?",
    "What do you like to do in your leisure time?",
    "What makes you lose track of time?",
  ];
  const [promptIdx, setPromptIdx] = useState(0);
  const [hobbyInput, setHobbyInput] = useState("");
  const [hobbies, setHobbies] = useState<Hobby[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("self.hobbies") || "[]"); } catch { return []; }
  });

  // simple local suggestion list (can be replaced with API fetch later)
  const [suggestions] = useState<string[]>([
    "Photography",
    "Writing",
    "Gardening",
    "Guitar",
    "Painting",
    "Cooking",
    "Running",
    "Meditation",
  ]);

  // load all social data
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
  // Persistence effects
  // ----------------------------
  useEffect(() => { localStorage.setItem("self.mood", mood); }, [mood]);
  useEffect(() => { localStorage.setItem("self.journal", journal); }, [journal]);
  useEffect(() => { localStorage.setItem("self.water", String(water)); }, [water]);
  useEffect(() => { localStorage.setItem("self.goals", JSON.stringify(goals)); }, [goals]);
  useEffect(() => { localStorage.setItem("self.hobbies", JSON.stringify(hobbies)); }, [hobbies]);

  // ----------------------------
  // Goals functions (existing)
  // ----------------------------
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

  // ----------------------------
  // Hobbies functions (new)
  // ----------------------------
  function addHobbyFromInput() {
    const title = hobbyInput.trim();
    if (!title) return;
    // avoid duplicates (case-insensitive)
    if (hobbies.some((h) => h.title.toLowerCase() === title.toLowerCase())) {
      setHobbyInput("");
      setPromptIdx((i) => (i + 1) % prompts.length);
      return;
    }
    const newH: Hobby = { id: String(Date.now()), title, todos: [] };
    setHobbies((s) => [newH, ...s]);
    setHobbyInput("");
    setPromptIdx((i) => (i + 1) % prompts.length);
  }

  function addHobby(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (hobbies.some((h) => h.title.toLowerCase() === trimmed.toLowerCase())) return;
    const newH: Hobby = { id: String(Date.now()), title: trimmed, todos: [] };
    setHobbies((s) => [newH, ...s]);
  }

  function removeHobby(id: string) {
    setHobbies((s) => s.filter((h) => h.id !== id));
  }

  function addTodoToHobby(hobbyId: string, text: string, freq: Todo["freq"]) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setHobbies((s) =>
      s.map((h) =>
        h.id === hobbyId ? { ...h, todos: [...h.todos, { id: String(Date.now()), text: trimmed, freq }] } : h
      )
    );
  }

  function removeTodo(hobbyId: string, todoId: string) {
    setHobbies((s) => s.map((h) => (h.id === hobbyId ? { ...h, todos: h.todos.filter((t) => t.id !== todoId) } : h)));
  }

  // accessible mood labels
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
      {/* Top: Search */}
      <div className="rounded-2xl bg-white/6 p-5">
        <h3 className="text-lg font-semibold">Search everything</h3>
        <p className="text-sm text-gray-400 mt-1">Find friends, pages, hashtags and more.</p>

        <div className="mt-4">
          <UnifiedSearch
            initialMode="pages"
            placeholder="Search people, pages, hashtags..."
            pageFetchUrl="/api/search"
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
      </div>

      {/* 1. Mental & Physical Health (center) */}
      <section aria-labelledby="health-heading" className="rounded-2xl bg-white/6 p-4">
        <div className="flex justify-between items-center">
          <h4 id="health-heading" className="font-semibold">1. Mental & Physical Health</h4>
          <span className="text-xs text-gray-400">Track mood, sleep, movement</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          {/* Mood */}
          <div className="p-3 bg-black/40 rounded-lg">
            <div className="text-sm text-gray-300">Mood</div>
            <div
              className="mt-2 flex flex-wrap gap-2 items-center"
              role="radiogroup"
              aria-label="Mood selection"
            >
              {Object.keys(moodLabels).map((m) => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  aria-pressed={mood === m}
                  className={`px-3 py-1 rounded-full text-sm ${mood === m ? "bg-green-600 text-white" : "bg-white/6 text-gray-200 hover:bg-white/10"}`}
                >
                  {moodLabels[m]}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Current: <span className="text-white">{moodLabels[mood] ?? mood}</span>
            </div>
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

      {/* Grid: Left = Hobbies & Todos, Right = Relationships */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Hobbies & Dreams */}
        <section aria-labelledby="hobbies-heading" className="rounded-2xl bg-white/6 p-4">
          <div className="flex justify-between items-center">
            <h4 id="hobbies-heading" className="font-semibold">Your Dreams & Hobbies</h4>
            <span className="text-xs text-gray-400">Write what brings you joy</span>
          </div>

          <div className="mt-3">
            <div className="text-sm text-gray-400 mb-2">{prompts[promptIdx]}</div>

            <div className="flex gap-2 mb-3">
              <input
                className="flex-1 rounded bg-black/30 px-2 py-1 text-white text-sm"
                placeholder="Type a hobby or dream (e.g. 'Learn guitar')"
                value={hobbyInput}
                onChange={(e) => setHobbyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addHobbyFromInput(); }}
              />
              <button onClick={addHobbyFromInput} className="px-3 py-1 rounded bg-green-600">Add</button>
            </div>

            {/* quick suggestion chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {suggestions.slice(0, 8).map((s) => (
                <button
                  key={s}
                  onClick={() => addHobby(s)}
                  className="text-xs px-2 py-1 rounded bg-white/6"
                >
                  {s}
                </button>
              ))}
            </div>

            {/* hobby list with todo entry */}
            {hobbies.length === 0 ? (
              <div className="text-sm text-gray-400">You have no hobbies yet. Add one to begin.</div>
            ) : (
              <div className="space-y-3">
                {hobbies.map((h) => (
                  <div key={h.id} className="bg-black/40 p-3 rounded-lg">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="font-medium text-white">{h.title}</div>
                        {h.description && <div className="text-xs text-gray-400">{h.description}</div>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => removeHobby(h.id)} className="text-xs px-2 py-1 rounded bg-white/10">Remove</button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="text-xs text-gray-400">Add a to-do</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          id={`todo-input-${h.id}`}
                          className="flex-1 bg-black/30 text-white rounded px-2 py-1 text-sm"
                          placeholder="e.g. Practice chords for 10 minutes"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const el = e.target as HTMLInputElement;
                              addTodoToHobby(h.id, el.value, "daily");
                              el.value = "";
                            }
                          }}
                        />
                        <select
                          className="bg-black/30 text-white text-sm rounded px-2"
                          onChange={(e) => {
                            // If user selects a freq without text, we just add a placeholder todo like "Recurring"
                            const freq = e.target.value as Todo["freq"];
                            addTodoToHobby(h.id, `Recurring (${freq})`, freq);
                            // reset select to weekly visually
                            (e.target as HTMLSelectElement).value = "weekly";
                          }}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly" defaultValue="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>

                      {h.todos.length > 0 && (
                        <ul className="mt-2 text-sm text-gray-300 list-disc pl-5 space-y-1">
                          {h.todos.map((t) => (
                            <li key={t.id} className="flex justify-between items-center">
                              <div>
                                {t.text} <span className="text-gray-500 text-xs">({t.freq})</span>
                              </div>
                              <button onClick={() => removeTodo(h.id, t.id)} className="text-xs px-2 py-1 rounded bg-white/6">Remove</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right: Personal Relationships (unchanged) */}
        <section aria-labelledby="relationships-heading" className="rounded-2xl bg-white/6 p-4">
          <div className="flex justify-between items-center">
            <h4 id="relationships-heading" className="font-semibold">2. Personal Relationships</h4>
            <span className="text-xs text-gray-400">Friends, requests, pages</span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3">
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

            {/* Unified search (in relationships column for quick connect) */}
            <div className="p-3 bg-black/40 rounded-lg">
              <UnifiedSearch
                initialMode="pages"
                placeholder="Search pages or people"
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
          </div>
        </section>
      </div>

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
