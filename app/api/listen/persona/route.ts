// app/api/listen/persona/route.ts — accept/dismiss for the Listener's
// persona-proposal cards (PERSONA-1). Admin-gated server-side — never trust a
// client-set flag. Writes happen ONLY here, after explicit card confirmation.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateChat } from "@/lib/ai/chatPipeline";
import { isAdminUser, type DistilledPersona } from "@/lib/listener/adminBridge";

export async function POST(req: Request) {
  const payload = await authenticateChat(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAdminUser(payload.userId);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { action, proposal } = body as {
    action?: "accept" | "dismiss";
    proposal?: DistilledPersona & { questionId?: string };
  };

  if (action !== "accept" && action !== "dismiss") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (!proposal || !proposal.name || !proposal.displayName || !proposal.body) {
    return NextResponse.json({ error: "Invalid proposal" }, { status: 400 });
  }

  if (action === "dismiss") {
    return NextResponse.json({ ok: true, dismissed: true });
  }

  try {
    const saved = await (db as any).philosophyPersona.upsert({
      where: { name: proposal.name },
      create: {
        name: proposal.name,
        displayName: proposal.displayName,
        body: proposal.body,
        triggers: proposal.triggers ?? [],
        attribution: proposal.attribution ?? null,
        status: "draft",
        sourceType: "admin_taught",
      },
      update: {
        displayName: proposal.displayName,
        body: proposal.body,
        triggers: proposal.triggers ?? [],
        attribution: proposal.attribution ?? null,
      },
    });

    if (proposal.questionId) {
      await (db as any).adminQuestion.update({
        where: { id: proposal.questionId },
        data: { status: "answered", answer: proposal.body, answeredAt: new Date() },
      }).catch((err: unknown) => console.error("[listen/persona] failed to mark question answered:", err));
    }

    return NextResponse.json({ ok: true, persona: { name: saved.name, displayName: saved.displayName, status: saved.status } });
  } catch (err) {
    console.error("[listen/persona] upsert failed:", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
