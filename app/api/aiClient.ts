// app/api/aiClient.ts
// chatComplete:         (Ollama if LOCAL_AI_ENABLED) → OpenRouter → Groq → Vercel. Returns string.
// chatCompleteWithMeta: same chain, also returns source / coldStart / model metadata.
// callAI:               Ollama → OpenRouter → Groq → Vercel (prompt-string entry point).

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface ChatMeta {
  source: 'local' | 'cloud';
  coldStart: boolean;
  model: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export type AIProvider = "ollama" | "openrouter" | "groq" | "vercel";

const OLLAMA_MODEL     = process.env.OLLAMA_MODEL     ?? "llama3:8b";
const OLLAMA_BASE_URL  = process.env.OLLAMA_BASE_URL  ?? "http://127.0.0.1:11434";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
const GROQ_MODEL       = process.env.GROQ_MODEL       ?? "llama-3.1-8b-instant";
const VERCEL_MODEL     = process.env.VERCEL_MODEL     ?? "openai/gpt-4o-mini";
const VERCEL_GATEWAY   = (process.env.VERCEL_AI_GATEWAY_URL ?? "https://ai-gateway.vercel.sh").replace(/\/$/, "");
const TIMEOUT_MS       = 60_000;

// ─── Public API ───────────────────────────────────────────────────────────────

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
  const { content } = await chatCompleteInternal({ model, messages, maxTokens, temperature, jsonMode });
  return content;
}

export async function chatCompleteWithMeta({
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
}): Promise<ChatMeta & { content: string }> {
  return chatCompleteInternal({ model, messages, maxTokens, temperature, jsonMode });
}

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
    if (provider === "groq")       return await withTimeout(callGroq(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
    return await withTimeout(callVercel(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
  } catch (err) {
    if (provider === "ollama") {
      console.warn("[aiClient] Ollama failed, trying OpenRouter:", err);
      try {
        return await withTimeout(callOpenRouter(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
      } catch (err2) {
        console.warn("[aiClient] OpenRouter failed, trying Groq:", err2);
        try {
          return await withTimeout(callGroq(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
        } catch (err3) {
          console.warn("[aiClient] Groq failed, trying Vercel:", err3);
          return await withTimeout(callVercel(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
        }
      }
    }
    if (provider === "openrouter") {
      console.warn("[aiClient] OpenRouter failed, trying Groq:", err);
      try {
        return await withTimeout(callGroq(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
      } catch (err2) {
        console.warn("[aiClient] Groq failed, trying Vercel:", err2);
        return await withTimeout(callVercel(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
      }
    }
    if (provider === "groq") {
      console.warn("[aiClient] Groq failed, trying Vercel:", err);
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

// ─── Ollama resilient caller ─────────────────────────────────────────────────

async function callOllamaResilient(params: {
  model: string;
  messages: ChatMessage[];
  ollamaBase: string;
}): Promise<{ content: string; state: 'ok' | 'cold_start' | 'unavailable' }> {
  const ATTEMPT_TIMEOUT = 8_000;

  async function attempt(): Promise<{ content: string; status: 'ok' | 'network_error' | 'empty' }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT);
    try {
      const res = await fetch(`${params.ollamaBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: params.model, messages: params.messages, stream: false }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return { content: '', status: 'empty' };
      const data = await res.json().catch(() => null) as { message?: { content?: string } } | null;
      const content = data?.message?.content ?? '';
      if (!content) return { content: '', status: 'empty' };
      return { content, status: 'ok' };
    } catch {
      clearTimeout(timer);
      return { content: '', status: 'network_error' };
    }
  }

  const first = await attempt();
  if (first.status === 'ok') return { content: first.content, state: 'ok' };
  if (first.status === 'network_error') return { content: '', state: 'unavailable' };

  // Empty/malformed — wait and retry once (handles model cold-start loading)
  await new Promise<void>(r => setTimeout(r, ATTEMPT_TIMEOUT));
  const second = await attempt();
  if (second.status === 'ok') return { content: second.content, state: 'cold_start' };
  return { content: '', state: 'unavailable' };
}

// ─── Shared chatComplete implementation ──────────────────────────────────────

async function chatCompleteInternal({
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
}): Promise<ChatMeta & { content: string }> {
  // 0 — Ollama (local, opt-in via LOCAL_AI_ENABLED=true + OLLAMA_BASE_URL)
  if (process.env.LOCAL_AI_ENABLED === 'true' && process.env.OLLAMA_BASE_URL) {
    const ollamaModel = process.env.OLLAMA_MODEL ?? 'llama3:8b';
    const ollamaBase = process.env.OLLAMA_BASE_URL.replace(/\/$/, '');
    console.log(`[aiClient] Ollama attempt — model=${ollamaModel} url=${ollamaBase}`);
    const result = await callOllamaResilient({ model: ollamaModel, messages, ollamaBase });
    if (result.state !== 'unavailable') {
      console.log(`[aiClient] Ollama ${result.state} (${result.content.length} chars)`);
      return { content: result.content, source: 'local', coldStart: result.state === 'cold_start', model: ollamaModel };
    }
    console.warn('[aiClient] Ollama unavailable, falling through to cloud');
  }

  // 1 — OpenRouter
  const orKey = process.env.OPENROUTER_API_KEY?.trim() || undefined;
  if (orKey) {
    try {
      const body: Record<string, unknown> = {
        model: OPENROUTER_MODEL,
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
      if (content) return { content, source: 'cloud', coldStart: false, model: OPENROUTER_MODEL };
      throw new Error('OpenRouter returned empty content');
    } catch (err) {
      console.warn('[chatComplete] OpenRouter failed, trying Groq:', err);
    }
  }

  // 2 — Groq
  const groqKey = process.env.Charaivati_groq?.trim() || undefined;
  if (groqKey) {
    try {
      const content = await callGroqMessages(groqKey, GROQ_MODEL, messages, maxTokens, temperature);
      return { content, source: 'cloud', coldStart: false, model: GROQ_MODEL };
    } catch (err) {
      console.warn('[chatComplete] Groq failed, trying Vercel:', err);
    }
  }

  // 3 — Vercel AI Gateway
  const content = await callVercelMessages(VERCEL_MODEL, messages, maxTokens, temperature);
  return { content, source: 'cloud', coldStart: false, model: VERCEL_MODEL };
}

// ─── Providers (used by callAI) ───────────────────────────────────────────────

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

// callGroq: prompt-string entry point (used by callAI)
async function callGroq(prompt: string, systemPrompt?: string, maxTokens = 800): Promise<string> {
  const key = process.env.Charaivati_groq?.trim();
  if (!key) throw new Error("Charaivati_groq (Groq key) not set");
  const messages: ChatMessage[] = [
    ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
    { role: "user", content: prompt },
  ];
  return callGroqMessages(key, GROQ_MODEL, messages, maxTokens);
}

// callGroqMessages: messages entry point (used by chatCompleteInternal fallback)
async function callGroqMessages(
  key: string,
  model: string,
  messages: ChatMessage[],
  maxTokens = 800,
  temperature = 0.7
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Groq ${res.status}: ${err}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty content");
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

// callVercelMessages: messages entry point (used by chatCompleteInternal fallback)
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
