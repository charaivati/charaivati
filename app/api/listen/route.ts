// app/api/listen/route.ts — Listener (Saathi) conversation backend (CONSULT-1b).
//
// A PARALLEL system to /api/chat: shares lib/ai/chatPipeline (auth + guardrails +
// timeout + guarded completion) and the ProfileProposal mechanism, but has its own
// persona (ai-context/CONSULT_LISTENER.txt), its own persistence (ConsultSession /
// ConsultMessage), and no platform/initiative/mentor context blocks.
//
// HARD RULE: no UserCompanionProfile writes from this file or anything it owns —
// UCP fields gate the companion arc state machine (CONSULT-0c §4). Reads are fine.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";
import { loadSection } from "@/lib/ai/contextLoader";
import { authenticateChat, runInputGuard, runGuardedCompletion } from "@/lib/ai/chatPipeline";
import { tryProposeGoal } from "@/lib/companion/profileSync";
import {
  type ConsultInsights,
  type DriveValue,
  emptyInsights,
  normalizeInsights,
  mergeInsights,
  summarizeInsights,
  evaluateStageAdvance,
} from "@/lib/listener/insights";

const CHAT_MODEL = process.env.CHAT_AI_MODEL ?? "llama3:8b";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3:8b";
const CONTEXT_FILE = "CONSULT_LISTENER.txt";
const HISTORY_TURNS = 20;
const EXTRACTION_EVERY = 4;

// tryProposeGoal's companionProfile param uses DriveSignal names; the Listener's
// insights use DriveType names — bridge without touching profileSync internals.
const DRIVE_TYPE_TO_SIGNAL: Record<DriveValue, string> = {
  learning: "Seeker",
  helping: "Guardian",
  building: "Builder",
  doing: "Keeper",
};

function readLangCookie(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)lang=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function buildSystemPrompt(stage: number, insights: ConsultInsights, language: string | null): string {
  const persona = loadSection(CONTEXT_FILE, "PERSONA");
  const never = loadSection(CONTEXT_FILE, "NEVER");
  const crisis = loadSection(CONTEXT_FILE, "CRISIS");
  const phases = loadSection(CONTEXT_FILE, "PHASES");

  const methods: string[] = [];
  if (stage <= 1) methods.push(loadSection(CONTEXT_FILE, "METHOD_ROGERIAN"));
  if (stage >= 1 && stage <= 3) methods.push(loadSection(CONTEXT_FILE, "METHOD_MI"));
  if (stage >= 3 && stage <= 4) methods.push(loadSection(CONTEXT_FILE, "METHOD_SFBT"));
  const sensing = stage <= 3 ? loadSection(CONTEXT_FILE, "PARAMETER_SENSING") : "";

  const summary = summarizeInsights(insights);

  return [
    persona,
    never ? `WHAT YOU NEVER DO:\n${never}` : "",
    crisis ? `CRISIS PROTOCOL (overrides everything below):\n${crisis}` : "",
    phases ? `STAGES:\n${phases}\n\nCurrent stage: ${stage}.` : `Current stage: ${stage}.`,
    ...methods.filter(Boolean),
    sensing,
    summary ? `WHAT YOU'VE QUIETLY SENSED SO FAR (internal notes — never recite these to the user):\n${summary}` : "",
    language
      ? `Respond in the user's language (code: "${language}"). If they write in a different language, follow them.`
      : "Respond in whichever language the user writes in.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

interface ExtractionResult {
  insights: ConsultInsights;
  goalEmerging: boolean;
}

async function runExtraction(current: ConsultInsights, conversationText: string): Promise<ExtractionResult | null> {
  try {
    const raw = await chatComplete({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: "Respond ONLY with valid JSON, no markdown, no explanation." },
        {
          role: "user",
          content: `You are analysing a supportive listening conversation. Current notes JSON:
${JSON.stringify(current)}

Recent conversation:
${conversationText}

Update the notes from the conversation. Only record things the user actually said — never invent. Return ONLY this JSON shape:
{"themes":["..."],"driveCandidate":{"value":"learning"|"helping"|"building"|"doing"|null,"confidence":"sensed"|"confirmed"},"skills":{"items":["..."]},"health":{"notes":["..."],"senseLevel":1-10|null},"environment":{"notes":["..."]},"time":{"notes":["..."],"dailyHours":number|null},"funds":{"notes":["..."],"pressure":"low"|"medium"|"high"|null},"network":{"notes":["..."]},"energy":{"senseLevel":1-10|null},"goalEmerging":boolean}

driveCandidate.value: which the user's own values lean toward — learning new things, helping people, building/creating, or doing steady practical work. "confirmed" only if the user explicitly affirmed it.
goalEmerging: true only if a concrete goal the user wants is taking shape in their OWN words.`,
        },
      ],
      maxTokens: 500,
      temperature: 0.2,
      jsonMode: true,
    });
    const parsed = safeJsonParse<Record<string, unknown>>(raw);
    return {
      insights: mergeInsights(current, normalizeInsights(parsed)),
      goalEmerging: parsed?.goalEmerging === true,
    };
  } catch (err) {
    console.error("[listen] extraction failed:", err);
    return null;
  }
}

export async function POST(req: Request) {
  const requestStart = Date.now();
  const localAiEnabled = process.env.LOCAL_AI_ENABLED === "true";
  const activeModel = localAiEnabled ? OLLAMA_MODEL : CHAT_MODEL;

  const payload = await authenticateChat(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = payload.userId;

  const body = await req.json();
  const { message, dismissedProposals } = body as { message: string; dismissedProposals?: string[] };
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  const inputGuard = runInputGuard({ userId, message, ipAddress });
  if (inputGuard.blocked) return NextResponse.json(inputGuard.reply);

  const session = await (db as any).consultSession.upsert({
    where: { userId },
    create: { userId, language: readLangCookie(req) },
    update: {},
  });

  const stage: number = session.consultStage ?? 0;
  let insights = normalizeInsights(session.insights);

  // History is rebuilt server-side — client-sent history is never trusted.
  const historyRows: { role: string; content: string }[] = await (db as any).consultMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_TURNS,
    select: { role: true, content: true },
  });
  historyRows.reverse();

  await (db as any).consultMessage.create({
    data: { sessionId: session.id, role: "user", content: message },
  });

  const systemPrompt = buildSystemPrompt(stage, insights, session.language);
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...historyRows.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ];

  const result = await runGuardedCompletion({
    userId,
    message,
    ipAddress,
    messages,
    maxTokens: 220,
    temperature: 0.7,
    requestStart,
    activeModel,
  });
  if (result.type !== "ok") {
    return NextResponse.json(result.response);
  }
  const { reply } = result;

  await (db as any).consultMessage.create({
    data: { sessionId: session.id, role: "assistant", content: reply },
  });

  // ── Extraction pass — every 4th user message, cheap and local-first ────────
  let nextStage = stage;
  const userMsgCount: number = await (db as any).consultMessage.count({
    where: { sessionId: session.id, role: "user" },
  });

  if (userMsgCount % EXTRACTION_EVERY === 0) {
    const conversationText = [
      ...historyRows.map((m) => `${m.role}: ${m.content}`),
      `user: ${message}`,
      `assistant: ${reply}`,
    ].join("\n");

    const extraction = await runExtraction(insights, conversationText);
    if (extraction) {
      insights = extraction.insights;
      nextStage = evaluateStageAdvance(stage, insights, extraction.goalEmerging);
      await (db as any).consultSession.update({
        where: { id: session.id },
        data: { insights: insights as any, consultStage: nextStage },
      });
    }
  }

  const responsePayload: Record<string, unknown> = {
    ok: true,
    reply,
    consultStage: nextStage,
  };

  // ── Goal proposal — stage 4 only, via the shared proposal mechanism ────────
  // Goal candidates flow EXCLUSIVELY through proposals — never stored in insights.
  if (nextStage === 4 && insights.driveCandidate.value) {
    const profile = await db.profile.findUnique({ where: { userId }, select: { goals: true } }).catch(() => null);
    const conversationText = [
      ...historyRows.map((m) => `${m.role}: ${m.content}`),
      `user: ${message}`,
      `assistant: ${reply}`,
    ].join("\n");

    // Synthetic companionProfile param built from Listener insights — tryProposeGoal
    // only reads these two fields off the param; it never queries (or writes) UCP.
    const proposal = await tryProposeGoal({
      profile,
      companionProfile: {
        primaryDrive: DRIVE_TYPE_TO_SIGNAL[insights.driveCandidate.value],
        driveConfirmedByUser: true,
      },
      dismissed: Array.isArray(dismissedProposals) ? dismissedProposals : [],
      conversationText,
    });
    if (proposal) responsePayload.proposal = proposal;
  }

  return NextResponse.json(responsePayload);
}

export async function GET(req: Request) {
  const payload = await authenticateChat(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await (db as any).consultSession.findUnique({
    where: { userId: payload.userId },
  });
  if (!session) {
    return NextResponse.json({ ok: true, consultStage: 0, insights: emptyInsights(), messages: [] });
  }

  const rows: { id: string; role: string; content: string; createdAt: Date }[] = await (db as any).consultMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, role: true, content: true, createdAt: true },
  });
  rows.reverse();

  return NextResponse.json({
    ok: true,
    consultStage: session.consultStage ?? 0,
    insights: normalizeInsights(session.insights),
    messages: rows,
  });
}
