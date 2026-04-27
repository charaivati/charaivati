// app/api/ai/health-consult/route.ts
import { NextResponse } from "next/server";
import { chatComplete } from "@/app/api/aiClient";
import getServerUser from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const MODEL = process.env.HEALTH_AI_MODEL ?? "openai/gpt-4o-mini";

export async function POST(req: Request) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      query = "",
      bmi,
      sleepQuality,
      mood,
      stressLevel,
      medicalConditions = "",
      healthIssues = [] as string[],
      exercise,
      sessionsPerWeek,
    } = body;

    if (!query.trim()) {
      return NextResponse.json({ error: "query_required" }, { status: 400 });
    }

    const contextParts: string[] = [];
    if (bmi)              contextParts.push(`BMI: ${bmi}`);
    if (sleepQuality)     contextParts.push(`Sleep: ${sleepQuality}`);
    if (mood)             contextParts.push(`Mood: ${mood}`);
    if (stressLevel)      contextParts.push(`Stress: ${stressLevel}`);
    if (exercise)         contextParts.push(`Exercise: ${exercise}, ${sessionsPerWeek}×/week`);
    if (medicalConditions) contextParts.push(`Medical conditions: ${medicalConditions}`);
    if (healthIssues.length > 0) contextParts.push(`Current issues: ${healthIssues.join("; ")}`);

    const contextBlock = contextParts.length > 0
      ? `\nUser health context:\n${contextParts.map(p => `- ${p}`).join("\n")}`
      : "";

    const systemPrompt = `You are Charaivati Health, a compassionate and practical health companion.
Respond to the user's health query with empathy and clarity.
Keep your response concise (3-5 sentences).
Do not diagnose medical conditions.
Suggest practical lifestyle adjustments, self-care steps, and when to consult a doctor.
${contextBlock}`;

    const raw = await chatComplete({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: query.trim() },
      ],
      maxTokens: 300,
      temperature: 0.5,
    });

    return NextResponse.json({ ok: true, response: raw.trim() });
  } catch (err: any) {
    console.error("health-consult error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
