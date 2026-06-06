"use client";
// components/business/ValidationTasks.tsx
// BIZDOC-4: Filtered todo list for a business idea — ONE list, two views.
// Completing a task here calls the same API as the Self-tab todo list.
// For guests: renders tasks from the idea's marketSizing JSON (no DB write).

import React, { useEffect, useState, useCallback } from "react";
import type { MarketSizingData } from "./MarketSizingPanel";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  validationLabel: string | null;
  successThreshold: string | null;
  createdAt: string;
}

interface Props {
  /** Filter to a specific idea's todos. Omit (or use with validationOnly) for all validation todos. */
  ideaId?: string;
  isGuest: boolean;
  guestSizing?: MarketSizingData | null;
  /** When true, show all todos where validationLabel is set — not filtered to one idea. */
  validationOnly?: boolean;
}

export default function ValidationTasks({ ideaId, isGuest, guestSizing, validationOnly }: Props) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams();
      if (ideaId) params.set("ideaId", ideaId);
      if (validationOnly) params.set("validationOnly", "true");
      const res = await fetch(`/api/self/todos?${params}`, { credentials: "include" });
      const j = await res.json();
      if (j.ok) setTodos(j.data ?? []);
    } catch {
      // silent — non-blocking
    } finally {
      setLoading(false);
    }
  }, [ideaId, isGuest, validationOnly]);

  useEffect(() => { load(); }, [load]);

  async function toggleComplete(todo: Todo) {
    if (toggling) return;
    setToggling(todo.id);
    const next = !todo.completed;
    setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, completed: next } : t));
    try {
      await fetch(`/api/self/todos/${todo.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: next }),
      });
    } catch {
      // revert on error
      setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, completed: !next } : t));
    } finally {
      setToggling(null);
    }
  }

  // Guest view: render from marketSizing JSON
  if (isGuest) {
    const assumptions = guestSizing?.assumptions ?? [];
    if (!assumptions.length) return null;
    return (
      <div className="space-y-2">
        <SectionHeader count={assumptions.length} />
        {assumptions.map((a) => (
          <GuestTask key={a.id} label={a.label} task={a.validationTask} threshold={a.successThreshold} />
        ))}
        <p className="text-xs text-slate-500 italic pt-1">
          Sign in to save these tasks and track them from your todo list.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="animate-pulse h-14 rounded-xl bg-slate-800/60" />
        ))}
      </div>
    );
  }

  if (!todos.length) {
    // In validationOnly mode (Initiative Hub), don't render anything — caller handles conditional display
    if (validationOnly) return null;
    return (
      <p className="text-sm text-slate-500 italic">
        No validation tasks yet. Complete the market sizing step in the evaluation to generate them.
      </p>
    );
  }

  const done = todos.filter((t) => t.completed).length;

  // In validationOnly mode (Initiative Hub) — render a self-contained card
  if (validationOnly) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-2">
        <SectionHeader count={todos.length} done={done} />
        {todos.map((todo) => (
          <TodoRow key={todo.id} todo={todo} toggling={toggling} onToggle={toggleComplete} />
        ))}
        <p className="text-xs text-gray-500 pt-1">
          From your{" "}
          <a href="/business" className="text-indigo-400 underline">
            business evaluations
          </a>
          . View all in{" "}
          <a href="/self?tab=todo" className="text-indigo-400 underline">
            Self → Tasks
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SectionHeader count={todos.length} done={done} />
      {todos.map((todo) => (
        <TodoRow key={todo.id} todo={todo} toggling={toggling} onToggle={toggleComplete} />
      ))}
    </div>
  );
}

function SectionHeader({ count, done }: { count: number; done?: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
        Validation tasks
      </span>
      {done !== undefined && (
        <span className="text-xs text-slate-500">{done}/{count} done</span>
      )}
    </div>
  );
}

function TodoRow({
  todo,
  toggling,
  onToggle,
}: {
  todo: Todo;
  toggling: string | null;
  onToggle: (t: Todo) => void;
}) {
  const busy = toggling === todo.id;
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border transition ${
        todo.completed
          ? "bg-slate-800/30 border-slate-700/30 opacity-60"
          : "bg-slate-800/60 border-slate-700/40"
      }`}
    >
      <button
        onClick={() => onToggle(todo)}
        disabled={!!toggling}
        className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition ${
          todo.completed
            ? "bg-green-500 border-green-500"
            : "border-slate-500 hover:border-green-400"
        } ${busy ? "opacity-50" : ""}`}
        aria-label={todo.completed ? "Mark incomplete" : "Mark complete"}
      >
        {todo.completed && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${todo.completed ? "line-through text-slate-500" : "text-slate-200"}`}>
          {todo.title}
        </p>
        {todo.validationLabel && (
          <p className="text-xs text-indigo-400 mt-0.5">{todo.validationLabel}</p>
        )}
        {todo.successThreshold && (
          <p className="text-xs text-slate-500 mt-0.5">Pass: {todo.successThreshold}</p>
        )}
      </div>
    </div>
  );
}

function GuestTask({ label, task, threshold }: { label: string; task: string; threshold: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border bg-slate-800/40 border-slate-700/40">
      <div className="mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 border-slate-600" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 leading-snug">{task}</p>
        <p className="text-xs text-indigo-400 mt-0.5">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">Pass: {threshold}</p>
      </div>
    </div>
  );
}
