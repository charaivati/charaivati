// app/api/aiClient.ts
// Two provider paths: OpenRouter (OPENROUTER_API_KEY) and Vercel AI Gateway (Charaivati_Health).
// Fallback chain for all functions: OpenRouter → Vercel.
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chatComplete({
  model,
  messages,
  maxTokens = 300,
  temperature = 0.4,
  jsonMode = false,
}: {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const orKey = process.env.OPENROUTER_API_KEY?.trim() || undefined;
  if (orKey) {
    try {
      const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      };
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${orKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? '',
          'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Charaivati',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenRouter ${res.status}: ${text}`);
      }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
      throw new Error('OpenRouter returned empty content');
    } catch (err) {
      console.warn('[chatComplete] OpenRouter failed, falling back to Vercel:', err);
    }
  }

  // Vercel AI Gateway fallback — uses same model string (both accept OpenAI-compatible names)
  return callVercelMessages(model, messages, maxTokens, temperature);
}

export type AIProvider = "ollama" | "openrouter" | "vercel";

const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    ?? "llama3.1:8b";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
const VERCEL_MODEL    = process.env.VERCEL_MODEL    ?? "openai/gpt-4o-mini";
const VERCEL_GATEWAY  = (process.env.VERCEL_AI_GATEWAY_URL ?? "https://ai-gateway.vercel.sh").replace(/\/$/, "");
const TIMEOUT_MS      = 60_000;

// ─── Public API ───────────────────────────────────────────────────────────────

export async function callAI({
  prompt,
  provider = "ollama",
  systemPrompt,
  maxTokens = 800,
}: {
  prompt: string;
  provider?: AIProvider;
  systemPrompt?: string;
  maxTokens?: number;
}): Promise<string> {
  try {
    if (provider === "ollama")     return await withTimeout(callOllama(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
    if (provider === "openrouter") return await withTimeout(callOpenRouter(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
    return await withTimeout(callVercel(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
  } catch (err) {
    if (provider === "ollama") {
      console.warn("[aiClient] Ollama failed, falling back to OpenRouter:", err);
      try {
        return await withTimeout(callOpenRouter(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
      } catch (err2) {
        console.warn("[aiClient] OpenRouter failed, falling back to Vercel:", err2);
        return await withTimeout(callVercel(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
      }
    }
    if (provider === "openrouter") {
      console.warn("[aiClient] OpenRouter failed, falling back to Vercel:", err);
      return await withTimeout(callVercel(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
    }
    throw err;
  }
}

export function safeJsonParse<T = unknown>(text: string): T {
  const stripped = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    return JSON.parse(stripped) as T;
  } catch {
    const objMatch = stripped.match(/\{[\s\S]*\}/);
    const arrMatch = stripped.match(/\[[\s\S]*\]/);
    const objIdx = objMatch ? stripped.indexOf(objMatch[0]) : Infinity;
    const arrIdx = arrMatch ? stripped.indexOf(arrMatch[0]) : Infinity;
    const best = objIdx <= arrIdx ? objMatch?.[0] : arrMatch?.[0];
    if (best) return JSON.parse(best) as T;
    throw new Error(`AI returned unparseable content: ${stripped.slice(0, 200)}`);
  }
}

// ─── Providers ────────────────────────────────────────────────────────────────

async function callOllama(prompt: string, systemPrompt?: string, maxTokens = 800): Promise<string> {
  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: prompt },
  ];
  const res = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, messages, temperature: 0.7, stream: false, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Ollama ${res.status}: ${err}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Ollama returned empty content");
  return content as string;
}

async function callOpenRouter(prompt: string, systemPrompt?: string, maxTokens = 800): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() || undefined;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: prompt },
  ];
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://charaivati.com",
    },
    body: JSON.stringify({ model: OPENROUTER_MODEL, messages, temperature: 0.7, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned empty content");
  return content as string;
}

// callVercel: prompt-string entry point (used by callAI)
async function callVercel(prompt: string, systemPrompt?: string, maxTokens = 800): Promise<string> {
  const messages: ChatMessage[] = [
    ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
    { role: "user", content: prompt },
  ];
  return callVercelMessages(VERCEL_MODEL, messages, maxTokens);
}

// callVercelMessages: messages entry point (used by chatComplete fallback)
async function callVercelMessages(
  model: string,
  messages: ChatMessage[],
  maxTokens = 800,
  temperature = 0.7
): Promise<string> {
  const token = process.env.Charaivati_Health?.trim();
  if (!token) throw new Error("Charaivati_Health (Vercel token) not set");
  const res = await fetch(`${VERCEL_GATEWAY}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Vercel Gateway ${res.status}: ${err}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Vercel Gateway returned empty content");
  return content as string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms`)), ms)
    ),
  ]);
}
