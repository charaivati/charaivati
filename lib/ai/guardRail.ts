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

// ── Crisis detection (Listener / Saathi only) ────────────────────────────────
// A crisis is a SOFT OVERRIDE, never a BLOCK — a canned redirect is the worst
// possible response to "I want to hurt myself". /api/listen uses this to switch
// the session into crisis mode (skip extraction/proposals, force the CRISIS
// prompt, show the helpline banner). scanInput/scanOutput above are deliberately
// untouched so /api/chat behavior stays byte-identical.

export interface CrisisScanResult {
  crisis: boolean;
  matchedPattern?: string;
}

const CRISIS_PATTERNS: RegExp[] = [
  // English — self-harm intent / suicidal ideation / acute distress
  /suicid/i,
  /\bkill (myself|my self)\b/i,
  /\b(end|take|took) my (own )?life\b/i,
  /\bend it all\b/i,
  /\bwan(t|na)s? to die\b/i,
  /\bbetter off dead\b/i,
  /\b(hurt|harm|cut)(ing|t)? (myself|my self)\b/i,
  /self[- ]?harm/i,
  /\bno (reason|point) (to|in) (live|living|go(ing)? on)\b/i,
  /\bdon'?t want to (live|be alive|exist|wake up)\b/i,
  /\bcan'?t (go on|take (this|it) anymore|do this anymore)\b/i,
  /\btired of (living|life|being alive)\b/i,
  // Hinglish (Latin script) — common phrasings
  /\bmar+(na|ne) chaht/i,
  /\bmar ja(na|au|u)\b/i,
  /\b(jee|ji)+na nahi chaht/i,
  /\bzindagi (khatam|barbaad|bekaar)\b/i,
  /\bkhud ko (khatam|nuksaan|nuksan|hurt)/i,
  /\bkhudkushi/i,
  /\bapni jaan (le|de)/i,
  /\bjaan de(na|ne) chaht/i,
];

export function scanInputCrisis(message: string): CrisisScanResult {
  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(message)) {
      return { crisis: true, matchedPattern: pattern.toString() };
    }
  }
  return { crisis: false };
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
