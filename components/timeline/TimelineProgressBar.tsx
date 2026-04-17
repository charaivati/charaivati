"use client"

type Props = {
  total: number
  completed: number
  className?: string
}

export function TimelineProgressBar({ total, completed, className = "" }: Props) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-gray-500">
          {completed}/{total} phases
        </span>
        <span className="text-[10px] font-semibold tabular-nums text-teal-400">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #2dd4bf, #0d9488)",
          }}
        />
      </div>
    </div>
  )
}
