type AIProvider = "openrouter" | "gemini";

export async function callAI({
  prompt,
  provider = "openrouter",
}: {
  prompt: string;
  provider?: AIProvider;
}) {
  try {
    if (provider === "openrouter") {
      return await callOpenRouter(prompt);
    }
    if (provider === "gemini") {
      return await callGemini(prompt);
    }
  } catch (err) {
    // fallback automatically
    if (provider === "openrouter") {
      return await callGemini(prompt);
    }
    throw err;
  }
}

async function callOpenRouter(prompt: string) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content;
}

async function callGemini(prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}

export function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Invalid JSON from AI");
  }
}
