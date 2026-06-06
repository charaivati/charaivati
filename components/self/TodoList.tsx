"use client";
// components/self/TodoList.tsx
// BIZDOC-4: General todo list for the Self-tab — shows ALL todos across all ideas and hobbies.
// Business-idea tasks show a small tag badge. ONE list, one source of truth.

import React, { useCallback, useEffect, useRef, useState } from "react";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  freq: string | null;
  ideaId: string | null;
  hobbyId: string | null;
  validationLabel: string | null;
  successThreshold: string | null;
  createdAt: string;
}

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/self/todos", { credentials: "include" });
      const j = await res.json();
      if (j.ok) setTodos(j.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addTodo() {
    const title = newTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/self/todos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const j = await res.json();
      if (j.ok && j.data) {
        setTodos((prev) => [j.data, ...prev]);
        setNewTitle("");
        inputRef.current?.focus();
      }
    } catch {
      // silent
    } finally {
      setAdding(false);
    }
  }

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
      setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, completed: !next } : t));
    } finally {
      setToggling(null);
    }
  }

  async function deleteTodo(todo: Todo) {
    if (deleting) return;
    setDeleting(todo.id);
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    try {
      await fetch(`/api/self/todos/${todo.id}`, { method: "DELETE", credentials: "include" });
    } catch {
      setTodos((prev) => [todo, ...prev]);
    } finally {
      setDeleting(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") addTodo();
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse h-11 rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  const pending = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);

  return (
    <div className="space-y-3">
      {/* Add input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a task…"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50"
        />
        <button
          onClick={addTodo}
          disabled={!newTitle.trim() || adding}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl text-white text-sm font-medium transition"
        >
          +
        </button>
      </div>

      {/* Pending tasks */}
      {pending.length > 0 && (
        <div className="space-y-1.5">
          {pending.map((todo) => (
            <TodoRow key={todo.id} todo={todo} toggling={toggling} deleting={deleting} onToggle={toggleComplete} onDelete={deleteTodo} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {pending.length === 0 && done.length === 0 && (
        <p className="text-sm text-white/30 italic text-center py-3">
          No tasks yet. Add one above.
        </p>
      )}

      {/* Completed tasks (collapsed unless small count) */}
      {done.length > 0 && (
        <details>
          <summary className="text-xs text-white/30 cursor-pointer select-none hover:text-white/50 transition">
            {done.length} completed
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {done.map((todo) => (
              <TodoRow key={todo.id} todo={todo} toggling={toggling} deleting={deleting} onToggle={toggleComplete} onDelete={deleteTodo} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function TodoRow({
  todo,
  toggling,
  deleting,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  toggling: string | null;
  deleting: string | null;
  onToggle: (t: Todo) => void;
  onDelete: (t: Todo) => void;
}) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div
      className={`group flex items-start gap-2.5 px-3 py-2 rounded-xl border transition ${
        todo.completed
          ? "bg-white/3 border-white/5 opacity-50"
          : "bg-white/5 border-white/8 hover:bg-white/7"
      }`}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(todo)}
        disabled={!!toggling}
        className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center transition ${
          todo.completed
            ? "bg-green-500 border-green-500"
            : "border-white/30 hover:border-green-400"
        } ${toggling === todo.id ? "opacity-50" : ""}`}
      >
        {todo.completed && (
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1 4.5L3.5 7L8 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${todo.completed ? "line-through text-white/30" : "text-white/80"}`}>
          {todo.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {todo.ideaId && (
            <span className="text-xs bg-indigo-900/50 text-indigo-300 px-1.5 py-0.5 rounded">
              {todo.validationLabel ?? "idea task"}
            </span>
          )}
          {todo.hobbyId && (
            <span className="text-xs bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded">
              hobby
            </span>
          )}
          {todo.successThreshold && !todo.completed && (
            <span className="text-xs text-white/25">Pass: {todo.successThreshold}</span>
          )}
        </div>
      </div>

      {/* Delete */}
      {showDelete && (
        <button
          onClick={() => onDelete(todo)}
          disabled={!!deleting}
          className="flex-shrink-0 text-white/20 hover:text-red-400 transition text-xs"
          aria-label="Delete task"
        >
          ✕
        </button>
      )}
    </div>
  );
}
