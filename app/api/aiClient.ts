// app/api/aiClient.ts
// chatComplete:         (Ollama if LOCAL_AI_ENABLED) → NVIDIA NIM → OpenRouter → Groq → Vercel. Returns string.
// chatCompleteWithMeta: same chain, also returns source / coldStart / model metadata.
// callAI:               Ollama → NVIDIA NIM → OpenRouter → Groq → Vercel (prompt-string entry point).
//
// NVIDIA NIM: 40 rpm rate limit on current account (CHARAIVATI.FORWARD@GMAIL.COM).
// Do NOT use NIM for batch jobs, bulk AI processing, or any loop that fires
// multiple requests in quick succession. NIM is fallback for interactive
// single-user requests only when Ollama tunnel is down.

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface ChatMeta {
  source: 'local' | 'cloud';
  coldStart: boolean;
  model: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export type AIProvider = "ollama" | "nvidia" | "openrouter" | "groq" | "vercel";

const OLLAMA_MODEL     = process.env.OLLAMA_MODEL     ?? "llama3:8b";
const OLLAMA_BASE_URL  = process.env.OLLAMA_BASE_URL  ?? "http://127.0.0.1:11434";
const NIM_MODEL        = process.env.NVIDIA_NIM_MODEL ?? "meta/llama-3.1-8b-instruct";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
// Groq deprecated llama-3.1-8b-instant (decommission 2026-08-16); GPT OSS 20B is the replacement.
const GROQ_MODEL       = process.env.GROQ_MODEL       ?? "openai/gpt-oss-20b";
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
  cloudMessages,
  maxTokens = 300,
  temperature = 0.4,
  jsonMode = false,
}: {
  model: string;
  messages: ChatMessage[];
  cloudMessages?: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<ChatMeta & { content: string }> {
  return chatCompleteInternal({ model, messages, cloudMessages, maxTokens, temperature, jsonMode });
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
    if (provider === "nvidia")     return await withTimeout(callNim(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
    if (provider === "openrouter") return await withTimeout(callOpenRouter(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
    if (provider === "groq")       return await withTimeout(callGroq(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
    return await withTimeout(callVercel(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
  } catch (err) {
    if (provider === "ollama") {
      console.warn("[aiClient] Ollama failed, trying NVIDIA NIM:", err);
      try {
        return await withTimeout(callNim(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
      } catch (err2) {
        console.warn("[aiClient] NVIDIA NIM failed, trying OpenRouter:", err2);
        try {
          return await withTimeout(callOpenRouter(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
        } catch (err3) {
          console.warn("[aiClient] OpenRouter failed, trying Groq:", err3);
          try {
            return await withTimeout(callGroq(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
          } catch (err4) {
            console.warn("[aiClient] Groq failed, trying Vercel:", err4);
            return await withTimeout(callVercel(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
          }
        }
      }
    }
    if (provider === "nvidia") {
      console.warn("[aiClient] NVIDIA NIM failed, trying OpenRouter:", err);
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

// Two distinct budgets — do NOT collapse to one (FIX-OLLAMA-TIMEOUT-1):
//
// - CONNECT budget (short, ~8s default): time to first byte of the response.
//   If Ollama is unreachable or never starts responding, fail fast to cloud.
// - GENERATION budget (long, ~60s default): spans the full request including
//   the streamed body read. Cold-prefill on this hardware legitimately takes
//   40-55s — a hard cap at the connect budget would abort EVERY cold start to
//   cloud and local would never be used.
//
// Streaming (stream: true) lets us detect the first chunk (for coldStart
// timing) and still bound total time without losing partial output.
async function callOllamaResilient(params: {
  model: string;
  messages: ChatMessage[];
  ollamaBase: string;
  maxTokens: number;
  temperature: number;
}): Promise<{ content: string; state: 'ok' | 'cold_start' | 'unavailable'; doneReason?: string }> {
  // LOCAL-AI-FIX-1: measured cold-load time-to-first-byte on the 3050 is
  // 19-32s (model load happens before Ollama emits any response bytes, even
  // with stream:true) — the old 8s CONNECT_TIMEOUT aborted EVERY cold load
  // before Ollama could respond, producing the "client connection closed
  // before llama-server finished loading" 499s. 45s/90s gives headroom for
  // a cold load + generation. A genuinely-down Ollama (tunnel error) still
  // fails in well under a second, so this doesn't slow down the "Ollama is
  // off" case.
  const CONNECT_TIMEOUT = Number(process.env.OLLAMA_CONNECT_TIMEOUT) || 45_000;
  const GEN_TIMEOUT = Number(process.env.OLLAMA_GEN_TIMEOUT) || 90_000;
  const numCtx = Number(process.env.OLLAMA_NUM_CTX) || 8192;
  // Keep the chat model resident — repeated reloads (18-30s each) were the
  // other half of the cold-start spiral. '24h' survives normal idle gaps
  // between chats; Ollama still evicts under VRAM pressure from other models.
  const keepAlive = process.env.OLLAMA_KEEP_ALIVE ?? '24h';
  // Thinking models (e.g. gemma4:e2b) burn the num_predict budget on
  // message.thinking before emitting message.content. Give the local path
  // extra headroom regardless of the caller's (cloud-tuned) maxTokens —
  // see FIX-THINKING-MODEL-1.
  const numPredict = Math.max(Number(process.env.OLLAMA_NUM_PREDICT) || 512, params.maxTokens);

  const start = Date.now();
  const controller = new AbortController();
  // Connect-phase timer: aborts if fetch() doesn't resolve headers in time.
  let connectTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => controller.abort(), CONNECT_TIMEOUT);
  // Generation timer: bounds the ENTIRE request (connect + streamed body read).
  const genTimer = setTimeout(() => controller.abort(), GEN_TIMEOUT);

  let content = '';
  let thinking = '';
  let doneReason: string | undefined;
  let firstChunkAt: number | null = null;

  try {
    const res = await fetch(`${params.ollamaBase}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        stream: true,
        // Disable visible chain-of-thought for thinking models — the
        // Listener/chat want direct replies, not reasoning traces.
        think: false,
        keep_alive: keepAlive,
        options: {
          num_ctx: numCtx,
          num_predict: numPredict,
          temperature: params.temperature,
        },
      }),
      signal: controller.signal,
    });

    // Headers received — connection succeeded. The generation timer keeps
    // running for the streamed body read.
    if (connectTimer) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }

    if (!res.ok || !res.body) {
      clearTimeout(genTimer);
      return { content: '', state: 'unavailable' };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (firstChunkAt === null) firstChunkAt = Date.now();
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line) as {
            message?: { content?: string; thinking?: string };
            done?: boolean;
            done_reason?: string;
          };
          if (obj.message?.content) content += obj.message.content;
          if (obj.message?.thinking) thinking += obj.message.thinking;
          if (obj.done_reason) doneReason = obj.done_reason;
        } catch {
          // ignore malformed NDJSON line
        }
      }
    }
    clearTimeout(genTimer);
  } catch {
    // Abort (connect timeout or generation timeout) or network error.
    if (connectTimer) clearTimeout(connectTimer);
    clearTimeout(genTimer);
  }

  if (!content) {
    if (thinking) {
      // The model worked (it reasoned) but exhausted num_predict before
      // emitting any message.content — distinct from a genuinely
      // unreachable/non-responding Ollama. With think:false + a higher
      // OLLAMA_NUM_PREDICT this should no longer happen; log loudly if it
      // recurs so the regression isn't silently masked as "unavailable".
      console.warn(
        `[aiClient] Ollama produced only thinking tokens (${thinking.length} chars, done_reason=${doneReason ?? 'unknown'}) — no message.content; treating as unavailable`
      );
    }
    return { content: '', state: 'unavailable' };
  }

  // coldStart: the model took longer than the connect budget to produce its
  // first token — almost always a cold-load (prefill), not a slow network.
  const firstByteElapsed = (firstChunkAt ?? Date.now()) - start;
  return { content, state: firstByteElapsed > CONNECT_TIMEOUT ? 'cold_start' : 'ok', doneReason };
}

// ─── Shared chatComplete implementation ──────────────────────────────────────

async function chatCompleteInternal({
  model,
  messages,
  cloudMessages,
  maxTokens = 300,
  temperature = 0.4,
  jsonMode = false,
}: {
  model: string;
  messages: ChatMessage[];
  cloudMessages?: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<ChatMeta & { content: string }> {
  // Cloud providers may receive a privacy-tiered variant of the prompt; Ollama
  // (local, trusted) always uses the full `messages`.
  const cloud = cloudMessages ?? messages;

  // 0 — Ollama (local, opt-in via LOCAL_AI_ENABLED=true + OLLAMA_BASE_URL)
  if (process.env.LOCAL_AI_ENABLED === 'true' && process.env.OLLAMA_BASE_URL) {
    const ollamaModel = process.env.OLLAMA_MODEL ?? 'llama3:8b';
    const ollamaBase = process.env.OLLAMA_BASE_URL.replace(/\/$/, '');
    console.log(`[aiClient] Ollama attempt — model=${ollamaModel} url=${ollamaBase}`);
    const result = await callOllamaResilient({ model: ollamaModel, messages, ollamaBase, maxTokens, temperature });
    if (result.state !== 'unavailable') {
      console.log(`[aiClient] Ollama ${result.state} (${result.content.length} chars, done_reason=${result.doneReason ?? 'unknown'})`);
      return { content: result.content, source: 'local', coldStart: result.state === 'cold_start', model: ollamaModel };
    }
    console.warn('[aiClient] Ollama unavailable, falling through to cloud');
  }

  // 1 — NVIDIA NIM (40 rpm limit — interactive fallback only; skip if NVIDIA_KEY absent)
  const nimKey = process.env.NVIDIA_KEY?.trim() || undefined;
  if (nimKey) {
    try {
      const content = await callNimMessages(nimKey, NIM_MODEL, cloud, maxTokens, temperature, jsonMode);
      return { content, source: 'cloud', coldStart: false, model: NIM_MODEL };
    } catch (err) {
      console.warn('[chatComplete] NVIDIA NIM failed, trying OpenRouter:', err);
    }
  }

  // 2 — OpenRouter
  const orKey = process.env.OPENROUTER_API_KEY?.trim() || undefined;
  if (orKey) {
    try {
      const body: Record<string, unknown> = {
        model: OPENROUTER_MODEL,
        messages: cloud,
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

  // 3 — Groq
  const groqKey = process.env.Charaivati_groq?.trim() || undefined;
  if (groqKey) {
    try {
      const content = await callGroqMessages(groqKey, GROQ_MODEL, cloud, maxTokens, temperature);
      return { content, source: 'cloud', coldStart: false, model: GROQ_MODEL };
    } catch (err) {
      console.warn('[chatComplete] Groq failed, trying Vercel:', err);
    }
  }

  // 4 — Vercel AI Gateway
  const content = await callVercelMessages(VERCEL_MODEL, cloud, maxTokens, temperature);
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

// callNim: prompt-string entry point (used by callAI)
async function callNim(prompt: string, systemPrompt?: string, maxTokens = 800): Promise<string> {
  const key = process.env.NVIDIA_KEY?.trim();
  if (!key) throw new Error("NVIDIA_KEY not set");
  const messages: ChatMessage[] = [
    ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
    { role: "user", content: prompt },
  ];
  return callNimMessages(key, NIM_MODEL, messages, maxTokens);
}

// callNimMessages: messages entry point (used by chatCompleteInternal)
async function callNimMessages(
  key: string,
  model: string,
  messages: ChatMessage[],
  maxTokens = 800,
  temperature = 0.7,
  jsonMode = false
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`NVIDIA NIM ${res.status}: ${err}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("NVIDIA NIM returned empty content");
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

// ─── Companion context injection ─────────────────────────────────────────────

function getActiveHobbies(hobbies: unknown): string {
  if (!hobbies) return 'none recorded'
  try {
    const arr = Array.isArray(hobbies) ? hobbies : JSON.parse(hobbies as string)
    const active = arr.filter((h: any) => h?.frequency === 'active').map((h: any) => h?.name).filter(Boolean)
    return active.length ? active.join(', ') : 'none recorded'
  } catch {
    return 'none recorded'
  }
}

export function buildCompanionContext(profile: {
  arcStage: number
  energyState?: string | null
  primaryDrive?: string | null
  driveConfirmedByUser?: boolean
  dailyAvailableHours?: number | null
  peakWindow?: string | null
  hobbies?: unknown
  healthFlags?: string[]
} | null): string {
  if (!profile || profile.arcStage === 0) return ''

  return `\n\n--- USER COMPANION PROFILE ---
Energy state: ${profile.energyState ?? 'unknown'}
Drive type: ${profile.primaryDrive ?? 'not yet discovered'}${profile.driveConfirmedByUser ? ' (confirmed)' : ' (inferred)'}
Available time: ${profile.dailyAvailableHours ? profile.dailyAvailableHours + ' hours/day' : 'unknown'}, peak: ${profile.peakWindow ?? 'unknown'}
Active hobbies: ${getActiveHobbies(profile.hobbies)}
Arc stage: ${profile.arcStage}
Health flags: ${profile.healthFlags?.length ? profile.healthFlags.join(', ') : 'none noted'}
--- END PROFILE ---`
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
