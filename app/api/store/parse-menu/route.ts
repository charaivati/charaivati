import { NextRequest, NextResponse } from "next/server";
import getServerUser from "@/lib/serverAuth";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";
import { prisma } from "@/lib/prisma";

const EXTRACTOR_SYSTEM = `Extract restaurant menu data from this image.
Return only valid JSON, no other text.
Schema: {
  storeName: string,
  sections: [{
    title: string,
    items: [{
      title: string,
      description: string,
      price: number,
      searchQuery: string
    }]
  }],
  phone: string | null,
  address: string | null,
  hours: string | null
}
The searchQuery field should be a 3-5 word English phrase suitable for an image search to find a photo of that dish.`;

const VALIDATOR_SYSTEM = `You are a JSON validator. Given extracted menu data,
check for: missing required fields, prices that seem wrong (negative, unreasonably high >10000), empty titles.
Return only valid JSON with same schema plus a confidence field (0-1) per item and a
flags array of strings describing any issues found.
Do not invent data. If a field is missing, set it null.
Return only JSON, no other text.`;

const VALIDATOR_MODEL = process.env.MENU_VALIDATOR_MODEL ?? "anthropic/claude-haiku-4-5";

// LOCAL-AI-FIX-1: vision extraction runs on cloud (cheap Gemini Flash-class
// model via OpenRouter) — local Ollama on the 6GB 3050 is reserved for the
// text-only chat model. Falls back to local Ollama llava only if no
// OPENROUTER_API_KEY is configured.
const VISION_MODEL = process.env.MENU_VISION_MODEL ?? "google/gemini-2.5-flash-lite";

async function extractMenuViaOpenRouter(base64Image: string, mimeType: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://charaivati.com",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Charaivati",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTOR_SYSTEM },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
      max_tokens: 3000,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("OpenRouter returned empty content");
  return content;
}

async function extractMenuViaOllama(base64Image: string): Promise<string> {
  const ollamaBase = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  const ollamaRes = await fetch(`${ollamaBase}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.MENU_VISION_FALLBACK_MODEL ?? "llava:7b",
      messages: [{ role: "user", content: EXTRACTOR_SYSTEM, images: [base64Image] }],
      stream: false,
      keep_alive: "10m",
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!ollamaRes.ok) {
    const err = await ollamaRes.text().catch(() => ollamaRes.statusText);
    throw new Error(`Ollama ${ollamaRes.status}: ${err}`);
  }

  const ollamaData = (await ollamaRes.json()) as { message?: { content?: string } };
  const content = ollamaData?.message?.content ?? "";
  if (!content.trim()) throw new Error("Ollama returned empty content");
  return content;
}

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const imageFile = formData.get("image") as File | null;
  const storeId   = formData.get("storeId") as string | null;

  if (!imageFile || !storeId) {
    return NextResponse.json({ error: "image and storeId required" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
  if (!store || store.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ─── Step 1: vision extraction — cloud (OpenRouter) with local Ollama llava fallback ──

  const base64Image = Buffer.from(await imageFile.arrayBuffer()).toString("base64");
  const mimeType = imageFile.type || "image/jpeg";

  let rawJson: string;
  try {
    rawJson = process.env.OPENROUTER_API_KEY?.trim()
      ? await extractMenuViaOpenRouter(base64Image, mimeType)
      : await extractMenuViaOllama(base64Image);
  } catch (err) {
    console.error("[parse-menu] Step 1 (vision) failed:", err);
    return NextResponse.json({ error: "Menu extraction failed — please try again" }, { status: 502 });
  }

  // ─── Step 2: validation via chatComplete (OpenRouter → Groq → Vercel) ───────

  let validated: any;
  try {
    const validatorResponse = await chatComplete({
      model: VALIDATOR_MODEL,
      messages: [
        { role: "system", content: VALIDATOR_SYSTEM },
        { role: "user",   content: rawJson },
      ],
      maxTokens: 2000,
      temperature: 0.1,
    });

    if (!validatorResponse.trim()) throw new Error("Validator returned empty content");
    validated = safeJsonParse(validatorResponse);
  } catch (err) {
    console.error("[parse-menu] Step 2 (validation) failed:", err);
    try {
      validated = safeJsonParse(rawJson);
      validated.flags = ["Validator unavailable — using raw extraction"];
    } catch {
      return NextResponse.json({ error: "Failed to parse menu data from image" }, { status: 500 });
    }
  }

  const flags: string[] = validated.flags ?? [];
  const lowConfidenceItems: string[] = [];

  for (const section of validated.sections ?? []) {
    for (const item of section.items ?? []) {
      if (typeof item.confidence === "number" && item.confidence < 0.5) {
        lowConfidenceItems.push(item.title ?? "(unnamed)");
      }
      delete item.confidence;
    }
  }

  return NextResponse.json({
    parsed: {
      storeName: validated.storeName ?? null,
      sections:  validated.sections  ?? [],
      phone:     validated.phone     ?? null,
      address:   validated.address   ?? null,
      hours:     validated.hours     ?? null,
    },
    flags,
    lowConfidenceItems,
  });
}
