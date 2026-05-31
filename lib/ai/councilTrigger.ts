// Council deliberation is triggered when a message signals a decision, identity
// question, or life-direction moment. Extend COUNCIL_TRIGGERS as new patterns emerge.

export const COUNCIL_TRIGGERS: string[] = [
  'should i',
  'shall i',
  'is it worth',
  'help me decide',
  'what would you do',
  'quit',
  'leave',
  'change',
  'start',
  'give up',
  'invest',
  'risk',
  'move',
  'why am i',
  'what is my purpose',
  'what should i do',
];

export function isCouncilWorthy(message: string): boolean {
  const lower = message.toLowerCase();
  return COUNCIL_TRIGGERS.some((trigger) => lower.includes(trigger));
}
