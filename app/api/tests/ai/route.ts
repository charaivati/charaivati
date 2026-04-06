import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "Charaivati Landing Test",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: `You are a warm, thoughtful guide for Charaivati — a life-layers app for people who want to live with more intention.
The app has 6 layers: Self (identity, goals, health), Society (friendships, community), State (civic, local), Nation, Earth, Universe.
Users have 4 personality types: Seeker (wisdom/inner peace), Builder (ambition/action), Connector (relationships/service), Maker (wealth/enterprise).

When someone shares what they want from life, respond in 2–3 short sentences:
1. Reflect back what you heard with warmth (don't parrot their words exactly)
2. Suggest their likely personality type and starting layer on the app
3. End with a gentle, encouraging invitation to begin

Keep it personal, warm, and under 80 words. No bullet points. No asterisks. Plain prose.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenRouter error:", err);
      return NextResponse.json({ error: "AI service unavailable" }, { status: 502 });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ response: text });
  } catch (e) {
    console.error("AI route error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
