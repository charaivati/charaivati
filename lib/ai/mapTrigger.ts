// Mind-map panel trigger for the Listener (/listen). Mirrors the isCouncilWorthy
// pattern (lib/ai/councilTrigger.ts): checked client-side in ListenChat BEFORE
// sending — on match the map panel opens locally and the model is NOT called.

export const MAP_TRIGGERS: string[] = [
  "show me my map",
  "show my map",
  "open my map",
  "open the map",
  "what do you have so far",
  "what have you got so far",
  "show my progress",
  "show me my progress",
  "where are we so far",
  "what do you know about me so far",
];

export function isMapRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return MAP_TRIGGERS.some((trigger) => lower.includes(trigger));
}
