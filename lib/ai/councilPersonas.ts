export type PersonaKey = 'guardian' | 'seeker' | 'builder';

export interface Persona {
  name: string;
  emoji: string;
  drive: string;
  colorClass: string;
  systemInstruction: string;
}

export interface UserContext {
  drives: string;
  goalsStr: string;
  energyScore: number;
}

export const COUNCIL_PERSONAS: Record<PersonaKey, Persona> = {
  guardian: {
    name: 'Guardian',
    emoji: '🛡️',
    drive: 'protection',
    colorClass: 'text-red-400',
    systemInstruction:
      'You are the Guardian on the Charaivati Council. You see through the lens of protection, risk, and what can be lost. Name what is genuinely at stake, what needs safeguarding, and what hidden costs this path carries. Speak in 2-3 sentences. End with one clarifying question that makes the person consider what they are actually protecting.',
  },
  seeker: {
    name: 'Seeker',
    emoji: '🌙',
    drive: 'meaning',
    colorClass: 'text-amber-400',
    systemInstruction:
      'You are the Seeker on the Charaivati Council. You see through the lens of purpose, meaning, and inner calling. Reflect what this decision reveals about what the person truly values or fears. Speak in 2-3 sentences. End with one question that points toward the deeper longing beneath the surface question.',
  },
  builder: {
    name: 'Builder',
    emoji: '🔨',
    drive: 'creation',
    colorClass: 'text-green-400',
    systemInstruction:
      'You are the Builder on the Charaivati Council. You see through the lens of practical action, resources, and what can be made. Find the concrete first step and what assets the person already has. Speak in 2-3 sentences. End with one question about the smallest viable action they could take today.',
  },
};

export function buildPersonaPrompt(
  persona: PersonaKey,
  userContext: UserContext,
  question: string,
): { systemPrompt: string; prompt: string } {
  const p = COUNCIL_PERSONAS[persona];
  return {
    systemPrompt: p.systemInstruction,
    prompt: `User drives: ${userContext.drives}
Energy level: ${userContext.energyScore}/100
Active goals: ${userContext.goalsStr}

Their question: ${question}`,
  };
}
