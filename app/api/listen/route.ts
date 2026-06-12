// app/api/listen/route.ts — Listener (Saathi) conversation backend (CONSULT-1b/-2).
//
// A PARALLEL system to /api/chat: shares lib/ai/chatPipeline (auth + guardrails +
// timeout + guarded completion) and the ProfileProposal mechanism, but has its own
// persona (ai-context/CONSULT_LISTENER.txt), its own persistence (ConsultSession /
// ConsultMessage), and no platform/initiative/mentor context blocks.
//
// HARD RULE: no UserCompanionProfile writes from this file or anything it owns —
// UCP fields gate the companion arc state machine (CONSULT-0c §4). Reads are fine.
//
// Crisis (CONSULT-2): crisis language is a SOFT OVERRIDE, never a guardrail BLOCK.
// On detection: latch ConsultSession.crisisFlag (never auto-cleared), force the
// CRISIS prompt, skip extraction/proposals/stage advancement, log LISTEN_CRISIS.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";
import { loadSection } from "@/lib/ai/contextLoader";
import { authenticateChat, runInputGuard, runGuardedCompletion } from "@/lib/ai/chatPipeline";
import { scanInputCrisis } from "@/lib/ai/guardRail";
import { notifyAdmin } from "@/lib/ai/adminNotify";
import { tryProposeGoal } from "@/lib/companion/profileSync";
import { buildUserContext } from "@/lib/ai/userContext";
import { checkRateLimit } from "@/lib/rateLimit";
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
const EXTRACTION_EVERY = 4;
const LISTEN_MSG_LIMIT_5MIN = parseInt(process.env.LISTEN_MSG_LIMIT_5MIN ?? "20", 10);
const LISTEN_MSG_LIMIT_DAY = parseInt(process.env.LISTEN_MSG_LIMIT_DAY ?? "200", 10);

// Stable-prefix history (UCTX-1b): while the model window holds ≤ FOLD_THRESHOLD
// messages we send them all (append-only). Once it exceeds the threshold we fold
// the oldest FOLD_BATCH into ConsultSession.rollingSummary and exclude them from
// the window thereafter, keeping the prefix stable between turns.
const FOLD_THRESHOLD = 30;
const FOLD_BATCH = 16;

// tryProposeGoal's companionProfile param uses DriveSignal names; the Listener's
// insights use DriveType names — bridge without touching profileSync internals.
const DRIVE_TYPE_TO_SIGNAL: Record<DriveValue, string> = {
  learning: "Seeker",
  helping: "Guardian",
  building: "Builder",
  doing: "Keeper",
};

// Mind-map steering (CONSULT-2). steer is a structured field — never stored in
// the transcript as fake user text. The hint applies to this turn only.
const STEER_LABELS: Record<string, string> = {
  drive: "what truly drives them",
  goal: "the goal taking shape",
  skills: "their skills",
  health: "their health",
  environment: "their surroundings and living situation",
  time: "their time and daily routine",
  funds: "their money situation",
  network: "the people around them",
  energy: "their energy levels",
};

function readLangCookie(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)lang=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Assembly order is static → semi-static → dynamic (UCTX-1b). languageLine moved
// UP into the static zone (per audit); the folded rollingSummary sits in the
// semi-static zone (changes only at fold events); the per-turn insights/context
// block and steerHint are dynamic and come last. Crisis-mode order is unchanged.
//
// `dynamicBlock` is the fully-formed dynamic context block — the local insights
// summary OR the minimal tier-"cloud" composer block; the route picks which.
function buildSystemPrompt(
  stage: number,
  language: string | null,
  opts: { crisis?: boolean; steerHint?: string; rollingSummary?: string; dynamicBlock?: string } = {}
): string {
  const persona = loadSection(CONTEXT_FILE, "PERSONA");
  const never = loadSection(CONTEXT_FILE, "NEVER");
  const crisis = loadSection(CONTEXT_FILE, "CRISIS");

  const languageLine = language
    ? `Respond in the user's language (code: "${language}"). If they write in a different language, follow them.`
    : "Respond in whichever language the user writes in.";

  // Crisis mode: persona + crisis protocol front and center. No stages, no
  // methods, no parameter sensing, no insights recital — just presence.
  if (opts.crisis) {
    return [
      persona,
      `THIS CONVERSATION IS IN CRISIS MODE. The protocol below overrides everything else — follow it for every reply until the user clearly and on their own steers back to everyday topics:\n${crisis}`,
      never ? `WHAT YOU NEVER DO:\n${never}` : "",
      languageLine,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const phases = loadSection(CONTEXT_FILE, "PHASES");
  const methods: string[] = [];
  if (stage <= 1) methods.push(loadSection(CONTEXT_FILE, "METHOD_ROGERIAN"));
  if (stage >= 1 && stage <= 3) methods.push(loadSection(CONTEXT_FILE, "METHOD_MI"));
  if (stage >= 3 && stage <= 4) methods.push(loadSection(CONTEXT_FILE, "METHOD_SFBT"));
  const sensing = stage <= 3 ? loadSection(CONTEXT_FILE, "PARAMETER_SENSING") : "";

  return [
    // static
    persona,
    never ? `WHAT YOU NEVER DO:\n${never}` : "",
    crisis ? `CRISIS PROTOCOL (overrides everything below):\n${crisis}` : "",
    languageLine,
    // semi-static
    phases ? `STAGES:\n${phases}\n\nCurrent stage: ${stage}.` : `Current stage: ${stage}.`,
    ...methods.filter(Boolean),
    sensing,
    opts.rollingSummary
      ? `EARLIER IN THIS CONVERSATION (older messages, condensed — internal context, never recite):\n${opts.rollingSummary}`
      : "",
    // dynamic
    opts.dynamicBlock ?? "",
    opts.steerHint ? `THIS TURN ONLY:\n${opts.steerHint}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Folds the oldest batch of messages into a single rolling summary. Returns the
// merged summary on success, or null on failure (caller then skips the fold and
// retries next turn — the window stays large but correct).
async function summarizeForFold(existing: string | null, foldText: string): Promise<string | null> {
  try {
    const raw = await chatComplete({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: 'Respond ONLY with valid JSON: {"summary":"..."}. No markdown, no explanation.' },
        {
          role: "user",
          content: `Running summary of an ongoing supportive listening conversation (may be empty):
${existing || "(none yet)"}

Older messages to fold into it:
${foldText}

Merge them into ONE compact summary (max ~200 words) that preserves what the person shared — their situation, feelings, themes, and anything they said they want. Stay factual; do not invent. Return ONLY {"summary":"..."}.`,
        },
      ],
      maxTokens: 400,
      temperature: 0.2,
      jsonMode: true,
    });
    const parsed = safeJsonParse<{ summary?: string }>(raw);
    const merged = (parsed?.summary ?? "").trim();
    return merged || existing || "";
  } catch (err) {
    console.error("[listen] fold summarization failed:", err);
    return null;
  }
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
  const { message, steer, correction, dismissedProposals } = body as {
    message?: string;
    steer?: string;
    correction?: boolean;
    dismissedProposals?: string[];
  };

  const text = typeof message === "string" ? message.trim() : "";
  const steerNode = typeof steer === "string" && STEER_LABELS[steer] ? steer : null;
  if (!text && !steerNode) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  // Guardrail scan only applies to real user text — steer is a fixed enum.
  if (text) {
    const inputGuard = runInputGuard({ userId, message: text, ipAddress });
    if (inputGuard.blocked) return NextResponse.json(inputGuard.reply);
  }

  // Message rate limiting (UCTX-2): per-user limits for /api/listen (stricter than /api/chat)
  // Only count real message turns, not steer-only turns
  if (text) {
    const shortLimit = await checkRateLimit(`listen:msg:${userId}`, LISTEN_MSG_LIMIT_5MIN, 300);
    if (!shortLimit.ok) {
      return NextResponse.json({
        ok: false,
        reply: "Let's take a small pause — I'm here when you're back.",
        consultStage: 0,
        retryAfter: 300,
      });
    }

    const dayLimit = await checkRateLimit(`listen:msg:${userId}:day`, LISTEN_MSG_LIMIT_DAY, 86400);
    if (!dayLimit.ok) {
      return NextResponse.json({
        ok: false,
        reply: "You've reached today's conversation limit. Come back tomorrow to continue our talk.",
        consultStage: 0,
        retryAfter: 86400,
      });
    }
  }

  const session = await (db as any).consultSession.upsert({
    where: { userId },
    create: { userId, language: readLangCookie(req) },
    update: {},
  });

  const stage: number = session.consultStage ?? 0;
  let insights = normalizeInsights(session.insights);

  // ── Crisis detection — soft override, never a BLOCK ────────────────────────
  // Once latched, the session stays in crisis mode (cleared only manually).
  let crisisActive: boolean = session.crisisFlag === true;
  if (text && !crisisActive) {
    const crisisScan = scanInputCrisis(text);
    if (crisisScan.crisis) {
      crisisActive = true;
      await (db as any).consultSession.update({
        where: { id: session.id },
        data: { crisisFlag: true },
      });
      notifyAdmin({
        userId,
        eventType: "LISTEN_CRISIS",
        userMessage: text,
        reason: "Crisis language detected in Listener conversation",
        matchedPattern: crisisScan.matchedPattern!,
        timestamp: new Date().toISOString(),
        ipAddress,
      }).catch(console.error);
    }
  }

  // ── Stable-prefix history ──────────────────────────────────────────────────
  // History is rebuilt server-side — client-sent history is never trusted. We
  // send the UNFOLDED messages (createdAt > foldedThrough) append-only; older
  // turns live in session.rollingSummary. When the unfolded window exceeds the
  // threshold, fold the oldest batch here so the prefix stays stable next turn.
  const foldedThrough: Date | null = session.foldedThrough ?? null;
  let windowRows: { role: string; content: string; createdAt: Date }[] = await (db as any).consultMessage.findMany({
    where: { sessionId: session.id, ...(foldedThrough ? { createdAt: { gt: foldedThrough } } : {}) },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true, createdAt: true },
  });

  let rollingSummary: string = session.rollingSummary ?? "";
  if (windowRows.length > FOLD_THRESHOLD) {
    const toFold = windowRows.slice(0, FOLD_BATCH);
    const foldText = toFold.map((m) => `${m.role}: ${m.content}`).join("\n");
    const merged = await summarizeForFold(rollingSummary || null, foldText);
    if (merged !== null) {
      // createdAt of the oldest-batch's last message becomes the new fold boundary.
      const boundary = toFold[toFold.length - 1].createdAt;
      await (db as any).consultSession.update({
        where: { id: session.id },
        data: { rollingSummary: merged, foldedThrough: boundary },
      });
      rollingSummary = merged;
      windowRows = windowRows.slice(FOLD_BATCH);
    }
    // merged === null → fold deferred; window stays large this turn, retried next.
  }

  if (text) {
    await (db as any).consultMessage.create({
      data: { sessionId: session.id, role: "user", content: text },
    });
  }

  let steerHint = "";
  if (steerNode && !crisisActive) {
    const label = STEER_LABELS[steerNode];
    steerHint = correction
      ? `The user pointed at "${steerNode}" on their progress map and indicated what you've sensed there is NOT right. Don't assume or repeat it — gently re-ask about ${label} and let them restate it in their own words.`
      : `The user tapped "${steerNode}" on their progress map — they want to talk about ${label} next. Transition into it warmly, with at most one gentle question.`;
  }

  // Dynamic context block — local gets the full sensed-insights summary; cloud
  // gets only the minimal tier-"cloud" composer block (drive name + stage etc.).
  const insightsSummary = summarizeInsights(insights);
  const localDynamicBlock = insightsSummary
    ? `WHAT YOU'VE QUIETLY SENSED SO FAR (internal notes — never recite these to the user):\n${insightsSummary}`
    : "";
  const cloudDynamicBlock = await buildUserContext(userId, {
    tier: "cloud",
    language: session.language,
    stage,
    driveName: insights.driveCandidate.value,
  });

  const systemPrompt = buildSystemPrompt(stage, session.language, {
    crisis: crisisActive,
    steerHint,
    rollingSummary,
    dynamicBlock: localDynamicBlock,
  });
  const cloudSystemPrompt = buildSystemPrompt(stage, session.language, {
    crisis: crisisActive,
    steerHint,
    rollingSummary,
    dynamicBlock: cloudDynamicBlock,
  });

  // Steer-only turns get an in-flight marker so every provider sees a final user
  // turn — the marker is never persisted (no fake user text in the transcript).
  // It is a known, minor, acceptable prefix perturbation on steer-only turns.
  const modelUserText = text || `[map tap: ${steerNode}] (see system note — respond directly, do not mention the map mechanics)`;

  const historyMsgs = windowRows.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...historyMsgs,
    { role: "user", content: modelUserText },
  ];
  const cloudMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: cloudSystemPrompt },
    ...historyMsgs,
    { role: "user", content: modelUserText },
  ];

  const result = await runGuardedCompletion({
    userId,
    message: modelUserText,
    ipAddress,
    messages,
    cloudMessages,
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

  // Crisis mode: no extraction, no stage advancement, no proposals.
  if (crisisActive) {
    return NextResponse.json({ ok: true, reply, consultStage: stage, crisis: true });
  }

  // ── Extraction pass — every 4th user message, cheap and local-first ────────
  let nextStage = stage;
  const userMsgCount: number = await (db as any).consultMessage.count({
    where: { sessionId: session.id, role: "user" },
  });

  if (text && userMsgCount % EXTRACTION_EVERY === 0) {
    const conversationText = [
      ...windowRows.map((m) => `${m.role}: ${m.content}`),
      `user: ${text}`,
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
    crisis: false,
  };

  // ── Goal proposal — stage 4 only, via the shared proposal mechanism ────────
  // Goal candidates flow EXCLUSIVELY through proposals — never stored in insights.
  if (nextStage === 4 && insights.driveCandidate.value) {
    const profile = await db.profile.findUnique({ where: { userId }, select: { goals: true } }).catch(() => null);
    const conversationText = [
      ...windowRows.map((m) => `${m.role}: ${m.content}`),
      text ? `user: ${text}` : "",
      `assistant: ${reply}`,
    ]
      .filter(Boolean)
      .join("\n");

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
    return NextResponse.json({ ok: true, consultStage: 0, insights: emptyInsights(), messages: [], crisis: false });
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
    crisis: session.crisisFlag === true,
  });
}
