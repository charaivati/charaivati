"use client"

import { Calendar } from "lucide-react"
import { TimelineProgressBar } from "./TimelineProgressBar"
import type { PhaseData } from "./PhaseRow"

type TimelineSummary = {
  id: string
  title: string
  description: string | null
  domain: string
  templateId: string | null
  isLifelong: boolean
  startDate: string | null
  targetDate: string | null
  status: string
  phases: { status: string }[]
  _count: { phases: number }
}

type Props = {
  timeline: TimelineSummary
  active: boolean
  onClick: () => void
}

const STATUS_DOT: Record<string, string> = {
  active:    "bg-teal-400",
  paused:    "bg-yellow-400",
  completed: "bg-green-400",
  archived:  "bg-gray-500",
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
}

export function TimelineCard({ timeline, active, onClick }: Props) {
  const completed = timeline.phases.filter((p) => p.status === "completed").length
  const total = timeline._count.phases

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-all duration-150 ${
        active
          ? "border-teal-500/40 bg-teal-500/[0.07] shadow-[0_0_0_1px_rgba(45,212,191,0.15)]"
          : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${STATUS_DOT[timeline.status] ?? STATUS_DOT["active"]}`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-snug">{timeline.title}</p>

          {timeline.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{timeline.description}</p>
          )}

          <div className="flex items-center gap-2 mt-1.5">
            {timeline.targetDate && !timeline.isLifelong && (
              <span className="flex items-center gap-1 text-[10px] text-gray-600">
                <Calendar className="w-2.5 h-2.5" />
                {fmtDate(timeline.targetDate)}
              </span>
            )}
            {timeline.isLifelong && (
              <span className="text-[10px] text-teal-500">∞ Lifelong</span>
            )}
          </div>

          {total > 0 && (
            <div className="mt-2">
              <TimelineProgressBar total={total} completed={completed} />
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
