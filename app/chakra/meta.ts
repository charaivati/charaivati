// CHAKRA-UI-3: shared per-chakra config for the landing journey
// (app/chakra/landing) and the per-chakra detail pages (app/chakra/[key]).
// English strings here are FALLBACKS — real strings live in TabTranslation
// (category ui-chakra, seeded by prisma/seed-chakra-ui.js).

import type { ChakraKey } from "@/lib/chakra/keys";

// Final action surfaces. The journey card no longer links here directly —
// it goes to /chakra/[key] (the middle layer), whose primary CTA uses these.
// sacral = Self→Social TAB (not the Society layer); solar = Self→Learning TAB.
// ?tab= keys verified in self/page.tsx (personal|social|learn|earn|time).
export const DEEP_LINKS: Record<ChakraKey, string | null> = {
  root: "/earn",
  sacral: "/self?tab=social",
  solar: "/self?tab=learn",
  heart: "/app/initiatives",
  throat: "/society",
  third_eye: "/listen",
  crown: null, // PARKED — Sahasrara not built (see TECH_DEBT.md)
};

// Remarks are calm one-liners — dormant reads as "ready to awaken", never broken.
export const REMARK_EN: Record<ChakraKey, string> = {
  root: "Your foundation. Steady the ground beneath you.",
  sacral: "Your flow. Let creativity and connection move.",
  solar: "Your fire. Small wins build real momentum.",
  heart: "Your compassion. Serving others opens this.",
  throat: "Your voice. Speak and share what's true.",
  third_eye: "Your insight. Reflection sharpens the inner gaze.",
  crown: "Awareness beyond. Ready to awaken in time.",
};

export const SURFACE_EN: Record<ChakraKey, string> = {
  root: "Earning", sacral: "Social", solar: "Learning", heart: "Initiatives",
  throat: "Society", third_eye: "Listen", crown: "",
};

// Sub-signal labels (keys come from lib/chakra/score.ts `ChakraSignal.key`).
export const SIGNAL_EN: Record<string, string> = {
  health: "Health", funds: "Funds", action: "Action",
  friends: "Friends", posts: "Posts", chat: "Conversations",
  completion: "Follow-through", mastery: "Learning mastery",
  initiatives: "Serving others", voice: "Public voice", shared: "Shared initiatives",
  reflection: "Reflection", todos: "Tagged to-dos",
};

// One calm line per factor for the detail page — what feeds it, never blame.
export const SIGNAL_DESC_EN: Record<string, string> = {
  health: "Physical energy from your health profile — sleep, movement, vitals.",
  funds: "Financial ground from your funds profile.",
  action: "Earning initiatives and goals — steps you're taking for survival.",
  friends: "Friendships you've built here.",
  posts: "Moments and thoughts you've shared.",
  chat: "Conversations you're part of.",
  completion: "How many of your to-dos reach done.",
  mastery: "Average mastery across your courses.",
  initiatives: "Initiatives you run that serve others.",
  voice: "Posts you've shared publicly.",
  shared: "Initiatives you've opened to the world.",
  reflection: "Time spent reflecting in Listen.",
  todos: "To-dos tagged to this chakra — finishing them lights it.",
};

// Where to work on each factor — existing surfaces only. `null` = the factor
// is handled on the detail page itself (e.g. tagged todos are listed there).
// SURVIVAL-1: root's health/funds factors route to the survival planning page
// (/chakra/root/survival) — food requirement + survival funds + community.
// CHAKRA-ACTION-2: `friends` is sacral-exclusive (lib/chakra/score.ts), so it's
// safe to repoint at the sacral connection page (/chakra/sacral/connection) —
// hobbies + friends + circles. No other signal key touched.
export const SIGNAL_LINKS: Record<string, string | null> = {
  health: "/chakra/root/survival", // survival plan — food requirement (root-only signal)
  funds: "/chakra/root/survival",  // survival plan — survival funds (root-only signal)
  action: "/earn",
  friends: "/chakra/sacral/connection", // connection plan — hobbies + friends + circles (sacral-only signal)
  posts: "/self?tab=social",
  chat: "/self?tab=social",
  completion: "/self",       // personal tab — todos
  mastery: "/self?tab=learn",
  initiatives: "/app/initiatives",
  voice: "/society",
  shared: "/app/initiatives",
  reflection: "/listen",
  todos: null,
};
