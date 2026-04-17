"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { TimelineCard } from "./TimelineCard"
import { TimelineDetail } from "./TimelineDetail"
import { CreateTimelineModal, type TimelineCreated } from "./CreateTimelineModal"
import type { GoalEntry } from "@/types/self"
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

type TimelineWithPhases = TimelineSummary & {
  phases: PhaseData[]
}

type Props = {
  goals?: GoalEntry[]
  /** Pre-open create modal from a goal card */
  createFromGoalId?: string
  createFromGoalTitle?: string
  onCreateModalClosed?: () => void
}

export function TimelineList({
  goals = [],
  createFromGoalId,
  createFromGoalTitle,
  onCreateModalClosed,
}: Props) {
  const [timelines, setTimelines]   = useState<TimelineSummary[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeId, setActiveId]     = useState<string | null>(null)
  const [detail, setDetail]         = useState<TimelineWithPhases | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [modalOpen, setModalOpen]   = useState(false)

  // Open modal externally when prefilled from a goal card
  useEffect(() => {
    if (createFromGoalId) setModalOpen(true)
  }, [createFromGoalId])

  const fetchTimelines = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/timelines")
      if (res.ok) {
        const data = await res.json() as TimelineSummary[]
        setTimelines(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTimelines() }, [fetchTimelines])

  async function openDetail(id: string) {
    if (activeId === id) {
      setActiveId(null)
      setDetail(null)
      return
    }
    setActiveId(id)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/timelines/${id}`)
      if (res.ok) {
        const data = await res.json() as TimelineWithPhases
        setDetail(data)
      }
    } finally {
      setLoadingDetail(false)
    }
  }

  function handleCreated(created: TimelineCreated) {
    // Refresh list and open the new timeline
    fetchTimelines().then(() => openDetail(created.id))
  }

  function handleDeleted(id: string) {
    setTimelines((prev) => prev.filter((t) => t.id !== id))
    if (activeId === id) {
      setActiveId(null)
      setDetail(null)
    }
  }

  function handleModalClose() {
    setModalOpen(false)
    onCreateModalClosed?.()
  }

  return (
    <div className="space-y-3">
      {/* ── New timeline button ── */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            bg-teal-600/20 border border-teal-500/30 text-teal-300
            hover:bg-teal-600/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New timeline
        </button>
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex justify-center py-6">
          <span className="text-xs text-gray-600">Loading…</span>
        </div>
      ) : timelines.length === 0 ? (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-6 text-center">
          <p className="text-2xl mb-2">📅</p>
          <p className="text-sm font-medium text-white/60">No project timelines yet</p>
          <p className="text-xs text-gray-600 mt-1">
            Convert a goal into a structured project with phases and milestones.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-3 px-4 py-2 rounded-lg text-xs font-medium
              bg-teal-600/20 border border-teal-500/30 text-teal-300
              hover:bg-teal-600/30 transition-colors"
          >
            Create first timeline
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {timelines.map((t) => (
            <div key={t.id}>
              <TimelineCard
                timeline={t}
                active={activeId === t.id}
                onClick={() => openDetail(t.id)}
              />
              {activeId === t.id && (
                <div className="mt-2">
                  {loadingDetail ? (
                    <div className="rounded-xl border border-white/[0.05] px-4 py-6 text-center">
                      <span className="text-xs text-gray-600">Loading phases…</span>
                    </div>
                  ) : detail ? (
                    <TimelineDetail
                      timeline={detail}
                      onClose={() => { setActiveId(null); setDetail(null) }}
                      onDeleted={handleDeleted}
                    />
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Create modal ── */}
      <CreateTimelineModal
        open={modalOpen}
        onClose={handleModalClose}
        onCreated={handleCreated}
        prefilledGoalId={createFromGoalId}
        prefilledTitle={createFromGoalTitle}
        goals={goals}
      />
    </div>
  )
}
