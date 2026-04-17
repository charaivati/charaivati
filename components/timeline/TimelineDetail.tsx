"use client"

import { useState } from "react"
import { X, Calendar, MoreHorizontal } from "lucide-react"
import { PhaseRow, type PhaseData } from "./PhaseRow"
import { TimelineProgressBar } from "./TimelineProgressBar"
import { DOMAIN_LABELS } from "@/lib/timeline-templates"

type TimelineDetailData = {
  id: string
  title: string
  description: string | null
  domain: string
  templateId: string | null
  isLifelong: boolean
  startDate: string | null
  targetDate: string | null
  status: string
  phases: PhaseData[]
}

type Props = {
  timeline: TimelineDetailData
  onClose: () => void
  onDeleted: (id: string) => void
}

const STATUS_PILL: Record<string, string> = {
  active:    "bg-teal-500/15 text-teal-300 border-teal-500/30",
  paused:    "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-green-500/15 text-green-300 border-green-500/30",
  archived:  "bg-gray-700/50 text-gray-400 border-gray-600/40",
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function TimelineDetail({ timeline, onClose, onDeleted }: Props) {
  const [phases, setPhases]       = useState<PhaseData[]>(timeline.phases)
  const [menuOpen, setMenuOpen]   = useState(false)
  const [deleting, setDeleting]   = useState(false)

  const completed = phases.filter((p) => p.status === "completed").length

  function handlePhaseUpdated(updated: PhaseData) {
    setPhases((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  async function handleDelete() {
    if (!confirm("Delete this timeline? This cannot be undone.")) return
    setDeleting(true)
    const res = await fetch(`/api/timelines/${timeline.id}`, { method: "DELETE" })
    if (res.ok) {
      onDeleted(timeline.id)
      onClose()
    }
    setDeleting(false)
  }

  return (
    <div
      className="rounded-2xl border border-white/[0.07] bg-gray-900 overflow-hidden"
      style={{ animation: "panelIn 280ms ease both" }}
    >
      <style>{`@keyframes panelIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* ── Header ── */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
              {DOMAIN_LABELS[timeline.domain] ?? timeline.domain}
            </span>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize
                ${STATUS_PILL[timeline.status] ?? STATUS_PILL["active"]}`}
            >
              {timeline.status}
            </span>
            {timeline.isLifelong && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-teal-500/30 text-teal-400">
                Lifelong
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-white">{timeline.title}</h3>
          {timeline.description && (
            <p className="text-xs text-gray-500 mt-1 leading-snug">{timeline.description}</p>
          )}
          {(timeline.startDate || timeline.targetDate) && (
            <div className="flex items-center gap-3 mt-2">
              <Calendar className="w-3 h-3 text-gray-600" />
              {timeline.startDate && (
                <span className="text-[10px] text-gray-600">Start: {fmtDate(timeline.startDate)}</span>
              )}
              {!timeline.isLifelong && timeline.targetDate && (
                <span className="text-[10px] text-gray-600">Target: {fmtDate(timeline.targetDate)}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* overflow menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 bg-gray-800 border border-white/10 rounded-xl shadow-xl
                min-w-[140px] py-1 text-sm">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => { setMenuOpen(false); handleDelete() }}
                  className="w-full text-left px-4 py-2 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  {deleting ? "Deleting…" : "Delete timeline"}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {phases.length > 0 && (
        <div className="px-5 py-3 border-b border-white/[0.04]">
          <TimelineProgressBar total={phases.length} completed={completed} />
        </div>
      )}

      {/* ── Phase accordion ── */}
      <div className="px-5 py-4">
        {phases.length === 0 ? (
          <p className="text-xs text-gray-600 py-2">No phases defined.</p>
        ) : (
          <div>
            {phases.map((phase, idx) => (
              <PhaseRow
                key={phase.id}
                timelineId={timeline.id}
                phase={phase}
                isLast={idx === phases.length - 1}
                onPhaseUpdated={handlePhaseUpdated}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
