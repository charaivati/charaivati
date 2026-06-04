import { NextRequest, NextResponse } from "next/server";
import getServerUser from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ollamaBase = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
  const model = process.env.MENU_VISION_MODEL ?? "llava:7b";

  // Fire-and-forget: trigger the model to load into GPU memory; don't wait for completion.
  // 10s timeout is enough to initiate the load; the actual warmup runs async.
  fetch(`${ollamaBase}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: "ok", stream: false, keep_alive: "10m" }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => { /* warmup failure is silent — never breaks the upload flow */ });

  return NextResponse.json({ warming: true });
}
