import { NextResponse } from "next/server";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { db } from "@/lib/db";
import { chatCompleteWithMeta } from "@/app/api/aiClient";
import { loadPlatformContext } from "@/lib/ai/contextLoader";
import { getTier, getTierUI } from "@/lib/ai/modelTiers";

const CHAT_MODEL = process.env.CHAT_AI_MODEL ?? "llama3:8b";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3:8b";
const CHAT_TIMEOUT_MS = 30_000;

function withChatTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`chatComplete timed out after ${CHAT_TIMEOUT_MS}ms`)), CHAT_TIMEOUT_MS)
    ),
  ]);
}

export async function POST(req: Request) {
  const requestStart = Date.now();
  const localAiEnabled = process.env.LOCAL_AI_ENABLED === "true";
  const activeModel = localAiEnabled ? OLLAMA_MODEL : CHAT_MODEL;
  console.log(`[chat] Request started — model=${activeModel} localAI=${localAiEnabled}`);

  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { message, context, conversationHistory } = body as {
    message: string;
    context?: { currentSection?: string };
    conversationHistory?: { role: string; content: string }[];
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const userId = payload.userId;

  const [user, profile, pages] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    }),
    db.profile.findUnique({
      where: { userId },
      select: { drives: true, goals: true, stepsToday: true, sleepHours: true },
    }),
    db.page.findMany({
      where: { ownerId: userId, status: "active" },
      select: { title: true, pageType: true },
      take: 5,
    }),
  ]);

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

  const initiativesStr =
    pages.length > 0
      ? pages.map((p) => `${p.title} (${p.pageType})`).join(", ")
      : "none";

  const currentSection = context?.currentSection ?? "Self";
  console.log(`[chat] userId=${userId} section=${currentSection} historyLen=${conversationHistory?.length ?? 0}`);

  const platformContext = loadPlatformContext();
  const systemPrompt = `${platformContext ? `--- PLATFORM CONTEXT ---\n${platformContext}\n--- END CONTEXT ---\n\n` : ""}You are Charaivati Guide. Help the user move forward in their life with clarity and purpose.
You know this about the user:

Drives: ${drives}
Active goals: ${goalsStr}
Energy score: ${energyScore}/100
Active initiatives: ${initiativesStr}
Current section: ${currentSection}

Charaivati has 6 layers: Self → Society → State → Nation → Earth → Universe.
Speak like a wise, grounded mentor. Keep replies concise (3-5 sentences max unless the user asks for detail).
Always connect advice back to the user's own drives and goals.
Never give generic motivational quotes. Be specific to what you know about them.`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...(Array.isArray(conversationHistory)
      ? conversationHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      : []),
    { role: "user", content: message },
  ];

  const localExpected = process.env.LOCAL_AI_ENABLED === "true" && !!process.env.OLLAMA_BASE_URL;

  try {
    console.log(`[chat] Calling chatCompleteWithMeta — model=${activeModel} timeout=${CHAT_TIMEOUT_MS}ms`);
    const { content: reply, source, coldStart, model: usedModel } = await withChatTimeout(
      chatCompleteWithMeta({ model: CHAT_MODEL, messages, maxTokens: 300, temperature: 0.7 })
    );
    console.log(`[chat] Reply in ${Date.now() - requestStart}ms (${reply.length} chars) source=${source} coldStart=${coldStart} model=${usedModel}`);

    const tier = getTier(usedModel);
    const tierUI = getTierUI(usedModel);

    const responsePayload: Record<string, unknown> = {
      reply,
      tier,
      tierUI,
      source,
      coldStart,
      localExpected,
    };
    if (process.env.NODE_ENV !== "production") {
      responsePayload.model = usedModel;
    }

    return NextResponse.json(responsePayload);
  } catch (err) {
    const elapsed = Date.now() - requestStart;
    console.error(`[chat] chatComplete failed after ${elapsed}ms`);
    if (err instanceof Error) {
      console.error(`[chat] Error name: ${err.name}`);
      console.error(`[chat] Error message: ${err.message}`);
      console.error(`[chat] Error stack:`, err.stack);
    } else {
      console.error("[chat] Non-Error thrown:", JSON.stringify(err, null, 2));
    }
    return NextResponse.json({
      reply: "I'm having trouble connecting right now. Please try again in a moment.",
      _fallback: true,
    });
  }
}
