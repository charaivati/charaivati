"use client"

import { TIMELINE_TEMPLATES, DOMAIN_LABELS, ACTIVE_DOMAINS, type TimelineTemplate } from "@/lib/timeline-templates"

const COMING_SOON_DOMAINS = Object.keys(DOMAIN_LABELS).filter(
  (d) => !ACTIVE_DOMAINS.has(d) && d !== "custom"
)

type Props = {
  selected: string | null
  onSelect: (templateId: string) => void
}

export function TemplatePicker({ selected, onSelect }: Props) {
  const activeTemplates = TIMELINE_TEMPLATES.filter((t) => ACTIVE_DOMAINS.has(t.domain))

  return (
    <div className="space-y-5">
      {/* Active domain */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {DOMAIN_LABELS["product"]}
        </p>
        <div className="grid grid-cols-1 gap-2">
          {activeTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              selected={selected === t.id}
              onSelect={() => onSelect(t.id)}
            />
          ))}
        </div>
      </div>

      {/* Coming-soon domains */}
      {COMING_SOON_DOMAINS.map((domain) => (
        <div key={domain} className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
              {DOMAIN_LABELS[domain]}
            </p>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-gray-700 text-gray-600">
              Coming soon
            </span>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-gray-600 italic">
            Templates for {DOMAIN_LABELS[domain].toLowerCase()} projects are coming soon.
          </div>
        </div>
      ))}
    </div>
  )
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: TimelineTemplate
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-all duration-150 ${
        selected
          ? "border-teal-500/50 bg-teal-500/10 shadow-[0_0_0_1px_rgba(45,212,191,0.2)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 leading-none mt-0.5">{template.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-white">{template.name}</span>
            {template.supportsLifelong && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-teal-500/30 text-teal-400">
                Lifelong
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 leading-snug">{template.description}</p>
          <p className="text-[10px] text-gray-600 mt-1.5">
            {template.phases.length} phases
          </p>
        </div>
        {selected && (
          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center mt-0.5">
            <span className="text-white text-[8px] font-bold">✓</span>
          </span>
        )}
      </div>
    </button>
  )
}
