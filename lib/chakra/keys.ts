// CHAKRA-1: canonical snake_case chakra keys + Todo source vocabulary.
// Ordered root -> crown, matching the index order of app/chakra/chakras.ts
// (which uses camelCase "thirdEye" for display) so scores[i] zips to CHAKRAS[i].
// Values are validated here, not in the DB (matches freq/assumptionKey precedent).

export const CHAKRA_KEYS = [
  "root",
  "sacral",
  "solar",
  "heart",
  "throat",
  "third_eye",
  "crown",
] as const;

export type ChakraKey = (typeof CHAKRA_KEYS)[number];

export type ChakraScores = Record<ChakraKey, number>;

export const TODO_SOURCES = ["manual", "validation", "execution_plan", "initiative"] as const;
export type TodoSource = (typeof TODO_SOURCES)[number];

export const isChakraKey = (v: unknown): v is ChakraKey =>
  typeof v === "string" && (CHAKRA_KEYS as readonly string[]).includes(v);

export const isTodoSource = (v: unknown): v is TodoSource =>
  typeof v === "string" && (TODO_SOURCES as readonly string[]).includes(v);

// Drive -> default chakra for execution-plan todos. Coarse on purpose (refine later).
export const DRIVE_CHAKRA: Record<string, ChakraKey> = {
  building: "solar",
  doing: "solar",
  learning: "throat",
  helping: "heart",
};

// AiGoal.archetype -> chakra, mirroring DRIVE_CHAKRA (BUILD/EXECUTE≈solar,
// LEARN≈throat, CONNECT≈helping≈heart). AiGoal has no drive word — archetype is
// the goal-level signal. Default solar.
export const ARCHETYPE_CHAKRA: Record<string, ChakraKey> = {
  BUILD: "solar",
  EXECUTE: "solar",
  LEARN: "throat",
  CONNECT: "heart",
};
