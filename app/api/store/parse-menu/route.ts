import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import getServerUser from "@/lib/serverAuth";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";
import { prisma } from "@/lib/prisma";
import { mergeMenuSections } from "@/lib/store/mergeMenuSections";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Prompts ─────────────────────────────────────────────────────────────────

// NIM uses system + user roles; image is passed as image_url (not base64)
const NIM_SYSTEM = `You are a precise JSON menu parser. Always respond with valid JSON only.`;

const NIM_USER_PROMPT = `Extract restaurant or store menu data from this image.
Return ONLY valid JSON with this exact schema:
{
  "isMenu": true,
  "confidence": 0.95,
  "storeName": "name of restaurant or null",
  "sections": [
    {
      "title": "section name",
      "items": [
        {
          "title": "item name",
          "description": "description or null",
          "price": 150,
          "searchQuery": "3-5 word image search phrase"
        }
      ]
    }
  ],
  "hours": "business hours or null",
  "phone": "phone number or null",
  "address": "address or null"
}

Rules:
- Set isMenu to false if the image is NOT a menu or price list (e.g. a selfie, landscape, receipt, ID card).
- Set confidence between 0.0 and 1.0 — how clearly this is a menu and how legible the items are.
- price must be a number (not a string). Use 0 if a price is not visible.
- description may be null if not present on the menu.
- searchQuery is a 3-5 word English phrase suitable for finding a photo of that dish.`;

// OpenRouter / Ollama fallback: include isMenu + confidence so the gate works on all paths
const EXTRACTOR_SYSTEM = `Extract restaurant menu data from this image.
Return only valid JSON, no other text.
Schema: {
  isMenu: boolean,
  confidence: number (0.0 to 1.0),
  storeName: string | null,
  sections: [{
    title: string,
    items: [{
      title: string,
      description: string | null,
      price: number,
      searchQuery: string
    }]
  }],
  phone: string | null,
  address: string | null,
  hours: string | null
}
Set isMenu to false and confidence below 0.4 if this is not a menu or price list.
The searchQuery field should be a 3-5 word English phrase suitable for an image search to find a photo of that dish.`;

const VALIDATOR_SYSTEM = `You are a JSON validator. Given extracted menu data,
check for: missing required fields, prices that seem wrong (negative, unreasonably high >10000), empty titles.
Return only valid JSON with same schema plus a confidence field (0-1) per item and a
flags array of strings describing any issues found.
Do not invent data. If a field is missing, set it null.
Return only JSON, no other text.`;

const VALIDATOR_MODEL = process.env.MENU_VALIDATOR_MODEL ?? "anthropic/claude-haiku-4-5";

// ─── Vision extractors ────────────────────────────────────────────────────────

async function uploadMenuImage(
  base64Image: string,
  mimeType: string
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      `data:${mimeType};base64,${base64Image}`,
      { folder: "menu-parse-temp", resource_type: "image" },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error("Cloudinary upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
  });
}

// PRIMARY: NIM meta/llama-3.2-11b-vision-instruct
// Image is passed as a public Cloudinary URL (not base64) — 2.5-5.4s, clean JSON.
// nemotron-3-nano-omni was tested and rejected: silent vision failure (returns text, not image data).
// One image per call — llama-3.2-11b-vision is a single-image model; multiple
// images in one content array are silently ignored beyond the first. Batching
// (one call per image, merged later) is what makes multi-photo menus work.
async function extractMenuViaNIM(imageUrl: string): Promise<string> {
  const apiKey = process.env.NVIDIA_KEY?.trim();
  if (!apiKey) throw new Error("NVIDIA_KEY not set");

  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta/llama-3.2-11b-vision-instruct",
      messages: [
        { role: "system", content: NIM_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: NIM_USER_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2048,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`NIM ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("NIM returned empty content");
  return content;
}

// FALLBACK A: OpenRouter (google/gemini-2.5-flash-lite or MENU_VISION_MODEL)
// LOCAL-AI-FIX-1: cloud vision keeps the local GPU dedicated to the text chat model.
async function extractMenuViaOpenRouter(base64Image: string, mimeType: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const visionModel = process.env.MENU_VISION_MODEL ?? "google/gemini-2.5-flash-lite";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://charaivati.com",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Charaivati",
    },
    body: JSON.stringify({
      model: visionModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTOR_SYSTEM },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
      max_tokens: 2048,
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

// FALLBACK B: local Ollama llava — only when no cloud keys are configured
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

// Run the provider cascade for ONE image and return its raw JSON string.
// NIM uploads to Cloudinary and cleans up its own temp asset.
async function extractOneImage(image: { base64: string; mimeType: string }): Promise<string> {
  if (process.env.NVIDIA_KEY?.trim()) {
    let publicId: string | null = null;
    try {
      const { url, publicId: pid } = await uploadMenuImage(image.base64, image.mimeType);
      publicId = pid;
      const out = await extractMenuViaNIM(url);
      return out;
    } catch (nimErr) {
      console.error("[parse-menu] NIM failed for one image, falling back:", nimErr);
      return process.env.OPENROUTER_API_KEY?.trim()
        ? extractMenuViaOpenRouter(image.base64, image.mimeType)
        : extractMenuViaOllama(image.base64);
    } finally {
      if (publicId) {
        cloudinary.uploader
          .destroy(publicId, { resource_type: "image" })
          .catch((e) => console.error("[parse-menu] Cloudinary cleanup failed:", e));
      }
    }
  }
  return process.env.OPENROUTER_API_KEY?.trim()
    ? extractMenuViaOpenRouter(image.base64, image.mimeType)
    : extractMenuViaOllama(image.base64);
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const imageFiles = (formData.getAll("image") as File[]).filter((f) => f && f.size > 0).slice(0, 6);
  const storeId    = formData.get("storeId") as string | null;

  if (!imageFiles.length || !storeId) {
    return NextResponse.json({ error: "image and storeId required" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
  if (!store || store.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ─── Step 1: per-image vision extraction (batched) ────────────────────────
  // Each image runs the provider cascade independently (the vision models are
  // single-image), then results are merged. Concurrency is capped so we never
  // fire all 6 at NIM at once (40 rpm limit — see CLAUDE.md).

  const images = await Promise.all(
    imageFiles.map(async (f) => ({
      base64: Buffer.from(await f.arrayBuffer()).toString("base64"),
      mimeType: f.type || "image/jpeg",
    }))
  );

  const CONCURRENCY = 3; // ponytail: 6 fits 40 rpm, but stagger to avoid bursts
  const rawResults: string[] = [];
  for (let i = 0; i < images.length; i += CONCURRENCY) {
    const settled = await Promise.allSettled(
      images.slice(i, i + CONCURRENCY).map((img) => extractOneImage(img))
    );
    for (const s of settled) {
      if (s.status === "fulfilled") rawResults.push(s.value);
      else console.error("[parse-menu] image extraction failed:", s.reason);
    }
  }

  if (!rawResults.length) {
    return NextResponse.json({ error: "Menu extraction failed — please try again" }, { status: 502 });
  }

  // ─── isMenu gate (per image) ──────────────────────────────────────────────
  // Keep only images that parse as menus; a stray non-menu photo is skipped, not
  // fatal. If NONE qualify, return the menu-gate 400.

  const menuParsed: any[] = [];
  for (const raw of rawResults) {
    let p: any;
    try { p = safeJsonParse(raw); } catch { continue; }
    if (p.isMenu === false || (typeof p.confidence === "number" && p.confidence < 0.4)) continue;
    if ((p.sections ?? []).length) menuParsed.push(p);
  }

  if (!menuParsed.length) {
    return NextResponse.json(
      { error: "This doesn't look like a menu. Please upload a photo of your menu or price list." },
      { status: 400 }
    );
  }

  const rawJson = JSON.stringify(mergeMenuSections(menuParsed));

  // ─── Step 2: validation via chatComplete (OpenRouter → Groq → Vercel) ────

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
