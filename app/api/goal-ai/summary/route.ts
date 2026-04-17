// app/api/goal-ai/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { chatComplete, safeJsonParse } from '@/app/api/aiClient';
import { buildSummaryPrompt } from '@/lib/ai/goalPrompts';
import type { GoalSummary } from '@/app/(with-nav)/self/tabs/goal-creation/flow-config/types';

export async function POST(req: NextRequest) {
  const { archetype, mode, answers, detectedFlags } = await req.json();

  try {
    const content = await chatComplete({
      model: process.env.GOAL_AI_SUMMARY_MODEL ?? 'openai/gpt-4o-mini',
      messages: buildSummaryPrompt({ archetype, mode, answers, detectedFlags: detectedFlags ?? [] }),
      maxTokens: 600,
      temperature: 0.4,
      jsonMode: true,
    });

    const parsed = safeJsonParse<GoalSummary>(content);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error('[goal-ai/summary]', e);
    // Fallback: build minimal summary from raw answers
    return NextResponse.json({
      title: answers?.[0]?.answer?.slice(0, 80) ?? 'Untitled goal',
      whyNow: '',
      commitment: '',
      successSignal: '',
      riskFlags: detectedFlags ?? [],
    } satisfies GoalSummary);
  }
}
