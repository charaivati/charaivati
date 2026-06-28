// app/api/admin/context/rewrite/route.ts
// Admin-only: AI rewrites one context section per a plain-English instruction.
// Preview only — returns the proposed text; the admin reviews and saves via
// POST /api/admin/context. Gate mirrors the parent route.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { chatComplete } from "@/app/api/aiClient";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? process.env.ADMIN_ALERT_EMAIL;
const REWRITE_MODEL = process.env.CHAT_AI_MODEL ?? "llama3:8b";

export async function POST(req: Request) {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await db.user.findUnique({
    where: { id: payload.userId },
    select: { email: true },
  });
  if (!ADMIN_EMAIL || !admin?.email || admin.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { fileName?: string; sectionName?: string; instruction?: string; currentBody?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const instruction = String(body.instruction || "").trim();
  const currentBody = String(body.currentBody || "");
  const sectionName = String(body.sectionName || "section");
  const fileName = String(body.fileName || "file");
  if (!instruction) {
    return NextResponse.json({ error: "instruction required" }, { status: 400 });
  }

  const system =
    "You edit one section of an AI system-prompt context file. Apply the user's instruction to the section text below. Return ONLY the revised section text — no preamble, no commentary, no markdown code fences, and do NOT include any [SECTION] tags. Preserve the existing tone and formatting conventions unless the instruction says otherwise.";
  const user = `Section: ${sectionName} (in ${fileName})

--- CURRENT SECTION TEXT ---
${currentBody}
--- END ---

Instruction: ${instruction}`;

  try {
    const rewritten = await chatComplete({
      model: REWRITE_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 1200,
      temperature: 0.4,
    });
    return NextResponse.json({ rewritten: rewritten.trim() });
  } catch (err) {
    console.error("[admin-context/rewrite] failed:", (err as Error).message);
    return NextResponse.json({ error: "Rewrite failed — try again." }, { status: 502 });
  }
}
