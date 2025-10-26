// app/user/tabs/LearningTab.tsx
"use client";
import React, { useState } from "react";

export default function LearningTab() {
  const [subjects, setSubjects] = useState<string[]>([
    "Literature",
    "Mathematics",
    "History",
    "Economics",
    "Science",
  ]);

  const [newSubject, setNewSubject] = useState("");

  function addSubject() {
    const s = newSubject.trim();
    if (!s) return;
    setSubjects((x) => [...x, s]);
    setNewSubject("");
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        {subjects.map((s) => (
          <div key={s} className="p-4 bg-black/40 rounded-lg">
            <div className="font-semibold">{s}</div>
            <div className="text-sm text-gray-400 mt-2">Resources and notes go here.</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <input
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          placeholder="Add subject"
          className="p-2 rounded bg-white/6 flex-1"
        />
        <button onClick={addSubject} className="px-4 py-2 rounded bg-green-600">Add</button>
      </div>
    </div>
  );
}
