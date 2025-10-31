//SelfAnalyticsDashboard

"use client";

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts";

// Dashboard component that visualises usage, mood, goals & hobbies
// Drop this in your Self area (client-side) as <SelfAnalyticsDashboard />

type Usage = { id: string; section: string; durationMs: number; startedAt: string; endedAt: string };
type MoodPoint = { recordedAt: string; moodRating?: number; healthRating?: number };
type Hobby = { id: string; title: string; todosCount?: number };

export default function SelfAnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [moods, setMoods] = useState<MoodPoint[]>([]);
  const [hobbies, setHobbies] = useState<Hobby[]>([]);
  const [goalsCompletedRate, setGoalsCompletedRate] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadAll() {
      setLoading(true);
      try {
        // try to fetch from your API endpoints; fall back to mock if unavailable
        const [uRes, mRes, hRes, gRes] = await Promise.allSettled([
          fetch("/api/self/usage", { credentials: "include" }),
          fetch("/api/self/moods", { credentials: "include" }),
          fetch("/api/self/hobbies", { credentials: "include" }),
          fetch("/api/self/todos/stats", { credentials: "include" }),
        ]);

        if (!alive) return;

        if (uRes.status === "fulfilled" && uRes.value.ok) {
          const j = await uRes.value.json().catch(() => null);
          setUsage(j?.data ?? []);
        }

        if (mRes.status === "fulfilled" && mRes.value.ok) {
          const j = await mRes.value.json().catch(() => null);
          setMoods(j?.data ?? []);
        }

        if (hRes.status === "fulfilled" && hRes.value.ok) {
          const j = await hRes.value.json().catch(() => null);
          setHobbies((j?.data ?? []).map((h: any) => ({ id: h.id, title: h.title, todosCount: (h.todos || []).length })));
        }

        if (gRes.status === "fulfilled" && gRes.value.ok) {
          const j = await gRes.value.json().catch(() => null);
          // expected: { completedRate: 0.72 }
          setGoalsCompletedRate(j?.data?.completedRate ?? null);
        }

        // If none of the endpoints returned usable data, put small mock data so dashboard isn't empty.
        if ((uRes as any).status !== "fulfilled" && (mRes as any).status !== "fulfilled") {
          // provide minimal mock
          setUsage([
            { id: "u1", section: "self", durationMs: 25 * 60 * 1000, startedAt: new Date().toISOString(), endedAt: new Date().toISOString() },
            { id: "u2", section: "learn", durationMs: 45 * 60 * 1000, startedAt: new Date().toISOString(), endedAt: new Date().toISOString() },
          ]);

          setMoods([
            { recordedAt: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(), moodRating: 3, healthRating: 3 },
            { recordedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(), moodRating: 4, healthRating: 4 },
            { recordedAt: new Date().toISOString(), moodRating: 5, healthRating: 4 },
          ]);

          setHobbies([{ id: "h1", title: "Guitar", todosCount: 3 }, { id: "h2", title: "Running", todosCount: 7 }]);
          setGoalsCompletedRate(0.42);
        }
      } catch (err) {
        console.error("Dashboard load error", err);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadAll();
    return () => {
      alive = false;
    };
  }, []);

  // helpers
  function msToMinutes(ms: number) {
    return Math.round(ms / 60000);
  }

  // prepare chart data
  const usageBySection = usage.reduce((acc: Record<string, number>, u) => {
    acc[u.section] = (acc[u.section] || 0) + (u.durationMs || 0);
    return acc;
  }, {} as Record<string, number>);

  const usagePie = Object.keys(usageBySection).map((k) => ({ name: k, value: Math.round(usageBySection[k] / 60000) }));

  const moodTrend = moods
    .slice()
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map((m) => ({ date: new Date(m.recordedAt).toLocaleDateString(), mood: m.moodRating ?? null, health: m.healthRating ?? null }));

  const topHobbies = hobbies.slice().sort((a, b) => (b.todosCount ?? 0) - (a.todosCount ?? 0)).slice(0, 6);

  const COLORS = ["#22c55e", "#60a5fa", "#f97316", "#ef4444", "#a78bfa", "#f59e0b"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 rounded-2xl bg-white/6 p-4">
          <h4 className="font-semibold mb-2">Time spent by section (minutes)</h4>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={usagePie} outerRadius={80} innerRadius={36} label>
                  {usagePie.map((entry, idx) => (
                    <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => `${v} min`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="w-full md:w-1/3 rounded-2xl bg-white/6 p-4">
          <h4 className="font-semibold mb-2">Goals completion</h4>
          <div className="text-3xl font-bold">{goalsCompletedRate != null ? `${Math.round((goalsCompletedRate || 0) * 100)}%` : "—"}</div>
          <div className="text-sm text-gray-400 mt-2">Completed of created todos/goals (recent)</div>

          <div className="mt-4">
            <h5 className="text-sm font-medium mb-2">Top hobbies</h5>
            <ul className="space-y-2">
              {topHobbies.map((h, i) => (
                <li key={h.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span>{h.title}</span>
                  </div>
                  <div className="text-gray-400 text-xs">{h.todosCount ?? 0} tasks</div>
                </li>
              ))}
              {topHobbies.length === 0 && <li className="text-sm text-gray-400">No hobbies yet.</li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/6 p-4">
          <h4 className="font-semibold mb-2">Mood & Health trend</h4>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={moodTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[1, 5]} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="mood" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="health" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-gray-400">Ratings are 1 (low) → 5 (high). Encourage daily logging.</div>
        </div>

        <div className="rounded-2xl bg-white/6 p-4">
          <h4 className="font-semibold mb-2">Recent activity</h4>
          <div className="max-h-56 overflow-auto">
            {usage.length === 0 ? (
              <div className="text-sm text-gray-400">No recent activity recorded.</div>
            ) : (
              <ul className="space-y-2">
                {usage.slice(0, 20).map((u) => (
                  <li key={u.id} className="flex items-center justify-between p-2 bg-black/30 rounded">
                    <div>
                      <div className="font-medium text-sm">{u.section}</div>
                      <div className="text-xs text-gray-400">{new Date(u.startedAt).toLocaleString()}</div>
                    </div>
                    <div className="text-sm">{msToMinutes(u.durationMs)}m</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white/6 p-4">
        <h4 className="font-semibold mb-2">How this dashboard is democratic</h4>
        <div className="text-sm text-gray-300">
          This page shows aggregated personal data that you control. We recommend: opt-in analytics, clear export/delete options, and a simple consent prompt. If you're building shared/community views later, show anonymized aggregates only (no personal IDs) and allow users to opt out.
        </div>
      </div>

      {loading && <div className="text-xs text-gray-400">Updating…</div>}
    </div>
  );
}
