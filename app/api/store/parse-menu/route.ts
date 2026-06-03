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

  // ─── Step 1: vision extraction via Ollama llava ──────────────────────────────

  const ollamaBase = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  const base64Image = Buffer.from(await imageFile.arrayBuffer()).toString("base64");

  let rawJson: string;
  try {
    const ollamaRes = await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llava:7b",
        messages: [{ role: "user", content: EXTRACTOR_SYSTEM, images: [base64Image] }],
        stream: false,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!ollamaRes.ok) {
      const err = await ollamaRes.text().catch(() => ollamaRes.statusText);
      throw new Error(`Ollama ${ollamaRes.status}: ${err}`);
    }

    const ollamaData = await ollamaRes.json() as { message?: { content?: string } };
    rawJson = ollamaData?.message?.content ?? "";
    if (!rawJson.trim()) throw new Error("Ollama returned empty content");
  } catch (err) {
    console.error("[parse-menu] Step 1 (vision) failed:", err);
    return NextResponse.json({ error: "Menu extraction failed — ensure llava:7b is loaded in Ollama" }, { status: 502 });
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
