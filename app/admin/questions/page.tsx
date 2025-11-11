// app/admin/questions/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Option = { value: string; label: string; score?: number; nextQuestionId?: string };

type Question = {
  id: string;
  order: number;
  text: string;
  type: "text" | "select";
  category: string;
  scoringDim: string;
  options?: Option[] | null;
  helpText?: string | null;
  examples?: string | null;
  randomizeOptions?: boolean | null;
};

export default function AdminQuestionsPage() {
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState<{ id?: string; email?: string } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<Partial<Question> | null>(null);

  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState<Partial<Question>>({
    order: undefined,
    type: "text",
    category: "general",
    scoringDim: "problemClarity",
    randomizeOptions: true,
    options: [],
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let alive = true;
    async function checkAdmin() {
      try {
        const res = await fetch("/api/admin/verify");
        if (res.ok) {
          const data = await res.json();
          if (!alive) return;
          setIsAdmin(true);
          setAdminUser(data.user ?? null);
          await fetchQuestions();
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        setIsAdmin(false);
      } finally {
        if (alive) setLoading(false);
      }
    }
    checkAdmin();
    return () => {
      alive = false;
    };
  }, []);

  const fetchQuestions = async () => {
    try {
      setError("");
      const res = await fetch("/api/admin/questions");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: Question[] = await res.json();
      const normalized = data.map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : q.options === null ? [] : (q.options as any) ?? [],
      }));
      setQuestions(normalized);
    } catch (err) {
      console.error(err);
      setError("Failed to load questions");
    }
  };

  const handleStartCreate = () => {
    setCreating(true);
    setNewForm({
      order: (questions.length ? Math.max(...questions.map((q) => q.order)) + 1 : 1),
      type: "text",
      category: "general",
      scoringDim: "problemClarity",
      randomizeOptions: true,
      options: [],
    });
    setError("");
    setSuccess("");
  };

  const handleCancelCreate = () => {
    setCreating(false);
    setNewForm({
      order: undefined,
      type: "text",
      category: "general",
      scoringDim: "problemClarity",
      randomizeOptions: true,
      options: [],
    });
  };

  const handleCreateSave = async () => {
    try {
      setError("");
      setSuccess("");
      if (!newForm?.text) {
        setError("Question text is required");
        return;
      }

      const payload: any = {
        order: Number(newForm.order ?? (questions.length ? Math.max(...questions.map((q) => q.order)) + 1 : 1)),
        text: newForm.text,
        type: newForm.type ?? "text",
        category: newForm.category ?? "general",
        scoringDim: newForm.scoringDim ?? "problemClarity",
        options: newForm.options && (newForm.options as Option[]).length ? newForm.options : undefined,
        helpText: newForm.helpText ?? undefined,
        examples: newForm.examples ?? undefined,
        randomizeOptions: newForm.randomizeOptions ?? true,
      };

      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Create failed");
      }

      setSuccess("Question created");
      setCreating(false);
      setNewForm({
        order: undefined,
        type: "text",
        category: "general",
        scoringDim: "problemClarity",
        randomizeOptions: true,
        options: [],
      });
      setTimeout(fetchQuestions, 300);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to create question");
    }
  };

  const handleEditClick = (q: Question) => {
    setEditingId(q.id);
    setEditingForm({
      ...q,
      options: Array.isArray(q.options) ? q.options.map((o) => ({ ...o })) : [],
    });
    setError("");
    setSuccess("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingForm(null);
  };

  const handleSaveEdit = async () => {
    try {
      if (!editingForm?.id || !editingForm?.text) {
        setError("id and text required");
        return;
      }

      const payload: any = {
        id: editingForm.id,
        order: Number(editingForm.order ?? 0),
        text: editingForm.text,
        type: editingForm.type ?? "text",
        category: editingForm.category ?? "general",
        scoringDim: editingForm.scoringDim ?? "problemClarity",
        options: editingForm.options && (editingForm.options as Option[]).length ? editingForm.options : undefined,
        helpText: editingForm.helpText ?? undefined,
        examples: editingForm.examples ?? undefined,
        randomizeOptions: editingForm.randomizeOptions ?? true,
      };

      const res = await fetch("/api/admin/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Update failed");
      }

      setSuccess("Question updated");
      setEditingId(null);
      setEditingForm(null);
      setTimeout(fetchQuestions, 300);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to update question");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      const res = await fetch(`/api/admin/questions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Delete failed");
      }
      setSuccess("Question deleted");
      setTimeout(fetchQuestions, 200);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to delete question");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800 rounded-lg p-8 text-center">
          <p className="text-red-400 text-lg mb-4">Unauthorized</p>
          <p className="text-slate-400">You need admin access to view this page</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white">Admin — Questions</h1>
            {adminUser && <p className="text-slate-400 mt-1">Logged in as: {adminUser.email}</p>}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleStartCreate}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              + Create New
            </button>

            <button
              onClick={() => {
                setSuccess("");
                setError("");
                fetchQuestions();
              }}
              className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded text-green-300">
            {success}
          </div>
        )}

        {/* Create Form */}
        {creating && newForm && (
          <div className="mb-6 bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Create Question</h2>

            <div className="grid gap-4">
              <div>
                <label className="text-slate-300 block mb-1">Order</label>
                <input
                  type="number"
                  value={newForm.order ?? ""}
                  onChange={(e) => setNewForm((f) => ({ ...f, order: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Question Text *</label>
                <input
                  type="text"
                  value={newForm.text ?? ""}
                  onChange={(e) => setNewForm((f) => ({ ...f, text: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-300 block mb-1">Type</label>
                  <select
                    value={newForm.type}
                    onChange={(e) => setNewForm((f) => ({ ...f, type: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  >
                    <option value="text">Text</option>
                    <option value="select">Select (multi-choice)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Scoring Dimension</label>
                  <select
                    value={newForm.scoringDim}
                    onChange={(e) => setNewForm((f) => ({ ...f, scoringDim: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  >
                    <option value="problemClarity">Problem Clarity</option>
                    <option value="marketNeed">Market Need</option>
                    <option value="targetAudience">Target Audience</option>
                    <option value="uniqueValue">Unique Value</option>
                    <option value="feasibility">Feasibility</option>
                    <option value="monetization">Monetization</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Category</label>
                <input
                  type="text"
                  value={newForm.category ?? ""}
                  onChange={(e) => setNewForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Help text</label>
                <input
                  type="text"
                  value={newForm.helpText ?? ""}
                  onChange={(e) => setNewForm((f) => ({ ...f, helpText: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                />
              </div>

              {/* Options editor with BRANCHING */}
              {newForm.type === "select" && (
                <div>
                  <label className="text-slate-300 block mb-2">Options (with optional branching)</label>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {(newForm.options ?? []).map((opt, idx) => (
                      <div key={idx} className="bg-slate-700/40 p-3 rounded border border-slate-600">
                        <div className="flex gap-2 items-end mb-2">
                          <input
                            placeholder="value"
                            value={opt.value}
                            onChange={(e) =>
                              setNewForm((f) => {
                                const opts = (f.options ?? []).slice();
                                opts[idx] = { ...(opts[idx] ?? { value: "", label: "", score: 0 }), value: e.target.value };
                                return { ...f, options: opts };
                              })
                            }
                            className="flex-1 px-2 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                          />
                          <input
                            placeholder="label"
                            value={opt.label}
                            onChange={(e) =>
                              setNewForm((f) => {
                                const opts = (f.options ?? []).slice();
                                opts[idx] = { ...(opts[idx] ?? { value: "", label: "", score: 0 }), label: e.target.value };
                                return { ...f, options: opts };
                              })
                            }
                            className="flex-1 px-2 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                          />
                          <select
                            value={opt.score ?? 0}
                            onChange={(e) =>
                              setNewForm((f) => {
                                const opts = (f.options ?? []).slice();
                                opts[idx] = { ...(opts[idx] ?? { value: "", label: "", score: 0 }), score: parseInt(e.target.value) };
                                return { ...f, options: opts };
                              })
                            }
                            className="w-20 px-2 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                          >
                            <option value={-2}>-2</option>
                            <option value={-1}>-1</option>
                            <option value={0}>0</option>
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                          </select>
                          <button
                            onClick={() =>
                              setNewForm((f) => {
                                const opts = (f.options ?? []).filter((_, i) => i !== idx);
                                return { ...f, options: opts };
                              })
                            }
                            className="px-3 py-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                          >
                            ✕
                          </button>
                        </div>

                        {/* BRANCHING: Next Question */}
                        <div>
                          <label className="text-slate-400 text-xs block mb-1">→ Jump to question (branching):</label>
                          <select
                            value={opt.nextQuestionId ?? ""}
                            onChange={(e) =>
                              setNewForm((f) => {
                                const opts = (f.options ?? []).slice();
                                opts[idx] = { ...(opts[idx] ?? { value: "", label: "", score: 0 }), nextQuestionId: e.target.value || undefined };
                                return { ...f, options: opts };
                              })
                            }
                            className="w-full px-2 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                          >
                            <option value="">— Continue to next in sequence —</option>
                            {questions.map((q) => (
                              <option key={q.id} value={q.id}>
                                Q{q.order}: {q.text.substring(0, 40)}...
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() =>
                      setNewForm((f) => ({ ...f, options: [...(f.options ?? []), { value: "", label: "", score: 0 }] }))
                    }
                    className="mt-2 px-3 py-2 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30"
                  >
                    + Add option
                  </button>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-slate-700">
                <button onClick={handleCreateSave} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                  Save
                </button>
                <button onClick={handleCancelCreate} className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Questions list */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white mb-4">Existing Questions ({questions.length})</h2>

          {questions.map((q) => {
            const isEditing = editingId === q.id;
            return (
              <div key={q.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                {!isEditing ? (
                  <div className="flex justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-400">
                        Q{q.order} • {q.type} • {q.scoringDim}
                      </p>
                      <p className="text-white font-medium mt-1">{q.text}</p>
                      {q.helpText && <p className="text-slate-400 text-sm mt-2">Help: {q.helpText}</p>}

                      {q.type === "select" && Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="mt-3 text-sm bg-slate-700/50 p-3 rounded">
                          <p className="text-slate-300 font-medium mb-2">Options:</p>
                          <div className="space-y-1">
                            {q.options.map((opt, idx) => (
                              <p key={idx} className="text-slate-400 text-xs">
                                • <span className="text-slate-300">{opt.label}</span>{" "}
                                <span
                                  className={`font-bold ${
                                    (opt.score ?? 0) === 2
                                      ? "text-green-400"
                                      : (opt.score ?? 0) === 1
                                      ? "text-blue-400"
                                      : (opt.score ?? 0) === 0
                                      ? "text-slate-400"
                                      : (opt.score ?? 0) === -1
                                      ? "text-yellow-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  ({(opt.score ?? 0) >= 0 ? "+" : ""}{opt.score ?? 0})
                                </span>
                                {opt.nextQuestionId && (
                                  <span className="text-purple-400 text-xs ml-2">
                                    → Jump to Q{questions.find((x) => x.id === opt.nextQuestionId)?.order}
                                  </span>
                                )}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleEditClick(q)}
                        className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  // Inline edit form
                  <div className="space-y-4">
                    <div>
                      <label className="text-slate-300 block mb-1">Order</label>
                      <input
                        type="number"
                        value={editingForm?.order ?? ""}
                        onChange={(e) => setEditingForm((f) => ({ ...(f ?? {}), order: Number(e.target.value) }))}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 block mb-1">Question Text *</label>
                      <input
                        type="text"
                        value={editingForm?.text ?? ""}
                        onChange={(e) => setEditingForm((f) => ({ ...(f ?? {}), text: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-slate-300 block mb-1">Type</label>
                        <select
                          value={editingForm?.type ?? "text"}
                          onChange={(e) => setEditingForm((f) => ({ ...(f ?? {}), type: e.target.value as any }))}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                        >
                          <option value="text">Text</option>
                          <option value="select">Select</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-300 block mb-1">Scoring Dimension</label>
                        <select
                          value={editingForm?.scoringDim ?? "problemClarity"}
                          onChange={(e) => setEditingForm((f) => ({ ...(f ?? {}), scoringDim: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                        >
                          <option value="problemClarity">Problem Clarity</option>
                          <option value="marketNeed">Market Need</option>
                          <option value="targetAudience">Target Audience</option>
                          <option value="uniqueValue">Unique Value</option>
                          <option value="feasibility">Feasibility</option>
                          <option value="monetization">Monetization</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-300 block mb-1">Category</label>
                      <input
                        type="text"
                        value={editingForm?.category ?? ""}
                        onChange={(e) => setEditingForm((f) => ({ ...(f ?? {}), category: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 block mb-1">Help text</label>
                      <input
                        type="text"
                        value={editingForm?.helpText ?? ""}
                        onChange={(e) => setEditingForm((f) => ({ ...(f ?? {}), helpText: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                      />
                    </div>

                    {/* Options editor when select with BRANCHING */}
                    {editingForm?.type === "select" && (
                      <div>
                        <label className="text-slate-300 block mb-2">Options (with optional branching)</label>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {(editingForm.options ?? []).map((opt, i) => (
                            <div key={i} className="bg-slate-700/40 p-3 rounded border border-slate-600">
                              <div className="flex gap-2 items-end mb-2">
                                <input
                                  className="flex-1 px-2 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                  placeholder="value"
                                  value={opt.value}
                                  onChange={(e) =>
                                    setEditingForm((f) => {
                                      const opts = (f?.options ?? []).slice();
                                      opts[i] = { ...(opts[i] ?? { value: "", label: "", score: 0 }), value: e.target.value };
                                      return { ...(f ?? {}), options: opts };
                                    })
                                  }
                                />
                                <input
                                  className="flex-1 px-2 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                  placeholder="label"
                                  value={opt.label}
                                  onChange={(e) =>
                                    setEditingForm((f) => {
                                      const opts = (f?.options ?? []).slice();
                                      opts[i] = { ...(opts[i] ?? { value: "", label: "", score: 0 }), label: e.target.value };
                                      return { ...(f ?? {}), options: opts };
                                    })
                                  }
                                />
                                <select
                                  value={opt.score ?? 0}
                                  onChange={(e) =>
                                    setEditingForm((f) => {
                                      const opts = (f?.options ?? []).slice();
                                      opts[i] = { ...(opts[i] ?? { value: "", label: "", score: 0 }), score: parseInt(e.target.value) };
                                      return { ...(f ?? {}), options: opts };
                                    })
                                  }
                                  className="w-20 px-2 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                >
                                  <option value={-2}>-2</option>
                                  <option value={-1}>-1</option>
                                  <option value={0}>0</option>
                                  <option value={1}>1</option>
                                  <option value={2}>2</option>
                                </select>
                                <button
                                  onClick={() =>
                                    setEditingForm((f) => {
                                      const opts = (f?.options ?? []).filter((_, idx) => idx !== i);
                                      return { ...(f ?? {}), options: opts };
                                    })
                                  }
                                  className="px-3 py-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                                >
                                  ✕
                                </button>
                              </div>

                              {/* BRANCHING: Next Question */}
                              <div>
                                <label className="text-slate-400 text-xs block mb-1">→ Jump to question (branching):</label>
                                <select
                                  value={opt.nextQuestionId ?? ""}
                                  onChange={(e) =>
                                    setEditingForm((f) => {
                                      const opts = (f?.options ?? []).slice();
                                      opts[i] = { ...(opts[i] ?? { value: "", label: "", score: 0 }), nextQuestionId: e.target.value || undefined };
                                      return { ...(f ?? {}), options: opts };
                                    })
                                  }
                                  className="w-full px-2 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                                >
                                  <option value="">— Continue to next in sequence —</option>
                                  {questions.map((q) => (
                                    <option key={q.id} value={q.id}>
                                      Q{q.order}: {q.text.substring(0, 40)}...
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() =>
                            setEditingForm((f) => ({ ...(f ?? {}), options: [...(f?.options ?? []), { value: "", label: "", score: 0 }] }))
                          }
                          className="mt-2 px-3 py-2 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30"
                        >
                          + Add option
                        </button>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4 border-t border-slate-700">
                      <button onClick={handleSaveEdit} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                        Save
                      </button>
                      <button onClick={handleCancelEdit} className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}