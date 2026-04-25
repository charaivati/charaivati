import { NextRequest, NextResponse } from "next/server";
import { getUserFromReq } from "@/lib/auth";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";

const FUNDS_MODEL = process.env.FUNDS_AI_MODEL ?? "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `You are a financial independence advisor for an Indian user building their life around a personal drive.
Your suggestions must be grounded in the user's actual drive, goals, skills, and businesses — never generic.
Suggest income opportunities that connect directly to what they are already working on.
All amounts in INR. User location: Rajarhat, Kolkata, West Bengal.
Respond ONLY in JSON matching this exact structure:
{
  "suggestions": ["string"],
  "incomeOpportunities": [
    { "title": "string", "rationale": "string", "effort": "easy|medium|hard", "linkedSkill": "string|null", "linkedGoal": "string|null" }
  ],
  "savingsPlan": "string"
}
Provide 4–5 income opportunities. The rationale MUST explain WHY this fits their specific drive, goals, and skills.
Include one government scheme they are most likely to qualify for.
Keep savingsPlan to 3 sentences max.`;

function buildPrompt(body: Record<string, unknown>): string {
  const drive      = body.drive      ?? "building";
  const goals      = body.goals      ?? [];
  const skills     = body.skills     ?? [];
  const businesses = body.businesses ?? [];
  const income     = body.totalIncome     ?? 0;
  const expenses   = body.totalExpenses   ?? 0;
  const netWorth   = body.netWorth        ?? 0;
  const runway     = body.runwayMonths    ?? 0;

  return `
Drive: ${drive}
Goals: ${JSON.stringify(goals)}
Skills: ${JSON.stringify(skills)}
Businesses / projects: ${JSON.stringify(businesses)}
Current monthly income: ₹${income}
Current monthly expenses: ₹${expenses}
Net worth: ₹${netWorth}
Runway: ${runway} months

Give me:
1. 4–5 income opportunities specific to my profile (title, rationale explaining why it fits ME, effort level)
2. A 3-sentence savings plan
3. One government scheme I am most likely to qualify for (include in incomeOpportunities with effort level)
`.trim();
}

function makeFallback() {
  return NextResponse.json({
    _fallback: true,
    suggestions: [],
    incomeOpportunities: [],
    savingsPlan: "",
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromReq(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return makeFallback();

  try {
    const raw    = await chatComplete({
      model:    FUNDS_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: buildPrompt(body) },
      ],
      maxTokens: 700,
    });
    const parsed = safeJsonParse<{ suggestions: string[]; incomeOpportunities: unknown[]; savingsPlan: string }>(raw);

    if (!parsed?.incomeOpportunities || !Array.isArray(parsed.incomeOpportunities)) {
      return makeFallback();
    }

    return NextResponse.json({
      suggestions:         parsed.suggestions         ?? [],
      incomeOpportunities: parsed.incomeOpportunities ?? [],
      savingsPlan:         parsed.savingsPlan         ?? "",
    });
  } catch {
    return makeFallback();
  }
}
