import { NextResponse } from "next/server";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { db } from "@/lib/db";
import { callAI } from "@/app/api/aiClient";
import { COUNCIL_PERSONAS, buildPersonaPrompt, type UserContext } from "@/lib/ai/councilPersonas";
import { warmContextOverrides, loadSection } from "@/lib/ai/contextLoader";

export async function POST(req: Request) {
  const requestStart = Date.now();

  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Pull any admin context overrides into the loader cache before assembling prompts.
  await warmContextOverrides();

  const body = await req.json();
  const { message, trigger = "auto" } = body as {
    message: string;
    trigger?: "auto" | "manual";
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const userId = payload.userId;

  const profile = await db.profile.findUnique({
    where: { userId },
    select: { drives: true, goals: true, stepsToday: true, sleepHours: true },
  });

  const stepsToday = profile?.stepsToday ?? 0;
  const sleepHours = profile?.sleepHours ?? 0;
  let energyScore = 50;
  if (stepsToday > 0 || sleepHours > 0) {
    const stepScore = Math.min((stepsToday / 10000) * 40, 40);
    const sleepScore = Math.min((sleepHours / 8) * 40, 40);
    energyScore = Math.round(stepScore + sleepScore + 20);
  }

  const drives = Array.isArray(profile?.drives)
    ? (profile.drives as string[]).join(", ")
    : "not set";

  const goalsArr = Array.isArray(profile?.goals) ? (profile.goals as any[]) : [];
  const goalsStr =
    goalsArr.length > 0
      ? goalsArr
          .slice(0, 3)
          .map((g: any) => g.statement || g.title || "")
          .filter(Boolean)
          .join("; ")
      : "none set";

  const userContext: UserContext = { drives, goalsStr, energyScore };
  const localEnabled = process.env.LOCAL_AI_ENABLED === "true";
  const firstDrive = drives.split(",")[0].trim().toLowerCase();

  console.log(`[council] Starting stream — trigger=${trigger} userId=${userId} localAI=${localEnabled}`);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      function send(obj: Record<string, unknown>) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          closed = true;
        }
      }

      function isAborted() {
        return closed || (req.signal?.aborted ?? false);
      }

      try {
        // ── Guardian ─────────────────────────────────
        send({
          type: "status",
          step: 2,
          message: localEnabled
            ? "🛡️ Guardian consulting local assistant..."
            : "🛡️ Guardian reaching out to cloud assistant...",
        });
        if (isAborted()) { send({ type: "aborted" }); controller.close(); return; }

        const { systemPrompt: gs, prompt: gp } = buildPersonaPrompt("guardian", userContext, message);
        const guardianText = await callAI({ prompt: gp, systemPrompt: gs, provider: "ollama", maxTokens: 200 });
        const gp_ = COUNCIL_PERSONAS.guardian;

        if (isAborted()) { send({ type: "aborted" }); controller.close(); return; }

        send({
          type: "position",
          persona: "guardian",
          data: { persona: "guardian", name: gp_.name, emoji: gp_.emoji, colorClass: gp_.colorClass, text: guardianText },
        });
        console.log(`[council] Guardian — ${Date.now() - requestStart}ms`);

        // ── Seeker ────────────────────────────────────
        send({ type: "status", step: 3, message: "🛡️ Guardian has spoken. 🌙 Seeker consulting cloud assistant..." });
        if (isAborted()) { send({ type: "aborted" }); controller.close(); return; }

        const { systemPrompt: ss, prompt: sp } = buildPersonaPrompt("seeker", userContext, message);
        const seekerText = await callAI({ prompt: sp, systemPrompt: ss, provider: "groq", maxTokens: 200 });
        const sp_ = COUNCIL_PERSONAS.seeker;

        if (isAborted()) { send({ type: "aborted" }); controller.close(); return; }

        send({
          type: "position",
          persona: "seeker",
          data: { persona: "seeker", name: sp_.name, emoji: sp_.emoji, colorClass: sp_.colorClass, text: seekerText },
        });
        console.log(`[council] Seeker — ${Date.now() - requestStart}ms`);

        // ── Builder ───────────────────────────────────
        send({
          type: "status",
          step: 4,
          message: localEnabled
            ? "🌙 Seeker has spoken. 🔨 Builder consulting local assistant..."
            : "🌙 Seeker has spoken. 🔨 Builder reaching out to cloud assistant...",
        });
        if (isAborted()) { send({ type: "aborted" }); controller.close(); return; }

        const { systemPrompt: bs, prompt: bp } = buildPersonaPrompt("builder", userContext, message);
        const builderText = await callAI({ prompt: bp, systemPrompt: bs, provider: "ollama", maxTokens: 200 });
        const bp_ = COUNCIL_PERSONAS.builder;

        if (isAborted()) { send({ type: "aborted" }); controller.close(); return; }

        send({
          type: "position",
          persona: "builder",
          data: { persona: "builder", name: bp_.name, emoji: bp_.emoji, colorClass: bp_.colorClass, text: builderText },
        });
        console.log(`[council] Builder — ${Date.now() - requestStart}ms`);

        // ── Verdict + Synthesis (parallel Groq calls) ─
        send({ type: "status", step: 5, message: "🔨 Builder has spoken. ⚖️ Council reaching their verdict..." });
        if (isAborted()) { send({ type: "aborted" }); controller.close(); return; }

        // Admin-editable (COUNCIL.txt) with hardcoded fallback. verdict = system
        // prompt; synthesis = the trailing instruction spliced into a dynamic frame.
        const verdictSystemPrompt =
          loadSection("COUNCIL.txt", "verdict") ||
          "You are the deciding voice of a life advice council. Three perspectives have been heard. Now give ONE clear, decisive recommendation in 2-3 sentences. Be direct. Start with an action verb. No hedging. Use the user's context: drive type, energy score, goals.";
        const synthInstruction =
          loadSection("COUNCIL.txt", "synthesis") ||
          "what is the single most important question they are really asking? One sentence. Poetic but grounded.";
        const verdictPrompt = `Guardian said: ${guardianText}\nSeeker said: ${seekerText}\nBuilder said: ${builderText}\nUser context: ${drives} type, energy ${Math.round(energyScore / 10)}/10, goals: ${goalsStr}\nQuestion: ${message}\nGive the Council's decisive verdict.`;
        const synthesisPrompt = `Given these three perspectives on "${message}":\n\nGuardian: ${guardianText}\n\nSeeker: ${seekerText}\n\nBuilder: ${builderText}\n\nAnd that this user is a ${firstDrive} type with energy ${Math.round(energyScore / 10)}/10, ${synthInstruction}`;

        const [verdict, synthesis] = await Promise.all([
          callAI({ prompt: verdictPrompt, systemPrompt: verdictSystemPrompt, provider: "groq", maxTokens: 150 }),
          callAI({ prompt: synthesisPrompt, provider: "groq", maxTokens: 120 }),
        ]);

        console.log(`[council] Complete — ${Date.now() - requestStart}ms total`);

        send({
          type: "verdict",
          verdict,
          synthesis,
          trigger,
          tier: "council",
          _fallback: !localEnabled,
        });

        controller.close();
      } catch (err) {
        console.error(`[council] Failed after ${Date.now() - requestStart}ms:`, err);
        if (isAborted()) {
          send({ type: "aborted" });
        } else {
          send({ type: "error", message: "Council unavailable. Please try again." });
        }
        if (!closed) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
