// To add a new model: insert an entry in MODEL_TIERS with the Ollama or OpenRouter
// model name as the key and one of the four tier levels as the value.
// Tiers: 'junior' (fast, simple tasks), 'assistant' (balanced), 'senior' (complex
// analysis), 'council' (reserved for multi-step deliberation flows).

export type Tier = 'junior' | 'assistant' | 'senior' | 'council';

export interface TierUI {
  label: string;
  responding: string;
  waiting: string;
  cloudFallback: string;
  disclaimer: string;
}

const MODEL_TIERS: Record<string, Tier> = {
  'gemma4:e2b':         'junior',
  'gemma4:e4b':         'assistant',
  'llama3:8b':          'junior',
  'gemma4:26b-a4b':     'senior',
  'openai/gpt-4o-mini': 'junior',
  'openai/gpt-4o':      'assistant',
};

export const TIER_UI: Record<Tier, TierUI> = {
  junior: {
    label:         'Junior Assistant',
    responding:    'Junior Assistant is responding',
    waiting:       'Junior Assistant is thinking...',
    cloudFallback: 'Junior Assistant responded via cloud',
    disclaimer:    'Quick response — ask for deeper analysis if needed',
  },
  assistant: {
    label:         'Assistant',
    responding:    'Assistant is responding',
    waiting:       'Assistant is preparing...',
    cloudFallback: 'Assistant responded via cloud',
    disclaimer:    '',
  },
  senior: {
    label:         'Senior Assistant',
    responding:    'Senior Assistant is analyzing',
    waiting:       'Senior Assistant is thinking...',
    cloudFallback: 'Senior Assistant responded via cloud',
    disclaimer:    '',
  },
  council: {
    label:         'Council',
    responding:    'Council is deliberating',
    waiting:       'Council is deliberating, this may take a moment',
    cloudFallback: '',
    disclaimer:    'This response went through multiple rounds of analysis',
  },
};

export function getTier(modelName: string): Tier {
  return MODEL_TIERS[modelName] ?? 'junior';
}

export function getTierUI(modelName: string): TierUI {
  return TIER_UI[getTier(modelName)];
}

// Returns true for Ollama-style model names (no 'provider/' prefix).
export function isLocalModel(modelName: string): boolean {
  return !modelName.includes('/');
}
