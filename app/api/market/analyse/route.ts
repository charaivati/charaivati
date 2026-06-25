import { NextRequest, NextResponse } from "next/server";
import { getKiteToken, KiteAuthError, KITE_COOKIE } from "@/lib/kite";
import { buildContext, SymbolNotFound } from "@/lib/kiteContext";
import { chatComplete } from "@/app/api/aiClient";

// ponytail: reuses the project's chatComplete() provider chain — ANTHROPIC_API_KEY
// isn't in the project. Set MARKET_AI_MODEL to route cloud fallbacks at a model.
const MODEL = process.env.MARKET_AI_MODEL ?? "anthropic/claude-haiku-4-5";

const SYSTEM = `You are a disciplined equity analyst. You are given a DATA block of figures for ONE Indian (NSE) stock.

HARD RULES:
- Use ONLY numbers present in the DATA block. Never invent prices, ratios, targets, news, or fundamentals not given.
- Any P&L in the DATA block is UNREALIZED (the position is still open). Never call it "realized" or "booked".
- If a figure is null/missing, say so — do not guess it.
- No preamble, no markdown. Reply with a single JSON object, nothing else.

Reply with EXACTLY this JSON shape:
{
  "verdict": "accumulate" | "hold" | "trim" | "exit",
  "confidence": "low" | "medium" | "high",
  "reasons": [three short strings, each citing a SPECIFIC number copied from the DATA block],
  "risk_flag": one short string naming the main risk (or "none"),
  "used_figures": [the exact figures you cited, as they appear in DATA],
  "note": "Not financial advice."
}`;

function parseJson(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/); // strip stray prose/fences
    if (m) try { return JSON.parse(m[0]); } catch { /* fall through */ }
    return null;
  }
}

export async function POST(req: NextRequest) {
  const token = getKiteToken(req);
  if (!token) return NextResponse.json({ error: "Not connected." }, { status: 401 });

  const { symbol } = await req.json().catch(() => ({}));
  if (!symbol || typeof symbol !== "string") {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }

  let context;
  try {
    context = await buildContext(symbol, token);
  } catch (e) {
    if (e instanceof KiteAuthError) {
      const res = NextResponse.json({ error: "Session expired." }, { status: 401 });
      res.cookies.set(KITE_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }
    if (e instanceof SymbolNotFound) {
      return NextResponse.json({ error: (e as Error).message }, { status: 404 });
    }
    return NextResponse.json({ error: "Couldn't load stock data." }, { status: 502 });
  }

  try {
    const raw = await chatComplete({
      model: MODEL,
      maxTokens: 500,
      temperature: 0.2,
      jsonMode: true,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `DATA:\n${JSON.stringify(context, null, 2)}` },
      ],
    });
    const analysis = parseJson(raw);
    if (!analysis?.verdict) {
      return NextResponse.json({ error: "Analysis was malformed." }, { status: 502 });
    }
    analysis.note = "Not financial advice."; // enforce regardless of model output
    return NextResponse.json({ analysis, context });
  } catch {
    return NextResponse.json({ error: "Analysis unavailable right now." }, { status: 502 });
  }
}
