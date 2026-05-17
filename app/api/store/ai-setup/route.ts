import { NextRequest, NextResponse } from "next/server";
import getServerUser from "@/lib/serverAuth";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";

const MODEL = process.env.STORE_SETUP_AI_MODEL ?? process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

const UNSPLASH_ACCESS_KEY =
  process.env.UNSPLASH_ACCESS_KEY ??
  process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY ??
  "";

async function fetchUnsplashImage(query: string): Promise<string | null> {
  if (!UNSPLASH_ACCESS_KEY) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
    );
    const data = await res.json();
    return data?.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { description, storeId } = await req.json();
  if (!description?.trim())
    return NextResponse.json({ error: "description required" }, { status: 400 });

  const prompt = `You are helping set up an online store on Charaivati, an Indian marketplace.

The store owner describes their business as:
"${description.trim()}"

Generate a store structure. Respond ONLY with valid JSON, no markdown, no explanation.

Rules:
- Maximum 3 filters (including "All" which is always first)
- Maximum 3 sections total
- Maximum 3 tiles per section (each tile = a product category/variant)
- Maximum 2 sample products per section
- All prices in Indian Rupees (₹)
- Keep names short and clear
- Descriptions should be 1 sentence, practical, honest
- Use Indian context (cities, occasions, materials)
- unsplashQuery should be 2-3 words in English for image search

JSON format:
{
  "filters": ["All", "Filter 2", "Filter 3"],
  "sections": [
    {
      "title": "Section Name",
      "filter": "Filter 2",
      "layout": "1-1",
      "unsplashQuery": "search query for banner image",
      "tiles": [
        { "label": "Tile label" },
        { "label": "Tile label 2" }
      ],
      "products": [
        {
          "title": "Product Name",
          "description": "One sentence description.",
          "price": 499
        },
        {
          "title": "Product Name 2",
          "description": "One sentence description.",
          "price": 999
        }
      ]
    }
  ]
}

Layout options: "1" (1 tile), "1-1" (2 tiles), "1-1-1" (3 tiles)
Filters should match Indian buying contexts for this product type.`;

  try {
    const raw = await chatComplete({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 1200,
      temperature: 0.5,
    });

    let structure: any;
    try {
      structure = safeJsonParse(raw);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    const sectionsWithImages = await Promise.all(
      (structure.sections ?? []).map(async (section: any) => {
        const imageUrl = await fetchUnsplashImage(section.unsplashQuery ?? section.title);
        return { ...section, imageUrl };
      })
    );

    return NextResponse.json({
      ok: true,
      filters: structure.filters ?? ["All"],
      sections: sectionsWithImages,
    });
  } catch (err) {
    console.error("[ai-setup] error:", err);
    return NextResponse.json({ error: "AI setup failed" }, { status: 500 });
  }
}
