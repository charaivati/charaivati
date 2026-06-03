export type ThreatLevel = 'BLOCK' | 'WARN' | 'PASS';

export interface ScanResult {
  level: ThreatLevel;
  reason?: string;
  matchedPattern?: string;
}

const BLOCK_PATTERNS: RegExp[] = [
  /ignore (previous|prior|all|your) (instructions?|rules?|prompt)/i,
  /forget (everything|all|your instructions|who you are)/i,
  /you are now (a )?(?!charaivati)/i,
  /act as (a |an )?(?!charaivati)/i,
  /pretend (you are|to be)/i,
  /repeat (your |the )?(system prompt|instructions|rules)/i,
  /print (your |the )?(system prompt|instructions|context|secrets?)/i,
  /what (is your|are your) (api key|secret|database|env|environment)/i,
  /show me (your |the )?(api key|secret|password|token|database url)/i,
  /list (all )?users/i,
  /show (me )?(all )?user (data|goals|emails|phone)/i,
  /database (url|credentials?|password)/i,
  /DATABASE_URL|JWT_SECRET|OPENROUTER|CLOUDINARY_SECRET/i,
  /\bsqlite\b|\bpostgres\b.*password|\bneon\b.*secret/i,
];

const WARN_PATTERNS: RegExp[] = [
  /what model are you/i,
  /which (ai|model|llm) (are you|do you use|powers you)/i,
  /who made you|who built you/i,
  /are you (gpt|claude|gemma|llama|ollama|openai)/i,
  /what (is your|are your) (instructions?|system prompt|rules)/i,
  /tell me about (other )?users/i,
  /what do you know about (everyone|all users)/i,
  /export|download (my |all )?(data|goals|history)/i,
];

export function scanInput(message: string): ScanResult {
  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(message)) {
      return { level: 'BLOCK', reason: 'Prompt injection or secret extraction attempt', matchedPattern: pattern.toString() };
    }
  }
  for (const pattern of WARN_PATTERNS) {
    if (pattern.test(message)) {
      return { level: 'WARN', reason: 'Suspicious information probe', matchedPattern: pattern.toString() };
    }
  }
  return { level: 'PASS' };
}

const OUTPUT_BLOCK_PATTERNS: RegExp[] = [
  /DATABASE_URL|JWT_SECRET|OPENROUTER_API_KEY|CLOUDINARY_SECRET/i,
  /postgresql:\/\/|postgres:\/\//i,
  /neon\.tech/i,
  /sk-[a-zA-Z0-9]{20,}/,
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
  /process\.env\./i,
];

export function scanOutput(response: string): ScanResult {
  for (const pattern of OUTPUT_BLOCK_PATTERNS) {
    if (pattern.test(response)) {
      return { level: 'BLOCK', reason: 'Potential secret leak in AI response', matchedPattern: pattern.toString() };
    }
  }
  return { level: 'PASS' };
}
