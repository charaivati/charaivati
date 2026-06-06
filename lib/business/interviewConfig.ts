// lib/business/interviewConfig.ts
// Static configuration for the adaptive BIZDOC-3 interview engine.
// All thresholds are tunable — adjust based on real conversation data.

// ─── Tunable Thresholds ───────────────────────────────────────────────────────
// Starting-point values. Calibrate after reviewing real interview transcripts.

/** Confidence below this triggers the cloud Assessor for that dimension. */
export const CONFIDENCE_THRESHOLD = 0.55;

/** Score difference |local - assessor| above this triggers one more probe. */
export const DISAGREEMENT_THRESHOLD = 1.0;

/** Max extra probes the engine will ask per dimension beyond base questions. */
export const MAX_PROBES_PER_DIM = 2;

/** Timeout for the local Interviewer model call in ms. */
export const LOCAL_TIMEOUT_MS = 12_000;

/** Timeout for the cloud Assessor call in ms. */
export const ASSESSOR_TIMEOUT_MS = 20_000;

// ─── Dimension Keys ──────────────────────────────────────────────────────────

export const DIMENSIONS = [
  "problemClarity",
  "marketNeed",
  "targetAudience",
  "uniqueValue",
  "feasibility",
  "monetization",
] as const;

export type DimKey = (typeof DIMENSIONS)[number];

// ─── Sector Detection ─────────────────────────────────────────────────────────

export type Sector =
  | "food"
  | "craft"
  | "education"
  | "delivery"
  | "service"
  | "retail"
  | "digital"
  | "health"
  | "general";

const SECTOR_PATTERNS: [RegExp, Sector][] = [
  [/\b(food|restaurant|chai|tiffin|bakery|catering|snack|lunch|dinner|cook|meal|biryani|cafe)\b/i, "food"],
  [/\b(tailor|stitch|handcraft|weave|knit|jewel|pottery|embroid)\b/i, "craft"],
  [/\b(tutor|coaching|teach|educat|school|course|learn|train|mentor)\b/i, "education"],
  [/\b(deliver|logistics|transport|courier|supply)\b/i, "delivery"],
  [/\b(repair|maintain|clean|plumb|electric|salon|spa|laundry|wash|service)\b/i, "service"],
  [/\b(shop|retail|store|kirana|mart|sell|resell)\b/i, "retail"],
  [/\b(app|software|digital|tech|website|platform|online|saas|api|mobile)\b/i, "digital"],
  [/\b(health|medic|clinic|pharma|doctor|hospital|ayurved|wellness|nursing)\b/i, "health"],
];

export function detectSector(title: string, description: string): Sector {
  const text = `${title} ${description}`;
  for (const [pattern, sector] of SECTOR_PATTERNS) {
    if (pattern.test(text)) return sector;
  }
  return "general";
}

// ─── Probe Templates ─────────────────────────────────────────────────────────
// Per-dimension follow-up probes, sector-tuned where appropriate.
// Array order = preferred probe sequence. Max MAX_PROBES_PER_DIM will be used.

export interface ProbeTemplate {
  probeId: string;        // stable ID for dedup
  dimensionKey: DimKey;
  sectors: Sector[];      // empty = applies to all sectors
  text: string;           // question text shown to user
}

export const PROBE_TEMPLATES: ProbeTemplate[] = [
  // ── problemClarity ──
  {
    probeId: "pc_who_pays",
    dimensionKey: "problemClarity",
    sectors: [],
    text: "Who is losing money or time because this problem isn't solved? Can you name a specific type of person?",
  },
  {
    probeId: "pc_how_often",
    dimensionKey: "problemClarity",
    sectors: [],
    text: "How often does this problem happen for your typical customer — daily, weekly, or rarely?",
  },

  // ── marketNeed ──
  {
    probeId: "mn_local_evidence",
    dimensionKey: "marketNeed",
    sectors: [],
    text: "Have you seen this problem in your own area — your street, your town? Can you describe one real example?",
  },
  {
    probeId: "mn_food_fssai",
    dimensionKey: "marketNeed",
    sectors: ["food"],
    text: "For a food business, health regulations (FSSAI) and spoilage are real constraints. How are you thinking about those?",
  },
  {
    probeId: "mn_service_repeat",
    dimensionKey: "marketNeed",
    sectors: ["service", "craft"],
    text: "Service businesses depend on repeat customers. Why would someone come back to you instead of switching?",
  },
  {
    probeId: "mn_digital_trust",
    dimensionKey: "marketNeed",
    sectors: ["digital"],
    text: "Digital products need trust. Why would a first-time user trust your product over an established one?",
  },

  // ── targetAudience ──
  {
    probeId: "ta_daily_life",
    dimensionKey: "targetAudience",
    sectors: [],
    text: "Describe your ideal customer's daily routine. When and where would they use or buy your product?",
  },
  {
    probeId: "ta_footfall",
    dimensionKey: "targetAudience",
    sectors: ["food", "retail"],
    text: "Footfall matters for food and retail. Where do your target customers go every day near your planned location?",
  },

  // ── uniqueValue ──
  {
    probeId: "uv_switch_reason",
    dimensionKey: "uniqueValue",
    sectors: [],
    text: "If your customer is already using something today, why would they switch? What's the single biggest reason?",
  },
  {
    probeId: "uv_copy",
    dimensionKey: "uniqueValue",
    sectors: [],
    text: "If your idea works, how long before a bigger player copies it? What stops them?",
  },

  // ── feasibility ──
  {
    probeId: "fs_first_month",
    dimensionKey: "feasibility",
    sectors: [],
    text: "What does your first month look like? Can you walk through the first 3 steps you'd take to get started?",
  },
  {
    probeId: "fs_capacity",
    dimensionKey: "feasibility",
    sectors: ["service", "craft", "food"],
    text: "How many customers or orders can you handle per day on your own? What happens when you hit that limit?",
  },
  {
    probeId: "fs_tech",
    dimensionKey: "feasibility",
    sectors: ["digital"],
    text: "What's the hardest technical part to build? Do you have that skill, or who would do it?",
  },

  // ── monetization ──
  {
    probeId: "mo_price",
    dimensionKey: "monetization",
    sectors: [],
    text: "What would you charge for this? How did you arrive at that number — what does competition charge?",
  },
  {
    probeId: "mo_first_rupee",
    dimensionKey: "monetization",
    sectors: [],
    text: "How would you get your first paying customer? What's the exact path from 'no customer' to 'first rupee'?",
  },
];

// Quick lookup: probes for a dimension + sector
export function getProbesForDim(dim: DimKey, sector: Sector): ProbeTemplate[] {
  return PROBE_TEMPLATES.filter(
    (p) => p.dimensionKey === dim && (p.sectors.length === 0 || p.sectors.includes(sector))
  );
}

// ─── Interview State Shape ────────────────────────────────────────────────────

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  dim?: DimKey;        // which dimension this turn targets
  questionKey: string; // base question ID or probe probeId
}

export interface QueuedProbe {
  probeId: string;
  dim: DimKey;
  text: string;
}

export interface AssessorResult {
  score: number;
  reason: string;
  oneThingToRaise: string;
}

export interface InterviewState {
  currentIndex: number;             // next base question index to ask
  sector: Sector;
  probeQueue: QueuedProbe[];        // pending probes (FIFO)
  probeCount: Record<string, number>; // how many probes asked per dim
  assessorRun: Record<string, boolean>; // whether assessor has run for each dim
  provisionalScores: Record<string, number>; // local estimates
  assessorScores: Record<string, AssessorResult>;
  done: boolean;
  localUnavailable: boolean;        // true when Ollama fell through to cloud
}

export function initInterviewState(sector: Sector): InterviewState {
  return {
    currentIndex: 0,
    sector,
    probeQueue: [],
    probeCount: {},
    assessorRun: {},
    provisionalScores: {},
    assessorScores: {},
    done: false,
    localUnavailable: false,
  };
}

// ─── Interviewer System Prompt ────────────────────────────────────────────────
// Keep short — runs on local model.

export function buildInterviewerPrompt(
  dim: DimKey,
  question: string,
  sectorNote: string
): string {
  return `You evaluate business idea answers for small business founders in India.
Dimension to assess: "${dim}"
Question asked: "${question}"
${sectorNote ? `Sector context: ${sectorNote}` : ""}

Evaluate the user's answer and respond with JSON only, no other text:
{
  "score": <integer from -2 to 2; -2=very weak, 0=neutral, 2=strong>,
  "confidence": <float 0.0–1.0; how clearly you can assess this dimension from this answer>,
  "followUpNeeded": <boolean; true if answer is too vague or too short>
}`;
}

// ─── Assessor System Prompt ───────────────────────────────────────────────────
// More detailed — runs on cloud model.

export function buildAssessorPrompt(philosophy: string): string {
  return `You are a senior business evaluator for the Charaivati platform in India.

${philosophy}

Evaluate the provided answers for one dimension of a business idea.
Be honest and specific. Respond with JSON only:
{
  "score": <integer from -2 to 2>,
  "reason": <one clear sentence explaining the score>,
  "oneThingToRaise": <one concrete, specific action that would raise this score>
}`;
}

// ─── Final Verdict Prompt ─────────────────────────────────────────────────────

export function buildVerdictPrompt(philosophy: string): string {
  return `You are a senior business evaluator for the Charaivati platform in India.

${philosophy}

Based on dimension scores and reasons, produce a final verdict for the founder.
Be honest, kind, and grounded. Respond with JSON only:
{
  "verdict": <one sentence overall verdict — be direct>,
  "rating": <integer 1–5>,
  "nextSteps": [<exactly 3 specific, actionable steps for this founder>]
}`;
}
