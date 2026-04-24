// app/api/ai/suggest-skills/route.ts
import { NextResponse } from "next/server";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";

const MODEL = process.env.SKILLS_AI_MODEL ?? "openai/gpt-4o-mini";

const VALID_LEVELS = new Set(["Beginner", "Intermediate", "Advanced"]);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const goal = String(body.goal ?? "").slice(0, 500).trim();
  if (!goal) return NextResponse.json({ needsSkills: false, skills: [] });

  const systemPrompt = `You are a career coach. Respond ONLY with valid JSON — no markdown, no explanation.`;

  const prompt = `Goal: "${goal}"

First decide: does achieving this goal require learnable skills (technical, professional, creative)?
Goals like "feed my dog" or "drink more water" do NOT need skills.
Goals like "learn Python", "start a YouTube channel", or "grow a business" DO need skills.

Return ONLY this JSON:
{"needsSkills":true,"skills":[{"name":"Skill Name","level":"Beginner","monetize":false}]}

OR if no skills needed:
{"needsSkills":false,"skills":[]}

Rules:
- If needsSkills is true, include 3 to 5 skills
- level must be exactly "Beginner", "Intermediate", or "Advanced"
- monetize is true only if the skill directly earns money
- Skill name must be 2-4 words, plain text only
- No apostrophes or special characters in skill names`;

  try {
    const raw    = await chatComplete({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: prompt },
      ],
      maxTokens: 300,
    });
    const parsed = safeJsonParse<{ needsSkills: boolean; skills: Array<{ name: string; level: string; monetize: boolean }> }>(raw);

    const needsSkills = Boolean(parsed?.needsSkills);
    const skills = needsSkills
      ? (parsed?.skills ?? []).slice(0, 5).map((s, i) => ({
          id:       `ai-${i}-${Date.now()}`,
          name:     String(s.name ?? "").slice(0, 100),
          level:    VALID_LEVELS.has(s.level) ? s.level : "Beginner",
          monetize: Boolean(s.monetize),
        }))
      : [];

    return NextResponse.json({ needsSkills, skills });
  } catch (err) {
    console.error("[suggest-skills] failed:", err);
    return NextResponse.json({ needsSkills: false, skills: [] }, { status: 500 });
  }
}
