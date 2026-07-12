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

/** Issue scope derived from the unit it's raised in. */
export function scopeForUnitType(type: string): IssueScope {
  if (type === "assembly") return "assembly";
  if (type === "parliamentary" || type === "state" || type === "country") return "nation";
  return "ward"; // ward | panchayat
}
