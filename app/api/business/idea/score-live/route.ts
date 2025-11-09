// app/api/business/idea/score-live/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface Option {
  value: string;
  label: string;
  score?: number;
}

interface Question {
  id: string;
  scoringDim: string;
  type: string;
  options?: Option[];
}

function scoreResponse(question: Question, answer: string): number {
  if (question.type === "select" && question.options) {
    const selectedOption = question.options.find(
      (opt) => opt.value === answer
    );
    if (selectedOption && selectedOption.score !== undefined) {
      return selectedOption.score;
    }
  }

  let score = 0;
  const answerLower = answer.toLowerCase();

  if (answer.length < 20) {
    score = -1;
  } else if (answer.length < 50) {
    score = 0;
  } else if (answer.length < 150) {
    score = 1;
  } else {
    score = 2;
  }

  if (
    /customer|user|market|test|validate|interview|data|research/.test(
      answerLower
    )
  ) {
    score = Math.min(score + 1, 2);
  }

  return score;
}

function calculateDimensionScores(
  scoreMap: Record<string, number>,
  questionMap: Map<string, Question>
): Record<string, number> {
  const dimensions: Record<string, number[]> = {};

  for (const [qId, score] of Object.entries(scoreMap)) {
    const question = questionMap.get(qId);
    if (!question) continue;

    if (!dimensions[question.scoringDim]) {
      dimensions[question.scoringDim] = [];
    }
    dimensions[question.scoringDim].push(score);
  }

  const result: Record<string, number> = {};
  for (const [dim, scores] of Object.entries(dimensions)) {
    result[dim] =
      Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
      10;
  }

  return result;
}

function generateReport(dimensions: Record<string, number>): {
  verdict: string;
  nextSteps: string[];
  rating: number;
} {
  const dims = dimensions;
  const avg =
    Object.values(dims).reduce((a, b) => a + b, 0) /
    Object.keys(dims).length;

  let verdict = "💡 Idea has potential";
  let rating = 2;

  if (avg >= 1.5) {
    verdict = "🚀 Strong idea! Ready to validate and execute";
    rating = 5;
  } else if (avg >= 0.5) {
    verdict = "📈 Promising idea with some execution risks";
    rating = 4;
  } else if (avg >= -0.5) {
    verdict = "🤔 Idea needs refinement - validate with customers first";
    rating = 3;
  } else {
    verdict = "⚠️ Significant challenges - reconsider or pivot";
    rating = 2;
  }

  const nextSteps: string[] = [];
  const sorted = Object.entries(dims).sort((a, b) => a[1] - b[1]);

  for (const [dim, score] of sorted) {
    if (score <= 0) {
      if (dim === "problemClarity") {
        nextSteps.push(
          "🎯 Clarify the problem: Make it more specific with metrics"
        );
      } else if (dim === "marketNeed") {
        nextSteps.push("👥 Validate market: Talk to 5-10 potential customers");
      } else if (dim === "targetAudience") {
        nextSteps.push("🎭 Define audience: Who exactly will use this?");
      } else if (dim === "uniqueValue") {
        nextSteps.push(
          "⭐ Sharpen USP: What makes you different from competitors?"
        );
      } else if (dim === "feasibility") {
        nextSteps.push(
          "🛠️ Build skills or find a co-founder to bridge gaps"
        );
      } else if (dim === "monetization") {
        nextSteps.push(
          "💰 Define pricing: Research competitors and customer willingness to pay"
        );
      }
    }
  }

  for (const [dim, score] of sorted.reverse()) {
    if (score >= 1.5) {
      if (dim === "problemClarity") {
        nextSteps.unshift("✅ Problem is well-defined");
      } else if (dim === "marketNeed") {
        nextSteps.unshift("✅ Market is validated");
      } else if (dim === "uniqueValue") {
        nextSteps.unshift("✅ Strong unique value");
      } else if (dim === "feasibility") {
        nextSteps.unshift("✅ Feasible to build");
      }
    }
  }

  return {
    verdict,
    nextSteps,
    rating,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ideaId, responses } = body;

    if (!ideaId || !responses) {
      return NextResponse.json(
        { error: "ideaId and responses required" },
        { status: 400 }
      );
    }

    // Fetch all questions
    const questions = await prisma.ideaQuestion.findMany();
    const questionMap = new Map(questions.map((q) => [q.id, q as any]));

    const scoreMap: Record<string, number> = {};

    // Score only provided responses
    for (const [questionId, answer] of Object.entries(responses)) {
      const question = questionMap.get(questionId);
      if (!question) continue;

      const score = scoreResponse(question as Question, answer as string);
      scoreMap[questionId] = score;
    }

    // Calculate dimension scores (only from answered questions)
    const dimensionScores = calculateDimensionScores(scoreMap, questionMap);

    // Calculate overall score from available dimensions
    const overallScore =
      Object.values(dimensionScores).length > 0
        ? Object.values(dimensionScores).reduce((a, b) => a + b, 0) /
          Object.keys(dimensionScores).length
        : 0;

    // Generate report
    const report = generateReport(dimensionScores);

    return NextResponse.json({
      scores: dimensionScores,
      overallScore,
      report,
      answeredCount: Object.keys(scoreMap).length,
    });
  } catch (error) {
    console.error("POST /api/business/idea/score-live", error);
    return NextResponse.json(
      { error: "Failed to calculate live score" },
      { status: 500 }
    );
  }
}