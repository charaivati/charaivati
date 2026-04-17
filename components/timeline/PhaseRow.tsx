"use client"

import { useRef, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { MilestoneCheckbox } from "./MilestoneCheckbox"

export type PhaseStatus = "pending" | "in_progress" | "completed" | "skipped"

export type MilestoneData = {
  id: string
  title: string
  isCompleted: boolean
}

export type PhaseData = {
  id: string
  title: string
  description: string | null
  phaseKey: string
  order: number
  status: PhaseStatus
  startDate: string | null
  targetDate: string | null
  completedAt: string | null
  notes: string | null
  milestones: MilestoneData[]
}

const STATUS_STYLES: Record<PhaseStatus, { pill: string; dot: string; label: string }> = {
  pending:     { pill: "bg-gray-700/50 text-gray-400 border-gray-600/40",  dot: "bg-gray-500",   label: "Pending"     },
  in_progress: { pill: "bg-teal-500/15 text-teal-300 border-teal-500/30",  dot: "bg-teal-400",   label: "In Progress" },
  completed:   { pill: "bg-green-500/15 text-green-300 border-green-500/30", dot: "bg-green-400", label: "Completed"   },
  skipped:     { pill: "bg-orange-500/10 text-orange-400 border-orange-500/25", dot: "bg-orange-400", label: "Skipped"  },
}

type Props = {
  timelineId: string
  phase: PhaseData
  isLast: boolean
  onPhaseUpdated: (updated: PhaseData) => void
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function PhaseRow({ timelineId, phase, isLast, onPhaseUpdated }: Props) {
  const [open, setOpen] = useState(false)
  const [localPhase, setLocalPhase] = useState<PhaseData>(phase)
  const [savingNotes, setSavingNotes] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const st = STATUS_STYLES[localPhase.status]
  const doneCount = localPhase.milestones.filter((m) => m.isCompleted).length
  const totalCount = localPhase.milestones.length

  async function patchPhase(data: Partial<PhaseData>) {
    const res = await fetch(`/api/timelines/${timelineId}/phases/${localPhase.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json() as PhaseData
      setLocalPhase(updated)
      onPhaseUpdated(updated)
    }
  }

  async function handleStatusChange(next: PhaseStatus) {
    if (savingStatus) return
    setSavingStatus(true)
    try {
      const completedAt = next === "completed" ? new Date().toISOString() : null
      await patchPhase({ status: next, completedAt })
    } finally {
      setSavingStatus(false)
    }
  }

  async function handleNotesBlur() {
    const notes = notesRef.current?.value ?? null
    if (notes === localPhase.notes) return
    setSavingNotes(true)
    try {
      await patchPhase({ notes: notes ?? "" })
    } finally {
      setSavingNotes(false)
    }
  }

  function handleMilestoneToggle(milestoneId: string, isCompleted: boolean) {
    setLocalPhase((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) =>
        m.id === milestoneId ? { ...m, isCompleted } : m
      ),
    }))
    onPhaseUpdated({
      ...localPhase,
      milestones: localPhase.milestones.map((m) =>
        m.id === milestoneId ? { ...m, isCompleted } : m
      ),
    })
  }

  return (
    <div className="flex gap-3">
      {/* ── Timeline spine ── */}
      <div className="flex flex-col items-center flex-shrink-0 pt-1">
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${st.dot}`}
        />
        {!isLast && <div className="w-px flex-1 bg-white/10 mt-1" />}
      </div>

      {/* ── Phase content ── */}
      <div className="flex-1 pb-4 min-w-0">
        {/* Header row */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-2 text-left group mb-1"
        >
          <span className="text-sm font-medium text-white/90 flex-1 leading-snug group-hover:text-white transition-colors">
            {localPhase.title}
          </span>

          <span
            className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${st.pill}`}
          >
            {st.label}
          </span>

          {open
            ? <ChevronUp className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />}
        </button>

        {/* Sub-header: date + milestone progress */}
        <div className="flex items-center gap-3 mb-1">
          {localPhase.targetDate && (
            <span className="text-[10px] text-gray-600">
              Target: {fmtDate(localPhase.targetDate)}
            </span>
          )}
          {totalCount > 0 && (
            <span className="text-[10px] text-gray-600">
              {doneCount}/{totalCount} milestones
            </span>
          )}
        </div>

        {/* Expanded body */}
        {open && (
          <div
            className="space-y-4 mt-3"
            style={{ animation: "sectionOpen 250ms ease both" }}
          >
            <style>{`
              @keyframes sectionOpen {
                from { opacity:0; transform:translateY(-4px); }
                to   { opacity:1; transform:translateY(0); }
              }
            `}</style>

            {localPhase.description && (
              <p className="text-xs text-gray-400 leading-relaxed">{localPhase.description}</p>
            )}

            {/* Milestones */}
            {localPhase.milestones.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Milestones
                </p>
                {localPhase.milestones.map((m) => (
                  <MilestoneCheckbox
                    key={m.id}
                    timelineId={timelineId}
                    phaseId={localPhase.id}
                    milestoneId={m.id}
                    title={m.title}
                    isCompleted={m.isCompleted}
                    onToggle={handleMilestoneToggle}
                  />
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Notes</p>
                {savingNotes && (
                  <span className="text-[10px] text-gray-600">Saving…</span>
                )}
              </div>
              <textarea
                ref={notesRef}
                defaultValue={localPhase.notes ?? ""}
                onBlur={handleNotesBlur}
                rows={3}
                placeholder="Add notes…"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs
                  text-gray-300 placeholder-gray-600 outline-none focus:border-teal-500/50
                  transition-colors resize-none"
              />
            </div>

            {/* Status actions */}
            <div className="flex gap-2 flex-wrap">
              {localPhase.status !== "in_progress" && localPhase.status !== "completed" && (
                <button
                  type="button"
                  disabled={savingStatus}
                  onClick={() => handleStatusChange("in_progress")}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium
                    bg-teal-500/15 border border-teal-500/30 text-teal-300
                    hover:bg-teal-500/25 transition-colors disabled:opacity-50"
                >
                  Mark in progress
                </button>
              )}
              {localPhase.status !== "completed" && (
                <button
                  type="button"
                  disabled={savingStatus}
                  onClick={() => handleStatusChange("completed")}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium
                    bg-green-500/15 border border-green-500/30 text-green-300
                    hover:bg-green-500/25 transition-colors disabled:opacity-50"
                >
                  Mark complete
                </button>
              )}
              {localPhase.status !== "pending" && (
                <button
                  type="button"
                  disabled={savingStatus}
                  onClick={() => handleStatusChange("pending")}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium
                    border border-white/10 text-gray-500
                    hover:border-white/20 hover:text-gray-400 transition-colors disabled:opacity-50"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
