import { NextResponse } from "next/server";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { db } from "@/lib/db";

export async function POST(req: Request) {
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

  // Derive a simple energy score (0–100) from available health signals
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

  const systemPrompt = `You are Charaivati — a personal guide helping the user live with purpose.
You know this about the user:

Drives: ${drives}
Active goals: ${goalsStr}
Energy score: ${energyScore}/100
Active initiatives: ${initiativesStr}
Current section: ${currentSection}

Charaivati has 6 layers: Self → Society → State → Nation → Earth → Universe.
The user is currently working on their own growth (Self layer).
Speak like a wise, grounded mentor. Keep replies concise (3-5 sentences max unless the user asks for detail).
Always connect advice back to the user's own drives and goals.
Never give generic motivational quotes. Be specific to what you know about them.`;

  const ollamaUrl = process.env.OLLAMA_URL ?? "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.2";

  try {
    const ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...(Array.isArray(conversationHistory) ? conversationHistory : []),
          { role: "user", content: message },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!ollamaRes.ok) {
      throw new Error(`Ollama responded with status ${ollamaRes.status}`);
    }

    const data = await ollamaRes.json();
    const reply = data.message?.content ?? "I couldn't generate a response.";

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({
      reply:
        "I'm having trouble connecting right now. Please make sure Ollama is running and try again in a moment.",
      _fallback: true,
    });
  }
}
