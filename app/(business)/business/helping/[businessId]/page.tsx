"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import InitiativePostsBlock from "@/components/initiative/InitiativePostsBlock";

type HelpingAction = { id: string; title: string; order: number };
type HelpingObjective = { id: string; title: string; order: number; actions: HelpingAction[] };
type HelpingMetric = { id: string; label: string; targetNumber: number; currentNumber: number; unit: string | null };

type Initiative = {
  id: string;
  pageId: string;
  cause: string | null;
  targetGroup: string | null;
  location: string | null;
  awarenessText: string | null;
  acceptDonations: boolean;
  donationMessage: string | null;
  objectives: HelpingObjective[];
  metrics: HelpingMetric[];
  page: { title: string };
};

async function api(path: string, method = "GET", body?: object) {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export default function HelpingInitiativeStudio() {
  const { businessId } = useParams<{ businessId: string }>();
  const router = useRouter();

  const [initiative, setInitiative] = useState<Initiative | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Focus area form state (local, saved explicitly)
  const [cause, setCause] = useState("");
  const [targetGroup, setTargetGroup] = useState("");
  const [location, setLocation] = useState("");
  const [awarenessText, setAwarenessText] = useState("");
  const [acceptDonations, setAcceptDonations] = useState(false);
  const [donationMessage, setDonationMessage] = useState("");

  // Objectives UI
  const [objectives, setObjectives] = useState<HelpingObjective[]>([]);
  const [newObjectiveTitle, setNewObjectiveTitle] = useState("");
  const [addingObjective, setAddingObjective] = useState(false);
  const [newActionTitles, setNewActionTitles] = useState<Record<string, string>>({});
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());

  // Metrics UI
  const [metrics, setMetrics] = useState<HelpingMetric[]>([]);
  const [newMetricLabel, setNewMetricLabel] = useState("");
  const [newMetricTarget, setNewMetricTarget] = useState("");
  const [newMetricUnit, setNewMetricUnit] = useState("");
  const [addingMetric, setAddingMetric] = useState(false);

  const initiativeId = initiative?.id;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api(`/api/helping-initiative/by-page/${businessId}`).catch(() => null);
    if (res?.ok && res.initiative) {
      const d = res.initiative as Initiative;
      setInitiative(d);
      setCause(d.cause ?? "");
      setTargetGroup(d.targetGroup ?? "");
      setLocation(d.location ?? "");
      setAwarenessText(d.awarenessText ?? "");
      setAcceptDonations(d.acceptDonations);
      setDonationMessage(d.donationMessage ?? "");
      setObjectives(d.objectives);
      setMetrics(d.metrics);
    }
    setLoading(false);
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  async function saveDetails() {
    if (!initiativeId) return;
    setSaving(true);
    await api(`/api/helping-initiative/${initiativeId}`, "PATCH", {
      cause, targetGroup, location, awarenessText, acceptDonations, donationMessage,
    });
    setSaving(false);
    setSaveMsg("Saved");
    setTimeout(() => setSaveMsg(""), 2000);
  }

  async function addObjective() {
    if (!initiativeId || !newObjectiveTitle.trim()) return;
    setAddingObjective(true);
    const res = await api(`/api/helping-initiative/${initiativeId}/objectives`, "POST", { title: newObjectiveTitle });
    if (res?.ok) {
      setObjectives((prev) => [...prev, res.objective]);
      setExpandedObjectives((prev) => new Set([...prev, res.objective.id]));
      setNewObjectiveTitle("");
    }
    setAddingObjective(false);
  }

  async function deleteObjective(objectiveId: string) {
    if (!initiativeId) return;
    await api(`/api/helping-initiative/${initiativeId}/objectives`, "DELETE", { objectiveId });
    setObjectives((prev) => prev.filter((o) => o.id !== objectiveId));
  }

  async function updateObjectiveTitle(objectiveId: string, title: string) {
    if (!initiativeId) return;
    await api(`/api/helping-initiative/${initiativeId}/objectives`, "PATCH", { objectiveId, title });
  }

  async function addAction(objectiveId: string) {
    if (!initiativeId) return;
    const title = (newActionTitles[objectiveId] || "").trim();
    if (!title) return;
    const res = await api(`/api/helping-initiative/${initiativeId}/actions`, "POST", { objectiveId, title });
    if (res?.ok) {
      setObjectives((prev) => prev.map((o) =>
        o.id === objectiveId ? { ...o, actions: [...o.actions, res.action] } : o
      ));
      setNewActionTitles((prev) => ({ ...prev, [objectiveId]: "" }));
    }
  }

  async function deleteAction(objectiveId: string, actionId: string) {
    if (!initiativeId) return;
    await api(`/api/helping-initiative/${initiativeId}/actions`, "DELETE", { actionId });
    setObjectives((prev) => prev.map((o) =>
      o.id === objectiveId ? { ...o, actions: o.actions.filter((a) => a.id !== actionId) } : o
    ));
  }

  async function addMetric() {
    if (!initiativeId || !newMetricLabel.trim()) return;
    setAddingMetric(true);
    const res = await api(`/api/helping-initiative/${initiativeId}/metrics`, "POST", {
      label: newMetricLabel, targetNumber: Number(newMetricTarget) || 0, unit: newMetricUnit || null,
    });
    if (res?.ok) {
      setMetrics((prev) => [...prev, res.metric]);
      setNewMetricLabel("");
      setNewMetricTarget("");
      setNewMetricUnit("");
    }
    setAddingMetric(false);
  }

  async function updateMetricCurrent(metricId: string, currentNumber: number) {
    if (!initiativeId) return;
    await api(`/api/helping-initiative/${initiativeId}/metrics`, "PATCH", { metricId, currentNumber });
    setMetrics((prev) => prev.map((m) => m.id === metricId ? { ...m, currentNumber } : m));
  }

  async function deleteMetric(metricId: string) {
    if (!initiativeId) return;
    await api(`/api/helping-initiative/${initiativeId}/metrics`, "DELETE", { metricId });
    setMetrics((prev) => prev.filter((m) => m.id !== metricId));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!initiative) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-red-400">Initiative not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <button onClick={() => router.push("/self?tab=earn")} className="text-sm text-teal-400 hover:text-teal-300 mb-2 block">
              ← Initiatives
            </button>
            <h1 className="text-2xl font-bold text-white">{initiative.page.title}</h1>
            <p className="text-sm text-gray-500 mt-1">Helping Initiative Studio</p>
          </div>
          <a
            href={`/helping/${businessId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg border border-teal-700 text-teal-400 text-sm hover:bg-teal-900/30 transition-colors"
          >
            View Public Page ↗
          </a>
        </div>

        {/* ── 1. Focus Area ── */}
        <section className="p-5 rounded-2xl border border-gray-800 bg-gray-900/50 space-y-4">
          <h2 className="text-[17px] font-bold text-teal-300">Focus Area</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold font-mono text-gray-500 mb-1 uppercase tracking-[0.08em]">What is your cause?</label>
              <input
                value={cause}
                onChange={(e) => setCause(e.target.value)}
                placeholder="e.g. Rescuing stray animals in North Kolkata"
                className="w-full p-3 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-600 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold font-mono text-gray-500 mb-1 uppercase tracking-[0.08em]">Who does it help?</label>
              <input
                value={targetGroup}
                onChange={(e) => setTargetGroup(e.target.value)}
                placeholder="e.g. Stray animals, local community"
                className="w-full p-3 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-600 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold font-mono text-gray-500 mb-1 uppercase tracking-[0.08em]">Where?</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. North Kolkata, West Bengal"
                className="w-full p-3 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-600 outline-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            {saveMsg && <span className="text-xs text-teal-400">{saveMsg}</span>}
            <button
              onClick={saveDetails}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </section>

        {/* ── 2. Objectives ── */}
        <section className="p-5 rounded-2xl border border-gray-800 bg-gray-900/50 space-y-4">
          <h2 className="text-[17px] font-bold text-teal-300">Objectives</h2>

          {objectives.length === 0 && (
            <p className="text-sm text-gray-500">No objectives yet. Add one below.</p>
          )}

          <div className="space-y-3">
            {objectives.map((obj) => (
              <div key={obj.id} className="rounded-xl border border-gray-700 bg-gray-950 overflow-hidden">
                {/* Objective header */}
                <div className="flex items-center gap-2 p-3">
                  <button
                    onClick={() => setExpandedObjectives((prev) => {
                      const next = new Set(prev);
                      next.has(obj.id) ? next.delete(obj.id) : next.add(obj.id);
                      return next;
                    })}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {expandedObjectives.has(obj.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <input
                    defaultValue={obj.title}
                    onBlur={(e) => updateObjectiveTitle(obj.id, e.target.value)}
                    className="flex-1 bg-transparent text-sm font-medium text-white outline-none border-b border-transparent focus:border-teal-600 transition-colors"
                  />
                  <button
                    onClick={() => deleteObjective(obj.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Actions */}
                {expandedObjectives.has(obj.id) && (
                  <div className="px-4 pb-3 space-y-2 border-t border-gray-800">
                    {obj.actions.map((action) => (
                      <div key={action.id} className="flex items-center gap-2 pl-4 py-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
                        <span className="flex-1 text-sm text-gray-300">{action.title}</span>
                        <button
                          onClick={() => deleteAction(obj.id, action.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pl-4 pt-1">
                      <input
                        value={newActionTitles[obj.id] || ""}
                        onChange={(e) => setNewActionTitles((prev) => ({ ...prev, [obj.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") addAction(obj.id); }}
                        placeholder="Add action..."
                        className="flex-1 p-1.5 rounded bg-gray-900 border border-gray-700 text-xs text-white placeholder-gray-600 outline-none"
                      />
                      <button
                        onClick={() => addAction(obj.id)}
                        className="p-1.5 rounded bg-teal-800 hover:bg-teal-700 text-teal-200 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={newObjectiveTitle}
              onChange={(e) => setNewObjectiveTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addObjective(); }}
              placeholder="New objective title..."
              className="flex-1 p-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-600 outline-none"
            />
            <button
              onClick={addObjective}
              disabled={addingObjective || !newObjectiveTitle.trim()}
              className="px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* ── 3. Awareness ── */}
        <section className="p-5 rounded-2xl border border-gray-800 bg-gray-900/50 space-y-4">
          <h2 className="text-[17px] font-bold text-teal-300">Awareness</h2>
          <div>
            <label className="block text-[11px] font-semibold font-mono text-gray-500 mb-1 uppercase tracking-[0.08em]">What do you want people to know?</label>
            <textarea
              value={awarenessText}
              onChange={(e) => setAwarenessText(e.target.value)}
              placeholder="Educate your audience about the cause, share facts, stories, or context..."
              rows={5}
              className="w-full p-3 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-600 outline-none resize-none"
            />
            {/* Social tab integration placeholder */}
            {/* TODO: wire awarenessText → Social tab content feed once that system is built */}
          </div>
          <div className="flex justify-end">
            <button
              onClick={saveDetails}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </section>

        {/* ── 4. Impact Tracking ── */}
        <section className="p-5 rounded-2xl border border-gray-800 bg-gray-900/50 space-y-4">
          <h2 className="text-[17px] font-bold text-teal-300">Impact Tracking</h2>

          {metrics.length === 0 && (
            <p className="text-sm text-gray-500">No metrics yet. Add one below.</p>
          )}

          <div className="space-y-3">
            {metrics.map((m) => {
              const pct = m.targetNumber > 0 ? Math.min(100, (m.currentNumber / m.targetNumber) * 100) : 0;
              return (
                <div key={m.id} className="p-3 rounded-xl border border-gray-700 bg-gray-950 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">{m.label}</span>
                    <button onClick={() => deleteMetric(m.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {m.currentNumber} / {m.targetNumber}{m.unit ? ` ${m.unit}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Current:</label>
                    <input
                      type="number"
                      defaultValue={m.currentNumber}
                      onBlur={(e) => updateMetricCurrent(m.id, Number(e.target.value))}
                      className="w-24 p-1.5 rounded bg-gray-900 border border-gray-700 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input
              value={newMetricLabel}
              onChange={(e) => setNewMetricLabel(e.target.value)}
              placeholder="Label (e.g. Animals fed)"
              className="col-span-2 p-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-600 outline-none"
            />
            <input
              type="number"
              value={newMetricTarget}
              onChange={(e) => setNewMetricTarget(e.target.value)}
              placeholder="Target"
              className="p-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-600 outline-none"
            />
            <input
              value={newMetricUnit}
              onChange={(e) => setNewMetricUnit(e.target.value)}
              placeholder="Unit (e.g. animals, meals)"
              className="col-span-2 p-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-600 outline-none"
            />
            <button
              onClick={addMetric}
              disabled={addingMetric || !newMetricLabel.trim()}
              className="p-2.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </section>

        {/* ── 5. Donation ── */}
        <section className="p-5 rounded-2xl border border-gray-800 bg-gray-900/50 space-y-4">
          <h2 className="text-[17px] font-bold text-teal-300">Donation / Support</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setAcceptDonations((v) => !v)}
              className={`w-11 h-6 rounded-full transition-colors relative ${acceptDonations ? "bg-teal-600" : "bg-gray-700"}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${acceptDonations ? "translate-x-5" : ""}`} />
            </div>
            <span className="text-sm text-gray-300">Accept donations / support</span>
          </label>
          {acceptDonations && (
            <div>
              <label className="block text-[11px] font-semibold font-mono text-gray-500 mb-1 uppercase tracking-[0.08em]">Donation message</label>
              <textarea
                value={donationMessage}
                onChange={(e) => setDonationMessage(e.target.value)}
                placeholder="Describe how people can support this cause, payment details, or any link..."
                rows={4}
                className="w-full p-3 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-600 outline-none resize-none"
              />
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={saveDetails}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </section>

        {/* ── 6. Posts ── */}
        {initiative && (
          <section className="pb-8">
            <InitiativePostsBlock
              pageId={businessId}
              isCreator={true}
              accentColor="#0d9488"
              theme="dark"
            />
          </section>
        )}

      </div>
    </div>
  );
}
