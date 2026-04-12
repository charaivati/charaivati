"use client";
// blocks/TimeBlock.tsx — simple daily task list

import React, { useState, useRef, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { CollapsibleSection, uid } from "@/components/self/shared";
import type { GoalEntry, DayKey, WeekSchedule, Task } from "@/types/self";

export type { WeekSchedule };
export function defaultWeekSchedule(): WeekSchedule { return { slots: [], tasks: [] }; }

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS: { key: DayKey; short: string }[] = [
  { key: "mon", short: "Mon" },
  { key: "tue", short: "Tue" },
  { key: "wed", short: "Wed" },
  { key: "thu", short: "Thu" },
  { key: "fri", short: "Fri" },
  { key: "sat", short: "Sat" },
  { key: "sun", short: "Sun" },
];

const jsToKey: Record<number, DayKey> = { 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };
const todayKey: DayKey = jsToKey[new Date().getDay()] ?? "mon";

// ─── TimeSection ──────────────────────────────────────────────────────────────

export function TimeSection({
  schedule,
  goals,
  onChange,
  defaultOpen = false,
}: {
  schedule: WeekSchedule;
  goals: GoalEntry[];
  onChange: (s: WeekSchedule) => void;
  defaultOpen?: boolean;
}) {
  const tasks: Task[] = schedule.tasks ?? [];

  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey);
  const [adding, setAdding]           = useState(false);
  const [newTitle, setNewTitle]       = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const dayTasks = tasks.filter(t => t.day === selectedDay);

  function toggleTask(id: string) {
    onChange({
      ...schedule,
      tasks: tasks.map(t => t.id === id ? { ...t, done: !t.done } : t),
    });
  }

  function removeTask(id: string) {
    onChange({ ...schedule, tasks: tasks.filter(t => t.id !== id) });
  }

  function commitAdd() {
    const title = newTitle.trim();
    if (!title) { setAdding(false); return; }
    const task: Task = { id: uid(), title, done: false, day: selectedDay };
    onChange({ ...schedule, tasks: [...tasks, task] });
    setNewTitle("");
    setAdding(false);
  }

  return (
    <CollapsibleSection title="Time" subtitle="Daily tasks" defaultOpen={defaultOpen}>
      <div className="space-y-3 pt-1">

        {/* ── Task list ── */}
        <div className="space-y-1">
          {dayTasks.length === 0 && !adding && (
            <p className="text-sm text-gray-600 py-2">No tasks for this day.</p>
          )}

          {dayTasks.map(task => (
            <div key={task.id}
              className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                bg-gray-900/60 border border-gray-800 cursor-pointer
                hover:border-gray-700 transition-colors
                ${task.done ? "opacity-50" : ""}`}
              onClick={() => toggleTask(task.id)}>
              <span className="flex-shrink-0 text-base leading-none select-none"
                style={{ color: task.done ? "#22c55e" : "#6b7280" }}>
                {task.done ? "●" : "○"}
              </span>
              <span className={`flex-1 text-sm ${task.done ? "line-through text-gray-500" : "text-gray-200"}`}>
                {task.title}
              </span>
              <button type="button"
                onClick={e => { e.stopPropagation(); removeTask(task.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-600
                  hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Inline add input */}
          {adding ? (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl
              border border-indigo-500/50 bg-gray-900/60">
              <span className="flex-shrink-0 text-base leading-none text-gray-600">○</span>
              <input
                ref={inputRef}
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter")  commitAdd();
                  if (e.key === "Escape") { setAdding(false); setNewTitle(""); }
                }}
                onBlur={commitAdd}
                placeholder="Task name…"
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-600
                  outline-none"
              />
            </div>
          ) : (
            <button type="button"
              onClick={() => setAdding(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl
                border border-dashed border-gray-800 text-sm text-gray-600
                hover:border-gray-600 hover:text-gray-400 transition-colors text-left">
              + Add
            </button>
          )}
        </div>

        {/* ── Days row ── */}
        <div className="flex gap-1 pt-2 border-t border-gray-800/60">
          {DAYS.map(d => {
            const hasTasks = tasks.some(t => t.day === d.key);
            const isSelected = selectedDay === d.key;
            const isToday = d.key === todayKey;
            return (
              <button key={d.key} type="button"
                onClick={() => { setSelectedDay(d.key); setAdding(false); setNewTitle(""); }}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs
                  transition-all"
                style={{
                  background: isSelected ? "#0e7490" : "transparent",
                  color: isSelected ? "#fff" : isToday ? "#22d3ee" : "#6b7280",
                  fontWeight: isSelected || isToday ? 600 : 400,
                }}>
                {d.short}
                {hasTasks && (
                  <span className="w-1 h-1 rounded-full"
                    style={{ background: isSelected ? "rgba(255,255,255,0.6)" : "#0e7490" }} />
                )}
              </button>
            );
          })}
        </div>

      </div>
    </CollapsibleSection>
  );
}
