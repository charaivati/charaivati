// lib/timeline-templates.ts — static classification template registry
// New domain templates register here — no schema change needed

export type TemplatePhase = {
  key: string
  title: string
  description: string
  defaultDurationDays?: number
  milestones: string[]
}

export type TimelineTemplate = {
  id: string
  domain: string
  name: string
  description: string
  icon: string
  supportsLifelong: boolean
  phases: TemplatePhase[]
}

export const TIMELINE_TEMPLATES: TimelineTemplate[] = [
  {
    id: "product-development",
    domain: "product",
    name: "Product Development",
    description: "Full lifecycle from idea to market release",
    icon: "🚀",
    supportsLifelong: false,
    phases: [
      {
        key: "idea",
        title: "Product Idea & Vision",
        description: "Define the core idea, problem statement, and vision",
        defaultDurationDays: 14,
        milestones: [
          "Problem statement written",
          "Target user defined",
          "Core value prop drafted",
        ],
      },
      {
        key: "feasibility",
        title: "Feasibility Study",
        description: "Technical feasibility and market validation",
        defaultDurationDays: 30,
        milestones: [
          "Technical feasibility assessed",
          "Market size estimated",
          "Competitor analysis done",
          "Go/no-go decision made",
        ],
      },
      {
        key: "prototype",
        title: "First Prototype",
        description: "Build and test the earliest working version",
        defaultDurationDays: 45,
        milestones: [
          "Wireframes complete",
          "Prototype built",
          "Internal test done",
          "Feedback collected",
        ],
      },
      {
        key: "alpha",
        title: "Alpha Version",
        description: "Feature-complete internal release for early testing",
        defaultDurationDays: 60,
        milestones: [
          "Core features implemented",
          "Internal alpha tested",
          "Critical bugs resolved",
        ],
      },
      {
        key: "beta",
        title: "Beta Version",
        description: "External limited release for real user feedback",
        defaultDurationDays: 60,
        milestones: [
          "Beta users onboarded",
          "Feedback loops set up",
          "Performance benchmarked",
        ],
      },
      {
        key: "gamma",
        title: "Gamma / RC",
        description: "Release candidate — final hardening",
        defaultDurationDays: 30,
        milestones: [
          "All P0/P1 bugs fixed",
          "Security review done",
          "Documentation complete",
        ],
      },
      {
        key: "release",
        title: "Release",
        description: "Public launch",
        defaultDurationDays: 14,
        milestones: [
          "Launch announcement",
          "Monitoring in place",
          "Support ready",
        ],
      },
    ],
  },
  {
    id: "supply-chain",
    domain: "product",
    name: "Supply Chain & Vendor",
    description: "Vendor sourcing, qualification, and supply chain setup",
    icon: "🏭",
    supportsLifelong: false,
    phases: [
      {
        key: "requirement",
        title: "Requirements Definition",
        description: "Define supply specifications and volumes",
        defaultDurationDays: 14,
        milestones: ["BOM created", "Volume forecast done", "Quality specs written"],
      },
      {
        key: "vendor-search",
        title: "Vendor Identification",
        description: "Identify and shortlist potential vendors",
        defaultDurationDays: 21,
        milestones: ["Vendor longlist created", "RFQ sent", "Quotes received"],
      },
      {
        key: "vendor-eval",
        title: "Vendor Evaluation",
        description: "Technical and commercial evaluation of vendors",
        defaultDurationDays: 30,
        milestones: [
          "Factory audits done",
          "Sample received",
          "Cost analysis done",
          "Vendor selected",
        ],
      },
      {
        key: "qualification",
        title: "Vendor Qualification",
        description: "Quality and compliance qualification",
        defaultDurationDays: 45,
        milestones: [
          "Quality agreement signed",
          "First article inspection passed",
          "Compliance verified",
        ],
      },
      {
        key: "pilot",
        title: "Pilot Run",
        description: "Small-scale production run to validate",
        defaultDurationDays: 30,
        milestones: [
          "Pilot order placed",
          "Pilot received and inspected",
          "Issues resolved",
        ],
      },
      {
        key: "scale",
        title: "Scale & Ongoing Management",
        description: "Full production and vendor relationship management",
        milestones: [
          "SLA in place",
          "Reorder process defined",
          "Review cadence set",
        ],
      },
    ],
  },
  {
    id: "lifelong-mastery",
    domain: "product",
    name: "Lifelong Project / Mastery",
    description: "An ongoing pursuit with no fixed end date",
    icon: "∞",
    supportsLifelong: true,
    phases: [
      {
        key: "foundation",
        title: "Foundation",
        description: "Build the base",
        defaultDurationDays: 90,
        milestones: ["Core skills acquired", "First output produced"],
      },
      {
        key: "growth",
        title: "Growth",
        description: "Deliberate practice and expansion",
        milestones: ["Milestone 1 reached", "Community joined"],
      },
      {
        key: "mastery",
        title: "Mastery",
        description: "Expert-level contribution",
        milestones: ["Teaching others", "Recognized outputs"],
      },
    ],
  },
]

// Future domains register here — no schema change needed
export const DOMAIN_LABELS: Record<string, string> = {
  product: "Product",
  service: "Service",
  health: "Health",
  relationship: "Relationship",
  custom: "Custom",
}

// Domains that have live templates
export const ACTIVE_DOMAINS = new Set(["product"])

export function getTemplate(id: string): TimelineTemplate | undefined {
  return TIMELINE_TEMPLATES.find((t) => t.id === id)
}

export function templatesByDomain(): Record<string, TimelineTemplate[]> {
  return TIMELINE_TEMPLATES.reduce<Record<string, TimelineTemplate[]>>(
    (acc, t) => {
      if (!acc[t.domain]) acc[t.domain] = []
      acc[t.domain].push(t)
      return acc
    },
    {}
  )
}
