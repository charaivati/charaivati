// app/api/aiClient.ts

type AIProvider = "ollama" | "openrouter" | "gemini";

const OLLAMA_MODEL     = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
const OLLAMA_BASE_URL  = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OPENROUTER_MODEL = "mistralai/mistral-small-3.1-24b-instruct"; // reliable JSON output
const GEMINI_MODEL     = "gemini-2.0-flash";
const TIMEOUT_MS       = 60_000; // local models can be slower

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Call an AI model with a prompt. Returns the raw text response.
 * Fallback chain: Ollama → OpenRouter → Gemini
 */
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
    if (provider === "ollama")      return await withTimeout(callOllama(prompt, systemPrompt), TIMEOUT_MS);
    if (provider === "openrouter")  return await withTimeout(callOpenRouter(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
    return await withTimeout(callGemini(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
  } catch (err) {
    if (provider === "ollama") {
      console.warn("[aiClient] Ollama failed, falling back to OpenRouter:", err);
      try {
        return await withTimeout(callOpenRouter(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
      } catch (err2) {
        console.warn("[aiClient] OpenRouter failed, falling back to Gemini:", err2);
        return await withTimeout(callGemini(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
      }
    }
    if (provider === "openrouter") {
      console.warn("[aiClient] OpenRouter failed, falling back to Gemini:", err);
      return await withTimeout(callGemini(prompt, systemPrompt, maxTokens), TIMEOUT_MS);
    }
    throw err;
  }
}

/**
 * Parse JSON from an AI response. Handles markdown code fences and
 * extracts the first {...} or [...] block if the model adds preamble.
 */
export function safeJsonParse<T = unknown>(text: string): T {
  // Strip markdown fences
  const stripped = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Try direct parse first
  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Extract first JSON object or array
    const objMatch = stripped.match(/\{[\s\S]*\}/);
    const arrMatch = stripped.match(/\[[\s\S]*\]/);

    // Pick whichever comes first in the string
    const objIdx = objMatch ? stripped.indexOf(objMatch[0]) : Infinity;
    const arrIdx = arrMatch ? stripped.indexOf(arrMatch[0]) : Infinity;

    const best = objIdx <= arrIdx ? objMatch?.[0] : arrMatch?.[0];
    if (best) return JSON.parse(best) as T;

    throw new Error(`AI returned unparseable content: ${stripped.slice(0, 200)}`);
  }
}

// ─── Providers ────────────────────────────────────────────────────────────────

async function callOllama(prompt: string, systemPrompt?: string): Promise<string> {
  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: prompt },
  ];

  const res = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      temperature: 0.7,
      stream: false,
    }),
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
  const apiKey = process.env.OPENROUTER_API_KEY;
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
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
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

async function callGemini(prompt: string, systemPrompt?: string, maxTokens = 800): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  // Gemini doesn't have a system role — prepend it to the user turn
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Gemini returned empty content");
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
