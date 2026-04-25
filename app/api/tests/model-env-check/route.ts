import { NextResponse } from "next/server";
import { callAI, chatComplete } from "../../aiClient";

export const dynamic = "force-dynamic";

export type TestResult = {
  label: string;
  provider: string;
  model: string;
  success: boolean;
  latencyMs: number;
  response?: string;
  error?: string;
};

export type EnvStatus = Record<string, string | boolean | null>;

async function runTest(
  label: string,
  provider: string,
  model: string,
  fn: () => Promise<string>
): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fn();
    const latencyMs = Date.now() - start;
    console.log(`[${provider}] ✅ Success in ${latencyMs}ms: ${response.slice(0, 120)}`);
    return { label, provider, model, success: true, latencyMs, response: response.slice(0, 300) };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[${provider}] ❌ Failed: ${error}`);
    return { label, provider, model, success: false, latencyMs, error };
  }
}

export async function GET() {
  const PROMPT = "Hello, are you alive? Reply in one short sentence only.";

  const env = process.env;

  const envStatus: EnvStatus = {
    OPENROUTER_API_KEY:    !!env.OPENROUTER_API_KEY,
    Charaivati_groq:       !!env.Charaivati_groq,
    Charaivati_Health:     !!env.Charaivati_Health,
    GROQ_MODEL:            env.GROQ_MODEL ?? "(default: llama-3.1-8b-instant)",
    VERCEL_MODEL:          env.VERCEL_MODEL ?? null,
    VERCEL_AI_GATEWAY_URL: env.VERCEL_AI_GATEWAY_URL ?? "(default: https://ai-gateway.vercel.sh)",
    NEXT_PUBLIC_SITE_URL:  env.NEXT_PUBLIC_SITE_URL ?? null,
    OLLAMA_MODEL:          env.OLLAMA_MODEL ?? "(default: llama3.1:8b)",
    OPENROUTER_MODEL:      env.OPENROUTER_MODEL ?? "(default: openai/gpt-4o-mini)",
    SKILLS_AI_MODEL:       env.SKILLS_AI_MODEL ?? null,
    ENVIRONMENT_AI_MODEL:  env.ENVIRONMENT_AI_MODEL ?? null,
    HEALTH_AI_MODEL:       env.HEALTH_AI_MODEL ?? null,
    TIMELINE_AI_MODEL:     env.TIMELINE_AI_MODEL ?? null,
    GOAL_AI_PLAN_MODEL:    env.GOAL_AI_PLAN_MODEL ?? null,
    GOAL_AI_REFINE_MODEL:  env.GOAL_AI_REFINE_MODEL ?? null,
    GOAL_AI_REFLECT_MODEL: env.GOAL_AI_REFLECT_MODEL ?? null,
    GOAL_AI_SUMMARY_MODEL: env.GOAL_AI_SUMMARY_MODEL ?? null,
    SCHEDULE_AI_MODEL:     env.SCHEDULE_AI_MODEL ?? null,
    WEEK_PLAN_AI_MODEL:    env.WEEK_PLAN_AI_MODEL ?? null,
    FUNDS_AI_MODEL:        env.FUNDS_AI_MODEL ?? null,
  };

  const orModel       = env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
  const groqModel     = env.GROQ_MODEL ?? "llama-3.1-8b-instant";
  const vercelModel   = env.VERCEL_MODEL ?? "openai/gpt-4o-mini";
  const skillsModel   = env.SKILLS_AI_MODEL ?? orModel;
  const envCueModel   = env.ENVIRONMENT_AI_MODEL ?? orModel;
  const goalPlanModel = env.GOAL_AI_PLAN_MODEL ?? orModel;

  const tests = await Promise.all([
    // ── callAI: one test per provider ───────────────────────────────────────
    runTest(
      "callAI / Ollama  [legacy: health route]",
      "Ollama",
      env.OLLAMA_MODEL ?? "llama3.1:8b",
      () => callAI({ prompt: PROMPT, provider: "ollama", maxTokens: 80 })
    ),
    runTest(
      "callAI / OpenRouter  [legacy: timeline route]",
      "OpenRouter",
      orModel,
      () => callAI({ prompt: PROMPT, provider: "openrouter", maxTokens: 80 })
    ),
    runTest(
      "callAI / Groq",
      "Groq",
      groqModel,
      () => callAI({ prompt: PROMPT, provider: "groq", maxTokens: 80 })
    ),
    runTest(
      "callAI / Vercel AI Gateway",
      "Vercel",
      vercelModel,
      () => callAI({ prompt: PROMPT, provider: "vercel", maxTokens: 80 })
    ),

    // ── chatComplete: newer routes (skills, env-cues, goal-ai) ──────────────
    runTest(
      "chatComplete / Skills route",
      "OpenRouter→Groq→Vercel",
      skillsModel,
      () => chatComplete({ model: skillsModel, messages: [{ role: "user", content: PROMPT }], maxTokens: 80 })
    ),
    runTest(
      "chatComplete / Environment cues route",
      "OpenRouter→Groq→Vercel",
      envCueModel,
      () => chatComplete({ model: envCueModel, messages: [{ role: "user", content: PROMPT }], maxTokens: 80 })
    ),
    runTest(
      "chatComplete / Goal AI plan route",
      "OpenRouter→Groq→Vercel",
      goalPlanModel,
      () => chatComplete({ model: goalPlanModel, messages: [{ role: "user", content: PROMPT }], maxTokens: 80 })
    ),
  ]);

  return NextResponse.json({ envStatus, tests });
}
