// Knowledge-gap detection for the Listener admin-question queue (PERSONA-1).
// A question is queued for the admin only when BOTH:
//  (1) the user's message looks like it's asking the AI for outside knowledge/opinion, AND
//  (2) the reply itself hedges (admits uncertainty / can't help).
// Mirrors lib/ai/mapTrigger.ts's keyword-matching shape.

export const CAPABILITY_GAP_TRIGGERS: string[] = [
  "what do you think about",
  "what's your opinion on",
  "what is your opinion on",
  "do you know about",
  "what do you know about",
  "how do you feel about",
  "what's the best way to",
  "what should i do about",
  "advice on",
  "tell me about",
];

export function isCapabilityGapCandidate(message: string): boolean {
  const lower = message.toLowerCase();
  return CAPABILITY_GAP_TRIGGERS.some((t) => lower.includes(t));
}

const HEDGE_PATTERNS: RegExp[] = [
  /i('m| am) not (sure|certain)/i,
  /i don'?t (know|have)/i,
  /i can'?t (really )?(say|help|answer)/i,
  /that'?s (a bit )?outside (my|what i)/i,
  /i'?m not (the right|able to)/i,
  /hard for me to say/i,
  /not something i (know|can speak to)/i,
];

export function replyHedges(reply: string): boolean {
  return HEDGE_PATTERNS.some((re) => re.test(reply));
}
