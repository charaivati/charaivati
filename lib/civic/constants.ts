// CIVIC-1 — shared civic-layer vocabulary and thresholds.
// String enums are validated here (API level), not in the DB.

export const UNIT_TYPES = [
  "ward",
  "panchayat",
  "assembly",
  "parliamentary",
  "state",
  "country",
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];
export const isUnitType = (v: unknown): v is UnitType =>
  typeof v === "string" && (UNIT_TYPES as readonly string[]).includes(v);

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  ward: "Ward",
  panchayat: "Panchayat",
  assembly: "Assembly Constituency",
  parliamentary: "Parliamentary Constituency",
  state: "State",
  country: "Country",
};

export const ISSUE_STATUSES = ["proposed", "active", "complete", "archived"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_SCOPES = ["ward", "assembly", "nation", "earth"] as const;
export type IssueScope = (typeof ISSUE_SCOPES)[number];

/** Supporters needed for proposed → active (validated demand, not noise). */
export const ACTIVATION_THRESHOLD = 10;

/** Supporter confirmations needed for complete (one person is gameable). */
export const COMPLETION_CONFIRMATIONS = 3;

/** Home unit is changeable rarely — brigading protection. */
export const HOME_UNIT_CHANGE_DAYS = 90;

/**
 * Address→unit suggestion score at or above which the client may place the
 * home unit automatically (requires a unique top match). Auto-placement never
 * starts the HOME_UNIT_CHANGE_DAYS lock — only a manual confirmation does —
 * so a wrong guess is always immediately correctable.
 */
export const AUTO_PLACE_SCORE = 5;

// ── Community-proposed units ───────────────────────────────────────────────────

export const UNIT_STATUSES = ["pending", "verified"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

/**
 * A community-proposed unit verifies automatically once this many users have
 * it as their home. The 90-day home lock makes farming this expensive.
 */
export const UNIT_VERIFY_RESIDENTS = 3;

/** Unit types a proposed ward/panchayat may be attached under. */
export const PROPOSAL_PARENT_TYPES = ["assembly", "parliamentary", "state"] as const;

/** Max proposals per user per 24h (anti-spam). */
export const UNIT_PROPOSALS_PER_DAY = 3;

// ── Area quality ratings ───────────────────────────────────────────────────────

/**
 * Fixed parameters every resident can rate 1–5 for their home area. Averages
 * are shown to everyone in the area and rolled up to assembly/state/nation.
 * Validated in the API, not the DB (freq/assumptionKey precedent).
 */
export const AREA_PARAMETERS = [
  { key: "water", label: "Water supply", icon: "💧" },
  { key: "electricity", label: "Electricity", icon: "⚡" },
  { key: "roads", label: "Roads", icon: "🛣️" },
  { key: "cleanliness", label: "Cleanliness & waste", icon: "🧹" },
  { key: "safety", label: "Safety", icon: "🛡️" },
  { key: "healthcare", label: "Healthcare access", icon: "🏥" },
  { key: "education", label: "Schools & education", icon: "🎓" },
  { key: "internet", label: "Internet & mobile network", icon: "📶" },
] as const;
export type AreaParameter = (typeof AREA_PARAMETERS)[number]["key"];
export const isAreaParameter = (v: unknown): v is AreaParameter =>
  typeof v === "string" && AREA_PARAMETERS.some((p) => p.key === v);

export const RATING_MIN = 1;
export const RATING_MAX = 5;

/** Issue scope derived from the unit it's raised in. */
export function scopeForUnitType(type: string): IssueScope {
  if (type === "assembly") return "assembly";
  if (type === "parliamentary" || type === "state" || type === "country") return "nation";
  return "ward"; // ward | panchayat
}
