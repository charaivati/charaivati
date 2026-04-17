// app/api/goal-ai/refine/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { chatComplete, safeJsonParse } from '@/app/api/aiClient';
import { buildRefinePrompt } from '@/lib/ai/goalPrompts';

export async function POST(req: NextRequest) {
  const { archetype, mode, questionText, answer, hasAlreadyRefined } = await req.json();

  // Only refine once per question — never loop
  if (hasAlreadyRefined) {
    return NextResponse.json({ needsRefinement: false, subQuestion: null, reason: 'Already refined once' });
  }

  try {
    const content = await chatComplete({
      model: process.env.GOAL_AI_REFINE_MODEL ?? 'openai/gpt-4o-mini',
      messages: buildRefinePrompt({ archetype, mode, questionText, answer }),
      maxTokens: 200,
      temperature: 0.3,
      jsonMode: true,
    });

    const parsed = safeJsonParse<{ needsRefinement: boolean; subQuestion: string | null; reason: string }>(content);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error('[goal-ai/refine]', e);
    return NextResponse.json({ needsRefinement: false, subQuestion: null, reason: 'error' });
  }
}
