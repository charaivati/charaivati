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

import { NextResponse, after } from "next/server";
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
import {
  type PersonalityData,
  emptyPersonality,
  normalizePersonality,
  normalizeDeltas,
  applyPersonalityDeltas,
  summarizePersonalityForComposer,
  topDriveName,
} from "@/lib/listener/personality";
import { isAdminUser, handleAdminCommand, getOpenAdminQuestions, fileAdminQuestion } from "@/lib/listener/adminBridge";
import { buildSiteAwareness, buildSiteAwarenessCompact } from "@/lib/site/siteAwareness";
import { isCapabilityGapCandidate, replyHedges, isCapabilityDeclineReply } from "@/lib/ai/capabilityGapTrigger";
import { isFriendRequest, isReminderRequest, isReminderCancel, isUnfriendRequest, isBlockRequest, isLogoutRequest, isClearChatRequest, isLoginRequest } from "@/lib/ai/actionTrigger";
import { looksActionShaped, classifyIntent } from "@/lib/listener/intentClassifier";
import {
  extractFriendQuery,
  extractReminderQuery,
  extractUnfriendQuery,
  extractBlockQuery,
  buildFriendSearchAction,
  buildReminderAction,
  buildUnfriendAction,
  buildBlockAction,
  sendReminder,
  describeFriendSearchReply,
  describeReminderReply,
  describeReminderSentReply,
  describeReminderAskTextReply,
  describeReminderFailedReply,
  describeReminderCancelledReply,
  describeUnfriendReply,
  describeBlockReply,
  describeLogoutReply,
  describeClearChatReply,
  describeLoginOfferReply,
  getPendingFriendRequests,
} from "@/lib/listener/actions";
import type { ListenAction } from "@/lib/listener/actionTypes";

const CHAT_MODEL = process.env.CHAT_AI_MODEL ?? "llama3:8b";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3:8b";
const CONTEXT_FILE = "CONSULT_LISTENER.txt";
const EXTRACTION_EVERY = 4;
// UCTX-3: personality is built slowly — one delta pass per 8th user message,
// local-tier composer use only. PERSONALITY_OFFSET (FIX-OLLAMA-TIMEOUT-1)
// shifts the cadence to userMsgCount % 8 === 2, which is never a multiple of
// EXTRACTION_EVERY (4) — so insights and personality extraction never land on
// the same turn and stack two Ollama prefills back to back.
const PERSONALITY_EVERY = 8;
const PERSONALITY_OFFSET = 2;
const PERSONALITY_COMPOSER_THRESHOLD = 0.3;
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

// Site awareness (PERSONA-2): semi-static — built once per process from
// capabilityRegistry, not per turn. Local gets the instruction + full per-layer
// map; cloud gets a one-line summary (platform structure is non-sensitive, but
// cloud prompts stay lean per UCTX-1b).
const SITE_AWARENESS_LOCAL = [loadSection(CONTEXT_FILE, "SITE_AWARENESS"), `SITE MAP:\n${buildSiteAwareness()}`]
  .filter(Boolean)
  .join("\n\n");
const SITE_AWARENESS_CLOUD = `SITE AWARENESS: ${buildSiteAwarenessCompact()} When asked about site features, be honest about what's live vs planned — never invent or deny features.`;

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
  opts: {
    crisis?: boolean;
    steerHint?: string;
    rollingSummary?: string;
    dynamicBlock?: string;
    personalityGuidance?: string;
    adminMode?: string;
    siteAwareness?: string;
  } = {}
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

  // Admin mode (PERSONA-1): a different kind of conversation entirely — no
  // stages, methods, parameter sensing, or personality guidance. Replaces
  // those semi-static blocks with the ADMIN_MODE section + any open questions.
  if (opts.adminMode) {
    return [
      // static
      persona,
      never ? `WHAT YOU NEVER DO:\n${never}` : "",
      crisis ? `CRISIS PROTOCOL (overrides everything below):\n${crisis}` : "",
      languageLine,
      // semi-static
      opts.adminMode,
      opts.siteAwareness ?? "",
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

  const capabilities = loadSection(CONTEXT_FILE, "CAPABILITIES");
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
    capabilities,
    languageLine,
    // semi-static
    phases ? `STAGES:\n${phases}\n\nCurrent stage: ${stage}.` : `Current stage: ${stage}.`,
    ...methods.filter(Boolean),
    sensing,
    opts.siteAwareness ?? "",
    opts.rollingSummary
      ? `EARLIER IN THIS CONVERSATION (older messages, condensed — internal context, never recite):\n${opts.rollingSummary}`
      : "",
    opts.personalityGuidance ? opts.personalityGuidance : "",
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

// UCTX-3: every 8th user message, sense small DISC/drive deltas from the last
// ~12 messages. Signals only — never diagnoses, never names the framework to
// the user. Weak/no signal → empty deltas (caller applies a no-op pass).
// Failure isolation matches runExtraction: a bad parse just drops this pass.
async function runPersonalityExtraction(current: PersonalityData, recentMessages: string) {
  try {
    const raw = await chatComplete({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: "Respond ONLY with valid JSON, no markdown, no explanation." },
        {
          role: "user",
          content: `You are sensing SOFT personality signals from a supportive listening conversation — never diagnose, never label the person, never mention this analysis to them.

Current DISC scores (0-1, 0.5 = no signal yet):
${JSON.stringify(current.disc)}

Current drive-energy scores (0-1, 0.5 = no signal yet):
${JSON.stringify(current.driveScores)}

Recent conversation:
${recentMessages}

Based ONLY on what the person actually said — their decisiveness, detail-orientation, people-focus, patience, and what seems to energize them — propose SMALL adjustments (each between -0.1 and 0.1; use 0 or omit a key if there's no signal). If the signal is weak, return empty/zero deltas — do not force a reading.

DISC dims: D = directness/decisiveness, I = people/relational warmth, S = patience/steadiness, C = detail/concreteness.
Drive dims: learning, helping, building, doing — which energizes them.

Return ONLY this JSON shape:
{"disc":{"D":number,"I":number,"S":number,"C":number},"drives":{"learning":number,"helping":number,"building":number,"doing":number},"evidence":["short evidence string", "..."]}

evidence: 0-2 short factual strings describing what was observed (e.g. "asked for a clear next step rather than options" — never a label like 'this person is a D-type').`,
        },
      ],
      maxTokens: 350,
      temperature: 0.2,
      jsonMode: true,
    });
    const parsed = safeJsonParse<Record<string, unknown>>(raw);
    return normalizeDeltas(parsed);
  } catch (err) {
    console.error("[listen] personality extraction failed:", err);
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
  const isAdmin = await isAdminUser(userId);

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
  const chatResetAt: Date | null = session.chatResetAt ?? null;
  // ACTION-INTENT-5c: the effective lower bound for the model window is the
  // LATER of foldedThrough and chatResetAt — a clear-chat must never be
  // undone by pulling pre-reset rows back into the window or a later fold.
  // /api/listen/clear keeps foldedThrough >= chatResetAt as an invariant
  // going forward, but this max() is the defensive backstop.
  const windowBoundary: Date | null =
    foldedThrough && chatResetAt
      ? (foldedThrough > chatResetAt ? foldedThrough : chatResetAt)
      : foldedThrough ?? chatResetAt ?? null;
  const windowRows: { role: string; content: string; createdAt: Date }[] = await (db as any).consultMessage.findMany({
    where: { sessionId: session.id, ...(windowBoundary ? { createdAt: { gt: windowBoundary } } : {}) },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true, createdAt: true },
  });

  // FIX-OLLAMA-TIMEOUT-1: folding used to run inline here (an extra Ollama
  // prefill blocking the reply). It now runs in the post-response background
  // task below — this turn's prompt simply uses the unfolded window as-is
  // (occasionally a little larger; never an extra blocking LLM call).
  const rollingSummary: string = session.rollingSummary ?? "";

  if (text) {
    await (db as any).consultMessage.create({
      data: { sessionId: session.id, role: "user", content: text },
    });
    // ACTION-INTENT-3: persist for next turn's pronoun resolution. session.recentIntentNote
    // (captured above, before this write) still holds THIS turn's "previous" context.
    await (db as any).consultSession
      .update({
        where: { id: session.id },
        data: { recentIntentNote: text.slice(0, 200) },
      })
      .catch(() => {});
  }

  // ── Admin commands — intercepted BEFORE the conversational model call ──────
  // Deterministic, card-confirmed persona writes. Never reached for non-admins.
  if (isAdmin && text && !crisisActive) {
    const conversationText = [
      ...windowRows.map((m) => `${m.role}: ${m.content}`),
      `user: ${text}`,
    ].join("\n");
    const commandResult = await handleAdminCommand(text, conversationText);
    if (commandResult) {
      await (db as any).consultMessage.create({
        data: { sessionId: session.id, role: "assistant", content: commandResult.reply },
      });
      return NextResponse.json({
        ok: true,
        reply: commandResult.reply,
        consultStage: stage,
        crisis: false,
        ...(commandResult.personaProposal ? { personaProposal: commandResult.personaProposal } : {}),
      });
    }
  }

  // ── First chat actions (PRIV-ACT-1): friend request / reminder ─────────────
  // Server-side intent triggers — on a match the model is used ONLY for one
  // jsonMode extraction call; the reply + action payload are built
  // deterministically (lib/listener/actions.ts). Writes happen only after the
  // user confirms a card, via dedicated routes under /api/listen/actions/*.
  //
  // ACTION-INTENT-5b: reminders to existing friends are low-stakes and now
  // SEND-AND-REPORT — no confirm card for the single-friend-match case.
  // resolveAndSendReminder() encapsulates: build the action, and if it
  // resolves to exactly one friend, send immediately via the shared
  // sendReminder() helper and report the real result (ACTION-INTENT-5a
  // doctrine — success text is downstream of the actual write). Ambiguous
  // (reminder_pick), non-friend, and not-found cases are unchanged.
  // Destructive relationship changes (unfriend/block) KEEP their confirm
  // cards — this relaxation is reminder-only.
  async function resolveAndSendReminder(
    recipientName: string,
    reminderText: string
  ): Promise<{ action: ListenAction | null; actionReply: string }> {
    const builtAction = await buildReminderAction(userId, recipientName, reminderText);
    if (builtAction.type === "reminder_confirm") {
      const result = await sendReminder(userId, builtAction.recipient.id, builtAction.text);
      if (result.ok) {
        return { action: null, actionReply: describeReminderSentReply(builtAction.recipient.name, builtAction.text) };
      }
      return { action: null, actionReply: describeReminderFailedReply(result.message) };
    }
    return { action: builtAction, actionReply: describeReminderReply(builtAction) };
  }

  if (text && !crisisActive && !isAdmin) {
    let action: ListenAction | null = null;
    let actionReply = "";

    // ── pendingReminder continuation (CHANGE 2) ───────────────────────────────
    // Strict one-turn window: "Remind Madhurjya" -> "What should I remind him?"
    // -> next turn is consumed here, regardless of outcome. Always cleared
    // immediately so it can never leak into a third turn.
    const pendingReminder = (session as any).pendingReminder as
      | { recipientName: string; awaitingText: true }
      | null
      | undefined;

    let pendingHandled = false;
    if (pendingReminder?.awaitingText) {
      await (db as any).consultSession
        .update({ where: { id: session.id }, data: { pendingReminder: null } })
        .catch(() => {});

      if (isReminderCancel(text)) {
        actionReply = describeReminderCancelledReply();
        pendingHandled = true;
      } else if (
        isFriendRequest(text) ||
        isReminderRequest(text) ||
        isUnfriendRequest(text) ||
        isBlockRequest(text) ||
        isLogoutRequest(text) ||
        isClearChatRequest(text) ||
        (isLoginRequest(text) && payload.role === "guest")
      ) {
        // Another recognized action takes precedence — abandon the pending
        // reminder (already cleared above) and process the new intent below.
        pendingHandled = false;
      } else {
        // Treat this turn's text as the reminder message for the pending recipient.
        const result = await resolveAndSendReminder(pendingReminder.recipientName, text);
        action = result.action;
        actionReply = result.actionReply;
        pendingHandled = true;
      }
    }

    if (!pendingHandled && isFriendRequest(text)) {
      const query = await extractFriendQuery(text, activeModel);
      if (query.name) {
        action = await buildFriendSearchAction(userId, { name: query.name, location: query.location });
        actionReply = describeFriendSearchReply(action);
      }
    } else if (!pendingHandled && isReminderRequest(text)) {
      const extracted = await extractReminderQuery(text, activeModel);
      const isEchoOfName =
        extracted.recipientName &&
        extracted.reminderText &&
        extracted.reminderText.trim().toLowerCase() === extracted.recipientName.trim().toLowerCase();

      if (extracted.recipientName && extracted.reminderText && !isEchoOfName) {
        // CHANGE 1: both present and resolved — send-and-report, no confirm.
        const result = await resolveAndSendReminder(extracted.recipientName, extracted.reminderText);
        action = result.action;
        actionReply = result.actionReply;
      } else if (extracted.recipientName) {
        // CHANGE 2: recipient resolved but no real message yet — ask once and
        // remember the recipient for the next turn.
        await (db as any).consultSession
          .update({
            where: { id: session.id },
            data: { pendingReminder: { recipientName: extracted.recipientName, awaitingText: true } },
          })
          .catch(() => {});
        actionReply = describeReminderAskTextReply(extracted.recipientName);
      }
    } else if (!pendingHandled && isUnfriendRequest(text)) {
      const extracted = await extractUnfriendQuery(text, activeModel);
      if (extracted.name) {
        action = await buildUnfriendAction(userId, extracted.name);
        actionReply = describeUnfriendReply(action);
      }
    } else if (!pendingHandled && isBlockRequest(text)) {
      const extracted = await extractBlockQuery(text, activeModel);
      if (extracted.name) {
        action = await buildBlockAction(userId, extracted.name);
        actionReply = describeBlockReply(action);
      }
    } else if (!pendingHandled && isLogoutRequest(text)) {
      // ACTION-INTENT-3: strict-keyword-only — never reached via the classifier.
      action = { type: "logout_confirm" };
      actionReply = describeLogoutReply();
    } else if (!pendingHandled && isClearChatRequest(text)) {
      // ACTION-INTENT-3: strict-keyword-only — never reached via the classifier.
      action = { type: "clear_chat_confirm" };
      actionReply = describeClearChatReply();
    } else if (!pendingHandled && isLoginRequest(text) && payload.role === "guest") {
      // TONE-DECLINE-1: strict-keyword-only. Offer the real sign-in path
      // (SecureChatCard / login page) instead of a flat decline. Signed-in
      // users asking this fall through to the normal model, which declines
      // warmly per [SECTION: CAPABILITIES].
      action = { type: "login_offer" };
      actionReply = describeLoginOfferReply();
    } else if (!pendingHandled && !actionReply && looksActionShaped(text)) {
      // ACTION-INTENT-3: second-tier classifier — only when the cheap keyword
      // checks above all missed AND the message plausibly describes an action.
      const classified = await classifyIntent(text, session.recentIntentNote ?? null, activeModel);
      if (classified.intent === "add_friend") {
        const query = await extractFriendQuery(text, activeModel);
        if (query.name) {
          action = await buildFriendSearchAction(userId, { name: query.name, location: query.location });
          actionReply = describeFriendSearchReply(action);
        }
      } else if (classified.intent === "remove_friend") {
        const extracted = await extractUnfriendQuery(text, activeModel);
        if (extracted.name) {
          action = await buildUnfriendAction(userId, extracted.name);
          actionReply = describeUnfriendReply(action);
        }
      } else if (classified.intent === "block_user") {
        const extracted = await extractBlockQuery(text, activeModel);
        if (extracted.name) {
          action = await buildBlockAction(userId, extracted.name);
          actionReply = describeBlockReply(action);
        }
      } else if (classified.intent === "send_reminder") {
        const extracted = await extractReminderQuery(text, activeModel);
        const isEchoOfName =
          extracted.recipientName &&
          extracted.reminderText &&
          extracted.reminderText.trim().toLowerCase() === extracted.recipientName.trim().toLowerCase();

        if (extracted.recipientName && extracted.reminderText && !isEchoOfName) {
          const result = await resolveAndSendReminder(extracted.recipientName, extracted.reminderText);
          action = result.action;
          actionReply = result.actionReply;
        } else if (extracted.recipientName) {
          await (db as any).consultSession
            .update({
              where: { id: session.id },
              data: { pendingReminder: { recipientName: extracted.recipientName, awaitingText: true } },
            })
            .catch(() => {});
          actionReply = describeReminderAskTextReply(extracted.recipientName);
        }
      } else if (classified.intent === "unknown_capability") {
        fileAdminQuestion(userId, text, "capability_request").catch(console.error);
        actionReply =
          "I can't do that here yet — I've passed it along so the team can consider adding it. Is there something else I can help with?";
      }
      // logout / clear_chat / chat / show_map / accept_friend_request from the
      // classifier are NOT acted on directly — they fall through to the normal
      // conversational flow (logout/clear_chat remain strict-keyword-only).
    }

    if (actionReply) {
      await (db as any).consultMessage.create({
        data: { sessionId: session.id, role: "assistant", content: actionReply },
      });
      return NextResponse.json({
        ok: true,
        reply: actionReply,
        consultStage: stage,
        crisis: false,
        ...(action ? { action } : {}),
      });
    }
  }

  let steerHint = "";
  if (steerNode && !crisisActive) {
    const label = STEER_LABELS[steerNode];
    steerHint = correction
      ? `The user pointed at "${steerNode}" on their progress map and indicated what you've sensed there is NOT right. Don't assume or repeat it — gently re-ask about ${label} and let them restate it in their own words.`
      : `The user tapped "${steerNode}" on their progress map — they want to talk about ${label} next. Transition into it warmly, with at most one gentle question.`;
  }

  // ── Pending friend requests (FRIEND-NOTIFY-1) ───────────────────────────────
  // Surfaced conversationally, at most once per "new arrival" — re-surfaced only
  // if a request arrives AFTER the last surfaced timestamp. Skipped entirely for
  // crisis/admin/steer-only turns. The reply text + action card are still gated
  // at the end (after the goal-proposal check) so the two never compete.
  let newPendingFriendRequests: Awaited<ReturnType<typeof getPendingFriendRequests>> = [];
  if (text && !crisisActive && !isAdmin) {
    const pending = await getPendingFriendRequests(userId).catch(() => []);
    const surfacedAt: Date | null = session.friendReqSurfacedAt ?? null;
    newPendingFriendRequests = pending.filter((r) => !surfacedAt || r.createdAt > surfacedAt);
  }
  const friendRequestHint =
    newPendingFriendRequests.length > 0
      ? `The user has ${newPendingFriendRequests.length} pending friend request${newPendingFriendRequests.length > 1 ? "s" : ""} on Charaivati from: ${newPendingFriendRequests
          .map((r) => r.sender.name ?? "someone")
          .join(", ")}. If it fits naturally, gently let them know and offer to show it. Mention this at most once — do not repeat it every turn or force it into the conversation.`
      : "";

  // Dynamic context block — local gets the full sensed-insights summary; cloud
  // gets only the minimal tier-"cloud" composer block (drive name + stage etc.).
  const insightsSummary = summarizeInsights(insights);
  let localDynamicBlock = insightsSummary
    ? `WHAT YOU'VE QUIETLY SENSED SO FAR (internal notes — never recite these to the user):\n${insightsSummary}`
    : "";
  const cloudDynamicBlock = await buildUserContext(userId, {
    tier: "cloud",
    language: session.language,
    stage,
    driveName: insights.driveCandidate.value,
  });

  // UCTX-3: local-tier-only personality tone-steering line. Below the
  // confidence threshold this is "" and PERSONALITY_GUIDANCE is not loaded —
  // no point paying its token cost for an absent signal. Never added to the
  // cloud block.
  const personalityProfileRow = await (db as any).personalityProfile
    .findUnique({ where: { userId } })
    .catch(() => null);
  const personality = personalityProfileRow ? normalizePersonality(personalityProfileRow) : emptyPersonality();
  const personalityLine = summarizePersonalityForComposer(personality, PERSONALITY_COMPOSER_THRESHOLD);
  if (personalityLine) {
    localDynamicBlock = [localDynamicBlock, personalityLine].filter(Boolean).join("\n\n");
  }
  if (friendRequestHint) {
    localDynamicBlock = [localDynamicBlock, friendRequestHint].filter(Boolean).join("\n\n");
  }
  const personalityGuidance = personalityLine
    ? loadSection(CONTEXT_FILE, "PERSONALITY_GUIDANCE")
    : "";

  // Admin mode (PERSONA-1): replaces the stage/method/sensing/personality
  // blocks with the ADMIN_MODE section, plus up to 3 open questions to weave in.
  let adminModeBlock = "";
  if (isAdmin && !crisisActive) {
    adminModeBlock = loadSection(CONTEXT_FILE, "ADMIN_MODE");
    const openQuestions = await getOpenAdminQuestions(3);
    if (openQuestions.length > 0) {
      const lines = openQuestions.map((q, i) => `${i + 1}. ${q.question}${q.topic ? ` (topic: ${q.topic})` : ""}`);
      adminModeBlock = [adminModeBlock, `Open questions from users you could teach me about:\n${lines.join("\n")}`]
        .filter(Boolean)
        .join("\n\n");
    }
  }

  const systemPrompt = buildSystemPrompt(stage, session.language, {
    crisis: crisisActive,
    steerHint,
    rollingSummary,
    dynamicBlock: localDynamicBlock,
    personalityGuidance,
    adminMode: adminModeBlock || undefined,
    siteAwareness: SITE_AWARENESS_LOCAL,
  });
  const cloudSystemPrompt = buildSystemPrompt(stage, session.language, {
    crisis: crisisActive,
    steerHint,
    rollingSummary,
    dynamicBlock: cloudDynamicBlock,
    adminMode: adminModeBlock || undefined,
    siteAwareness: SITE_AWARENESS_CLOUD,
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

  // ── Admin-question queue — file a knowledge-gap/capability-gap question ────
  // for non-admins. Anonymized by design (no userId stored). Rate-capped
  // inside fileAdminQuestion. Two independent signals (FIX-UNKNOWN-CAP-1):
  //  (1) knowledge gap — the user asked for outside opinion/knowledge AND the
  //      reply hedges (original PERSONA-1 signal, unchanged).
  //  (2) capability gap — the reply itself declined to DO something, per
  //      [SECTION: CAPABILITIES]'s "DECLINING WARMLY" wording. This is a
  //      post-reply backstop independent of looksActionShaped/CAPABILITY_GAP_TRIGGERS
  //      so novel out-of-scope asks ("book me a cab", "add a calendar event")
  //      are still logged even when no pre-filter keyword matched.
  if (!isAdmin && text) {
    const isKnowledgeGap = isCapabilityGapCandidate(text) && replyHedges(reply);
    const isActionCapabilityGap = isCapabilityDeclineReply(reply);
    if (isKnowledgeGap || isActionCapabilityGap) {
      fileAdminQuestion(userId, text, insights.driveCandidate.value ?? null).catch((err) =>
        console.error("[listen] fileAdminQuestion failed:", err)
      );
    }
  }

  // ── Background bookkeeping (FIX-OLLAMA-TIMEOUT-1) ───────────────────────────
  // Insights extraction, personality extraction, and fold summarization each
  // cost an extra Ollama prefill (10-50s on this hardware) — none of them may
  // gate the reply. They run via after() once the response has been sent.
  // Offset cadences (insights %4, personality %8≡2, see constants above) mean
  // at most one extraction runs per turn. Results land in the DB before the
  // user's next message in the normal case, so the next turn's `stage`/
  // `insights`/personality reads pick them up — delayed by one turn, never lost.
  const userMsgCount: number = await (db as any).consultMessage.count({
    where: { sessionId: session.id, role: "user" },
  });
  const doInsightsExtraction = !isAdmin && !!text && userMsgCount % EXTRACTION_EVERY === 0;
  const doPersonalityExtraction = !isAdmin && !!text && userMsgCount % PERSONALITY_EVERY === PERSONALITY_OFFSET;
  const shouldFold = windowRows.length > FOLD_THRESHOLD;

  if (doInsightsExtraction || doPersonalityExtraction || shouldFold) {
    const sessionId = session.id;
    const baseInsights = insights;
    const basePersonality = personality;
    const baseRollingSummary = rollingSummary;

    after(async () => {
      try {
        // Fold first so extraction (if any) reads the post-fold window.
        let foldedRows = windowRows;
        if (shouldFold) {
          const toFold = windowRows.slice(0, FOLD_BATCH);
          const foldText = toFold.map((m) => `${m.role}: ${m.content}`).join("\n");
          const merged = await summarizeForFold(baseRollingSummary || null, foldText);
          if (merged !== null) {
            const boundary = toFold[toFold.length - 1].createdAt;
            await (db as any).consultSession.update({
              where: { id: sessionId },
              data: { rollingSummary: merged, foldedThrough: boundary },
            });
            foldedRows = windowRows.slice(FOLD_BATCH);
          }
          // merged === null → fold deferred; retried next eligible turn.
        }

        if (doInsightsExtraction) {
          const conversationText = [
            ...foldedRows.map((m) => `${m.role}: ${m.content}`),
            `user: ${text}`,
            `assistant: ${reply}`,
          ].join("\n");
          const extraction = await runExtraction(baseInsights, conversationText);
          if (extraction) {
            const nextInsights = extraction.insights;
            const nextStage = evaluateStageAdvance(stage, nextInsights, extraction.goalEmerging);
            await (db as any).consultSession.update({
              where: { id: sessionId },
              data: { insights: nextInsights as any, consultStage: nextStage },
            });
          }
        }

        if (doPersonalityExtraction) {
          // Personality extraction looks at a shorter recent window (~12 messages).
          const recentForPersonality = [
            ...foldedRows.slice(-10).map((m) => `${m.role}: ${m.content}`),
            `user: ${text}`,
            `assistant: ${reply}`,
          ].join("\n");
          const personalityDeltas = await runPersonalityExtraction(basePersonality, recentForPersonality);
          if (personalityDeltas) {
            const updatedPersonality = applyPersonalityDeltas(basePersonality, personalityDeltas);
            const data = {
              disc: updatedPersonality.disc as any,
              driveScores: updatedPersonality.driveScores as any,
              sampleCount: updatedPersonality.sampleCount,
              confidence: updatedPersonality.confidence,
              notes: updatedPersonality.notes as any,
            };
            await (db as any).personalityProfile
              .upsert({ where: { userId }, create: { userId, ...data }, update: data })
              .catch((err: unknown) => console.error("[listen] personality profile upsert failed:", err));
          }
        }
      } catch (err) {
        console.error("[listen] background bookkeeping failed:", err);
      }
    });
  }

  const responsePayload: Record<string, unknown> = {
    ok: true,
    reply,
    consultStage: stage,
    crisis: false,
  };

  // ── Goal proposal — stage 4 only, via the shared proposal mechanism ────────
  // Goal candidates flow EXCLUSIVELY through proposals — never stored in insights.
  // Uses the PRE-TURN `stage`/`insights` (this turn's extraction, if any, is
  // backgrounded above) — a stage-4 transition is picked up on the next turn,
  // once the background update has landed.
  if (!isAdmin && stage === 4 && insights.driveCandidate.value) {
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

  // ── Pending friend requests action card (FRIEND-NOTIFY-1) ──────────────────
  // Attached only when there's something NEW to surface, and only if a goal
  // proposal didn't just fire this turn (the two never compete for attention).
  // friendReqSurfacedAt is updated here so the same requests aren't re-surfaced
  // next turn or after a reload — re-surfacing only happens for requests that
  // arrive AFTER this timestamp.
  if (newPendingFriendRequests.length > 0 && !responsePayload.proposal) {
    responsePayload.action = {
      type: "friend_requests_pending",
      requests: newPendingFriendRequests.map((r) => ({ id: r.id, sender: r.sender })),
    };
    await (db as any).consultSession
      .update({ where: { id: session.id }, data: { friendReqSurfacedAt: new Date() } })
      .catch((err: unknown) => console.error("[listen] friendReqSurfacedAt update failed:", err));
  }

  return NextResponse.json(responsePayload);
}

export async function GET(req: Request) {
  const payload = await authenticateChat(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isGuest = payload.role === "guest";

  const session = await (db as any).consultSession.findUnique({
    where: { userId: payload.userId },
  });
  if (!session) {
    return NextResponse.json({
      ok: true,
      consultStage: 0,
      insights: emptyInsights(),
      messages: [],
      crisis: false,
      isGuest,
      loginDeclined: false,
      loginLastAskedAt: null,
      showLoginOffer: isGuest,
    });
  }

  // ACTION-INTENT-5c: a cleared chat must not resurface on reload — only
  // messages after chatResetAt are returned for display.
  const rows: { id: string; role: string; content: string; createdAt: Date }[] = await (db as any).consultMessage.findMany({
    where: { sessionId: session.id, ...(session.chatResetAt ? { createdAt: { gt: session.chatResetAt } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, role: true, content: true, createdAt: true },
  });
  rows.reverse();

  // UCTX-3: surface only the top sensed drive name, gated by confidence — never DISC, never raw scores.
  let personalityTopDrive: string | null = null;
  const personalityRow = await (db as any).personalityProfile.findUnique({ where: { userId: payload.userId } }).catch(() => null);
  if (personalityRow) {
    const personality = normalizePersonality(personalityRow);
    if (personality.confidence >= PERSONALITY_COMPOSER_THRESHOLD) {
      personalityTopDrive = topDriveName(personality);
    }
  }

  // ACTION-INTENT-3: re-offer the login (SecureChatCard) at most once per
  // RELOGIN_OFFER_GAP_MS, and never again once declined.
  const RELOGIN_OFFER_GAP_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
  const loginDeclined: boolean = session.loginDeclined === true;
  const loginLastAskedAt: Date | null = session.loginLastAskedAt ?? null;
  const showLoginOffer =
    isGuest && !loginDeclined && (!loginLastAskedAt || Date.now() - loginLastAskedAt.getTime() > RELOGIN_OFFER_GAP_MS);

  return NextResponse.json({
    ok: true,
    consultStage: session.consultStage ?? 0,
    insights: normalizeInsights(session.insights),
    messages: rows,
    crisis: session.crisisFlag === true,
    personalityTopDrive,
    isGuest,
    loginDeclined,
    loginLastAskedAt,
    showLoginOffer,
  });
}
