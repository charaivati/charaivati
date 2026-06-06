// app/api/business/idea/interview/finalize/route.ts
// POST { ideaId } — produce the final verdict once the interview is complete.
//
// Calls the cloud Assessor for any dimensions not yet senior-reviewed,
// then calls runFinalVerdict() for the overall verdict.
// Persists final scores to BusinessIdea (the 6 numeric dimension fields).
// Returns { scores, overallScore, report, tier, dimProvenance }.
//
// Graceful degradation: if cloud is unavailable the local-fallback verdict
// is used and tier = "local". The ResultsReport labels this clearly.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { runAssessor, runFinalVerdict } from "@/lib/business/runAssessor";
import { DIMENSIONS, type InterviewState, type DimKey } from "@/lib/business/interviewConfig";

const GUEST_COOKIE = "biz-guest";

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

function buildDimTranscript(transcript: any[], dim: string): string {
  return transcript
    .filter((t) => t.role === "user" && t.dim === dim)
    .map((t) => t.content)
    .join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ideaId } = body as { ideaId: string };

    if (!ideaId) {
      return NextResponse.json({ error: "ideaId required" }, { status: 400 });
    }

    const { allowed, idea } = await resolveOwnership(req, ideaId);
    if (!allowed || !idea) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const state: InterviewState = (idea.interviewState as InterviewState) ?? {
      provisionalScores: {},
      assessorScores: {},
      assessorRun: {},
      sector: "general",
      localUnavailable: false,
    } as any;

    const transcript: any[] = (idea.transcript as any[]) ?? [];
    const dimProvenance: Record<string, "local_estimate" | "senior_reviewed"> =
      (idea.dimProvenance as any) ?? {};

    // ── Final Assessor sweep: score any unreviewed dimensions ───────────────

    const finalScores: Record<string, number> = { ...state.provisionalScores };
    const assessorReasons: Record<string, string> = Object.fromEntries(
      Object.entries(state.assessorScores).map(([k, v]) => [k, v.reason])
    );

    if (!state.localUnavailable) {
      for (const dim of DIMENSIONS) {
        if (dimProvenance[dim] === "senior_reviewed") continue;
        const dimTranscript = buildDimTranscript(transcript, dim);
        if (!dimTranscript) continue; // dimension never discussed

        const result = await runAssessor(
          dim as DimKey,
          idea.title,
          idea.description,
          state.sector,
          dimTranscript
        );
        if (result) {
          finalScores[dim] = result.score;
          assessorReasons[dim] = result.reason;
          dimProvenance[dim] = "senior_reviewed";
          state.assessorScores[dim] = result;
        }
      }
    }

    // ── Final overall verdict ───────────────────────────────────────────────

    const verdict = await runFinalVerdict(
      idea.title,
      idea.description,
      finalScores,
      assessorReasons
    );

    // ── Compute overall score ───────────────────────────────────────────────

    const scoreValues = Object.values(finalScores);
    const overallScore =
      scoreValues.length > 0
        ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
        : 0;

    // ── Persist final scores to the 6 BusinessIdea numeric fields ──────────

    await (db as any).businessIdea.update({
      where: { id: ideaId },
      data: {
        problemClarity: finalScores.problemClarity ?? 0,
        marketNeed: finalScores.marketNeed ?? 0,
        targetAudience: finalScores.targetAudience ?? 0,
        uniqueValue: finalScores.uniqueValue ?? 0,
        feasibility: finalScores.feasibility ?? 0,
        monetization: finalScores.monetization ?? 0,
        status: "submitted",
        dimProvenance,
        interviewState: { ...state, provisionalScores: finalScores },
      },
    });

    return NextResponse.json({
      scores: finalScores,
      overallScore,
      report: {
        verdict: verdict.verdict,
        rating: verdict.rating,
        nextSteps: verdict.nextSteps,
      },
      tier: verdict.tier,
      dimProvenance,
    });
  } catch (err) {
    console.error("POST /api/business/idea/interview/finalize", err);
    return NextResponse.json({ error: "Finalize failed" }, { status: 500 });
  }
}
