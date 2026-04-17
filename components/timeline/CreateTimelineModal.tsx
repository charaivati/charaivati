"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { TemplatePicker } from "./TemplatePicker"
import { getTemplate } from "@/lib/timeline-templates"
import type { GoalEntry } from "@/types/self"

export type TimelineCreated = {
  id: string
  title: string
}

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (t: TimelineCreated) => void
  /** Pre-filled from a Goal card */
  prefilledGoalId?: string
  prefilledTitle?: string
  /** Current user's goals for the "link goal" dropdown */
  goals?: GoalEntry[]
}

export function CreateTimelineModal({
  open,
  onClose,
  onCreated,
  prefilledGoalId,
  prefilledTitle,
  goals = [],
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [goalId, setGoalId]       = useState<string>(prefilledGoalId ?? "")
  const [title, setTitle]         = useState<string>(prefilledTitle ?? "")
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [isLifelong, setIsLifelong] = useState(false)
  const [startDate, setStartDate]   = useState("")
  const [targetDate, setTargetDate] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const titleRef = useRef<HTMLInputElement>(null)

  // Reset when opened
  useEffect(() => {
    if (open) {
      setStep(1)
      setGoalId(prefilledGoalId ?? "")
      setTitle(prefilledTitle ?? "")
      setTemplateId(null)
      setIsLifelong(false)
      setStartDate("")
      setTargetDate("")
      setDescription("")
      setError(null)
    }
  }, [open, prefilledGoalId, prefilledTitle])

  useEffect(() => {
    if (open && step === 1) titleRef.current?.focus()
  }, [open, step])

  const template = templateId ? getTemplate(templateId) : undefined

  // Auto-set isLifelong when a lifelong-only template is selected
  useEffect(() => {
    if (template?.supportsLifelong && !isLifelong) {
      if (template.id === "lifelong-mastery") setIsLifelong(true)
    }
  }, [template])

  async function handleCreate() {
    if (!title.trim() || !templateId) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/timelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId:      goalId || undefined,
          title:       title.trim(),
          description: description.trim() || undefined,
          templateId,
          domain:      template?.domain ?? "product",
          isLifelong,
          startDate:   startDate || undefined,
          targetDate:  (!isLifelong && targetDate) ? targetDate : undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        setError(j.error ?? "Failed to create timeline")
        return
      }
      const created = await res.json() as { id: string; title: string }
      onCreated({ id: created.id, title: created.title })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // Phase schedule preview
  function buildSchedulePreview() {
    if (!template || !startDate) return null
    let cursor = new Date(startDate)
    return template.phases.map((p) => {
      const start = new Date(cursor)
      let end: Date | null = null
      if (p.defaultDurationDays) {
        end = new Date(cursor)
        end.setDate(end.getDate() + p.defaultDurationDays)
        cursor = new Date(end)
      }
      return { title: p.title, start, end }
    })
  }

  const schedulePreview = buildSchedulePreview()

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onKeyDown={(e) => { if (e.key === "Escape") onClose() }}
    >
      <div
        className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl
          flex flex-col max-h-[90vh]"
        style={{ animation: "tlModalIn 200ms ease both" }}
      >
        <style>{`
          @keyframes tlModalIn {
            from { opacity:0; transform:translateY(10px) scale(0.98); }
            to   { opacity:1; transform:translateY(0)    scale(1); }
          }
        `}</style>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06] flex-shrink-0">
          <div>
            <p className="text-sm font-semibold text-white">New Project Timeline</p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Step {step} of 3 — {step === 1 ? "Name" : step === 2 ? "Template" : "Configure"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex gap-1.5 px-5 pt-4 flex-shrink-0">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${
                s <= step ? "bg-teal-400" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

          {/* Step 1 — Link / name */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Project title *
                </label>
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Build mobile app v1"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5
                    text-sm text-white placeholder-gray-600 outline-none focus:border-teal-500/50
                    transition-colors"
                />
              </div>

              {goals.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Link to a goal (optional)
                  </label>
                  <select
                    value={goalId}
                    onChange={(e) => {
                      setGoalId(e.target.value)
                      // Auto-fill title from goal if title is blank
                      if (!title.trim()) {
                        const g = goals.find((g) => g.id === e.target.value)
                        if (g) setTitle(g.statement)
                      }
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5
                      text-sm text-white outline-none focus:border-teal-500/50 transition-colors
                      appearance-none"
                  >
                    <option value="">— No linked goal —</option>
                    {goals.filter((g) => g.statement.trim()).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.statement}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Template picker */}
          {step === 2 && (
            <TemplatePicker
              selected={templateId}
              onSelect={setTemplateId}
            />
          )}

          {/* Step 3 — Configure */}
          {step === 3 && template && (
            <div className="space-y-4">
              {template.supportsLifelong && (
                <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">Lifelong project</p>
                    <p className="text-xs text-gray-500">No fixed end date — ongoing pursuit</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLifelong((v) => !v)}
                    className={`w-10 h-5.5 rounded-full transition-colors relative flex-shrink-0 ${
                      isLifelong ? "bg-teal-500" : "bg-gray-700"
                    }`}
                    style={{ width: "40px", height: "22px" }}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                        isLifelong ? "left-5.5" : "left-0.5"
                      }`}
                      style={{ left: isLifelong ? "20px" : "2px" }}
                    />
                  </button>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Start date (optional)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5
                    text-sm text-white outline-none focus:border-teal-500/50 transition-colors
                    [color-scheme:dark]"
                />
              </div>

              {!isLifelong && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Target end date (optional)
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    min={startDate || undefined}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5
                      text-sm text-white outline-none focus:border-teal-500/50 transition-colors
                      [color-scheme:dark]"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description of this project…"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5
                    text-sm text-white placeholder-gray-600 outline-none focus:border-teal-500/50
                    transition-colors resize-none"
                />
              </div>

              {/* Phase schedule preview */}
              {schedulePreview && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Auto-calculated phase schedule
                  </p>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-1.5">
                    {schedulePreview.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                        <span className="text-gray-300 flex-1">{p.title}</span>
                        {p.end && (
                          <span className="text-gray-600 text-[10px] flex-shrink-0">
                            → {p.end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex gap-3 px-5 py-4 border-t border-white/[0.06] flex-shrink-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10
                text-sm text-gray-400 hover:bg-gray-800 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10
                text-sm text-gray-400 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              disabled={step === 1 ? !title.trim() : !templateId}
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl
                bg-teal-600 hover:bg-teal-500 text-sm text-white font-medium transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || !title.trim() || !templateId}
              onClick={handleCreate}
              className="flex-1 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500
                text-sm text-white font-medium transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Creating…" : "Create Timeline"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
