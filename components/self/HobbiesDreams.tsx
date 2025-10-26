"use client";

import React, { useState } from "react";
import useInputList from "@/hooks/useInputList";

export default function HobbiesDreams() {
  const [currentPromptIndex, setPromptIndex] = useState(0);
  const prompts = [
    "What brings you joy?",
    "What do you like to do in leisure time?",
    "What makes you lose track of time?",
  ];
  const [currentInput, setInput] = useState("");
  const { list: hobbies, add: addHobby, remove: removeHobby } = useInputList();

  const [todos, setTodos] = useState<{ [key: string]: { text: string; freq: string }[] }>({});

  const handleAdd = () => {
    if (!currentInput.trim()) return;
    addHobby(currentInput);
    setInput("");
    setPromptIndex((i) => (i + 1) % prompts.length);
  };

  const addTodo = (hobby: string, text: string, freq: string) => {
    if (!text.trim()) return;
    setTodos((prev) => ({
      ...prev,
      [hobby]: [...(prev[hobby] || []), { text, freq }],
    }));
  };

  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <h3 className="font-semibold mb-2">Your dreams and hobbies</h3>

      <div className="text-sm text-gray-400 mb-1">{prompts[currentPromptIndex]}</div>

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 rounded bg-black/40 px-2 py-1 text-white"
          placeholder="Type your dream or hobby..."
          value={currentInput}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button onClick={handleAdd} className="px-3 py-1 bg-green-600 rounded">
          Add
        </button>
      </div>

      {hobbies.length === 0 ? (
        <div className="text-sm text-gray-500">Start by adding something that excites you.</div>
      ) : (
        <div className="space-y-3">
          {hobbies.map((h, i) => (
            <div key={i} className="bg-black/40 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <div className="text-white font-medium">{h}</div>
                <button
                  onClick={() => removeHobby(i)}
                  className="text-xs bg-white/10 px-2 py-1 rounded"
                >
                  Remove
                </button>
              </div>

              <div className="mt-2">
                <label className="text-xs text-gray-400">What’s your to-do for this?</label>
                <div className="flex gap-2 mt-1">
                  <input
                    id={`todo-${i}`}
                    className="flex-1 bg-black/30 text-white rounded px-2 py-1 text-sm"
                    placeholder="e.g. Paint every Sunday"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        addTodo(h, (e.target as HTMLInputElement).value, "weekly");
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                  />
                  <select
                    className="bg-black/30 text-white text-sm rounded px-2"
                    onChange={(e) =>
                      addTodo(h, "", e.target.value) // will fill freq if blank text later
                    }
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly" selected>
                      Weekly
                    </option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              {todos[h]?.length > 0 && (
                <ul className="mt-2 text-sm text-gray-300 list-disc pl-5">
                  {todos[h].map((t, idx) => (
                    <li key={idx}>
                      {t.text || "—"} <span className="text-gray-500">({t.freq})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
