"use client"

import { useState } from "react"
import { Check } from "lucide-react"

type Props = {
  timelineId: string
  phaseId: string
  milestoneId: string
  title: string
  isCompleted: boolean
  onToggle: (milestoneId: string, isCompleted: boolean) => void
}

export function MilestoneCheckbox({
  timelineId,
  phaseId,
  milestoneId,
  title,
  isCompleted,
  onToggle,
}: Props) {
  const [busy, setBusy] = useState(false)

  async function handleToggle() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/timelines/${timelineId}/phases/${phaseId}/milestones/${milestoneId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isCompleted: !isCompleted }),
        }
      )
      if (res.ok) onToggle(milestoneId, !isCompleted)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={busy}
      className="flex items-center gap-2.5 w-full text-left group disabled:opacity-50"
    >
      <span
        className={`flex-shrink-0 w-4 h-4 rounded border transition-all duration-150 flex items-center justify-center ${
          isCompleted
            ? "bg-teal-500 border-teal-500"
            : "border-white/20 bg-transparent group-hover:border-teal-500/50"
        }`}
      >
        {isCompleted && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      </span>
      <span
        className={`text-xs transition-colors leading-snug ${
          isCompleted ? "text-gray-500 line-through" : "text-gray-300 group-hover:text-white"
        }`}
      >
        {title}
      </span>
    </button>
  )
}
