// app/api/goal-ai/reflect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { chatComplete } from '@/app/api/aiClient';
import { buildReflectPrompt } from '@/lib/ai/goalPrompts';

export async function POST(req: NextRequest) {
  const { archetype, mode, questionText, answer, priorAnswers, nextQuestionText } = await req.json();

  try {
    const content = await chatComplete({
      model: process.env.GOAL_AI_REFLECT_MODEL ?? 'openai/gpt-4o-mini',
      messages: buildReflectPrompt({ archetype, mode, questionText, answer, priorAnswers: priorAnswers ?? [], nextQuestionText }),
      maxTokens: 200,
      temperature: 0.4,
      jsonMode: true,
    });

    let parsed: { reflection?: string | null; suggestedPlaceholder?: string | null; suggestions?: string[] | null } = {};
    try { parsed = JSON.parse(content.trim()); } catch { /* malformed — use defaults */ }

    const reflection = parsed.reflection ?? null;
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [];
    return NextResponse.json({
      reflection,
      vague: !reflection,
      suggestedPlaceholder: parsed.suggestedPlaceholder ?? null,
      suggestions,
    });
  } catch (e) {
    console.error('[goal-ai/reflect]', e);
    return NextResponse.json({ reflection: null, vague: false, suggestedPlaceholder: null, suggestions: [] });
  }
}
