// app/api/business/idea/interview/route.ts
// POST { ideaId, userMessage: string | null }
//
// Single-turn handler for the adaptive BIZDOC-3 interview engine.
//
// State machine:
//   1. Load idea + persisted interviewState from DB.
//   2. If userMessage present:
//      a. Score the answer locally (Interviewer).
//      b. If confidence < CONFIDENCE_THRESHOLD and assessor not yet run for this dim:
//         - Run cloud Assessor for this dimension.
//         - Cross-check: if |local - assessor| > DISAGREEMENT_THRESHOLD and probeCount < MAX:
//           push a disagreement probe onto probeQueue.
//      c. Update provisionalScores + dimProvenance.
//      d. Append to transcript.
//   3. Determine next question (probeQueue first, then advance base index).
//   4. Persist updated state to DB.
//   5. Return { question, dim, questionKey, provisional, done, tier }.
//
// Auth: same session-OR-biz-guest ownership guard as other idea routes.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import {
  initInterviewState,
  detectSector,
  getProbesForDim,
  CONFIDENCE_THRESHOLD,
  DISAGREEMENT_THRESHOLD,
  MAX_PROBES_PER_DIM,
  type InterviewState,
  type ConversationTurn,
  type DimKey,
  DIMENSIONS,
} from "@/lib/business/interviewConfig";
import { runInterviewer } from "@/lib/business/runInterviewer";
import { runAssessor } from "@/lib/business/runAssessor";

const GUEST_COOKIE = "biz-guest";

// ─── Ownership guard ──────────────────────────────────────────────────────────

async function resolveOwnership(req: NextRequest, ideaId: string) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifySessionToken(token) : null;
  const sessionUserId = payload?.userId ?? null;
  const guestSessionId = req.cookies.get(GUEST_COOKIE)?.value ?? null;

  const idea = await (db as any).businessIdea.findUnique({
    where: { id: ideaId },
    select: {
      id: true,
      title: true,
      description: true,
      userId: true,
      guestSessionId: true,
      transcript: true,
      interviewState: true,
      dimProvenance: true,
    },
  });

  if (!idea) return { allowed: false, idea: null };

  const owned = idea.userId
    ? idea.userId === sessionUserId
    : !!guestSessionId && idea.guestSessionId === guestSessionId;

  return { allowed: owned, idea };
}

// ─── Question bank loader ─────────────────────────────────────────────────────

interface BaseQuestion {
  id: string;
  order: number;
  text: string;
  type: string;
  scoringDim: string;
  options?: { value: string; label: string; score?: number }[];
}

let cachedQuestions: BaseQuestion[] | null = null;

async function loadBaseQuestions(): Promise<BaseQuestion[]> {
  if (cachedQuestions) return cachedQuestions;
  const rows = await (db as any).ideaQuestion.findMany({
    orderBy: { order: "asc" },
  });
  cachedQuestions = rows.map((r: any) => ({
    ...r,
    options: r.options ? (Array.isArray(r.options) ? r.options : JSON.parse(r.options)) : undefined,
  }));
  return cachedQuestions!;
}

// ─── Helper: dim transcript ───────────────────────────────────────────────────

function buildDimTranscript(
  transcript: ConversationTurn[],
  dim: DimKey
): string {
  const relevant = transcript.filter((t) => t.role === "user" && t.dim === dim);
  return relevant.map((t) => t.content).join("\n");
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ideaId, userMessage } = body as {
      ideaId: string;
      userMessage: string | null;
    };

    if (!ideaId) {
      return NextResponse.json({ error: "ideaId required" }, { status: 400 });
    }

    const { allowed, idea } = await resolveOwnership(req, ideaId);
    if (!allowed || !idea) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const baseQuestions = await loadBaseQuestions();

    // ── Init or resume state ────────────────────────────────────────────────

    let state: InterviewState = idea.interviewState
      ? (idea.interviewState as InterviewState)
      : initInterviewState(detectSector(idea.title, idea.description));

    let transcript: ConversationTurn[] = (idea.transcript as ConversationTurn[]) ?? [];
    let dimProvenance: Record<string, "local_estimate" | "senior_reviewed"> =
      (idea.dimProvenance as Record<string, "local_estimate" | "senior_reviewed">) ?? {};

    // The current question being answered (set before processing userMessage)
    let currentQKey = ""; // will be set from what was last asked
    let currentQDim: DimKey = "problemClarity";
    let currentQText = "";

    // Recover what was last asked by looking at the last assistant turn
    const lastAssistant = [...transcript].reverse().find((t) => t.role === "assistant");
    if (lastAssistant) {
      currentQKey = lastAssistant.questionKey;
      currentQDim = (lastAssistant.dim ?? "problemClarity") as DimKey;
      currentQText = lastAssistant.content;
    }

    let interviewerSource: "local" | "cloud" = "local";

    // ── Process user answer ─────────────────────────────────────────────────

    if (userMessage && lastAssistant) {
      // 1. Run local Interviewer
      const iResult = await runInterviewer(
        currentQDim,
        currentQText,
        userMessage,
        state.sector
      );
      interviewerSource = iResult.source;
      if (iResult.source === "cloud") state.localUnavailable = true;

      // 2. Update provisional score for this dim
      state.provisionalScores[currentQDim] = iResult.score;
      dimProvenance[currentQDim] = "local_estimate";

      // 3. Possibly run cloud Assessor
      const shouldRunAssessor =
        iResult.confidence < CONFIDENCE_THRESHOLD &&
        !state.assessorRun[currentQDim] &&
        !state.localUnavailable; // only call cloud assessor if local is working
      // (If local already fell through to cloud, assessor would be redundant)

      if (shouldRunAssessor) {
        const dimTranscript = buildDimTranscript(
          [
            ...transcript,
            { role: "user", content: userMessage, dim: currentQDim, questionKey: currentQKey },
          ],
          currentQDim
        );
        const assessorResult = await runAssessor(
          currentQDim,
          idea.title,
          idea.description,
          state.sector,
          dimTranscript
        );

        if (assessorResult) {
          state.assessorScores[currentQDim] = assessorResult;
          state.assessorRun[currentQDim] = true;
          dimProvenance[currentQDim] = "senior_reviewed";

          // 4. Cross-check: if big disagreement, queue a probe
          const localScore = state.provisionalScores[currentQDim] ?? 0;
          const diff = Math.abs(localScore - assessorResult.score);
          const probeCountHere = state.probeCount[currentQDim] ?? 0;
          if (diff > DISAGREEMENT_THRESHOLD && probeCountHere < MAX_PROBES_PER_DIM) {
            const probes = getProbesForDim(currentQDim, state.sector).filter(
              (p) =>
                !transcript.some((t) => t.questionKey === p.probeId) &&
                !state.probeQueue.some((q) => q.probeId === p.probeId)
            );
            if (probes.length > 0) {
              state.probeQueue.push({
                probeId: probes[0].probeId,
                dim: currentQDim,
                text: probes[0].text,
              });
            }
          }

          // Use assessor score as the definitive dim score
          state.provisionalScores[currentQDim] = assessorResult.score;
        }
      } else if (
        iResult.followUpNeeded &&
        !state.assessorRun[currentQDim] &&
        (state.probeCount[currentQDim] ?? 0) < MAX_PROBES_PER_DIM
      ) {
        // Local says follow-up needed but assessor isn't triggered — queue a probe
        const usedProbeIds = new Set([
          ...transcript.map((t) => t.questionKey),
          ...state.probeQueue.map((q) => q.probeId),
        ]);
        const probes = getProbesForDim(currentQDim, state.sector).filter(
          (p) => !usedProbeIds.has(p.probeId)
        );
        if (probes.length > 0) {
          state.probeQueue.push({
            probeId: probes[0].probeId,
            dim: currentQDim,
            text: probes[0].text,
          });
        }
      }

      // 5. Append user answer to transcript
      transcript.push({
        role: "user",
        content: userMessage,
        dim: currentQDim,
        questionKey: currentQKey,
      });
    }

    // ── Determine next question ─────────────────────────────────────────────

    let nextQText: string;
    let nextQKey: string;
    let nextQDim: DimKey;
    let done = false;

    // Pop from probe queue first
    const nextProbe = state.probeQueue.shift();
    if (nextProbe) {
      nextQText = nextProbe.text;
      nextQKey = nextProbe.probeId;
      nextQDim = nextProbe.dim;
      state.probeCount[nextQDim] = (state.probeCount[nextQDim] ?? 0) + 1;
    } else if (state.currentIndex < baseQuestions.length) {
      const baseQ = baseQuestions[state.currentIndex];
      nextQText = baseQ.text;
      nextQKey = baseQ.id;
      nextQDim = baseQ.scoringDim as DimKey;
      state.currentIndex += 1;
    } else {
      // All questions answered
      done = true;
      nextQText = "";
      nextQKey = "";
      nextQDim = "problemClarity";
    }

    if (!done) {
      transcript.push({
        role: "assistant",
        content: nextQText,
        dim: nextQDim,
        questionKey: nextQKey,
      });
    }

    state.done = done;

    // ── Build provisional output ────────────────────────────────────────────

    const provisional = {
      scores: { ...state.provisionalScores },
      provenance: { ...dimProvenance },
      assessorReasons: Object.fromEntries(
        Object.entries(state.assessorScores).map(([k, v]) => [k, v.reason])
      ),
    };

    // Compute overall so the sidebar can show it
    const scoreValues = Object.values(provisional.scores);
    const overallScore =
      scoreValues.length > 0
        ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
        : 0;

    // ── Persist ─────────────────────────────────────────────────────────────

    await (db as any).businessIdea.update({
      where: { id: ideaId },
      data: {
        transcript,
        interviewState: state,
        dimProvenance,
      },
    });

    // Determine tier label for this turn
    const tier = state.localUnavailable
      ? "cloud-degraded"
      : assessorFiredThisTurn(state, dimProvenance, currentQDim, userMessage)
      ? "senior"
      : "local";

    return NextResponse.json({
      question: nextQText,
      questionKey: nextQKey,
      dim: nextQDim,
      done,
      provisional: { ...provisional, overallScore },
      tier,
      turnNum: transcript.filter((t) => t.role === "user").length,
    });
  } catch (err) {
    console.error("POST /api/business/idea/interview", err);
    return NextResponse.json({ error: "Interview engine error" }, { status: 500 });
  }
}

function assessorFiredThisTurn(
  state: InterviewState,
  provenance: Record<string, string>,
  lastDim: DimKey,
  userMessage: string | null
): boolean {
  return !!userMessage && provenance[lastDim] === "senior_reviewed";
}
