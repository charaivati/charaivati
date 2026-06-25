import { NextRequest, NextResponse } from "next/server";
import { getKiteToken } from "@/lib/kite";
import { chatComplete } from "@/app/api/aiClient";

// ponytail: reuses the project's chatComplete() provider chain instead of a new
// Anthropic SDK — ANTHROPIC_API_KEY isn't in the project. Set MARKET_AI_MODEL to
// route cloud fallbacks at a specific Claude model.
const MODEL = process.env.MARKET_AI_MODEL ?? "anthropic/claude-haiku-4-5";

const SYSTEM = `You are a concise equity analyst. Given ONE stock holding, reply with 3-4 short bullet points covering risk and opportunity in plain English.
Rules: no preamble, no markdown headers, no buy/sell recommendation, no disclaimers. Each bullet starts with "- ". Base it only on the numbers given.`;

export async function POST(req: NextRequest) {
  if (!getKiteToken(req)) {
    return NextResponse.json({ error: "Not connected." }, { status: 401 });
  }

  const { holding } = await req.json().catch(() => ({}));
  if (!holding?.tradingsymbol) {
    return NextResponse.json({ error: "Missing holding." }, { status: 400 });
  }

  try {
    const analysis = await chatComplete({
      model: MODEL,
      maxTokens: 300,
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Holding: ${JSON.stringify(holding)}` },
      ],
    });
    return NextResponse.json({ analysis });
  } catch {
    return NextResponse.json({ error: "Analysis unavailable right now." }, { status: 502 });
  }
}
