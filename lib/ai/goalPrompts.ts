// lib/ai/goalPrompts.ts — centralised prompt templates for goal-creation AI routes

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

// ─── Reflect ──────────────────────────────────────────────────────────────────

type ReflectArgs = {
  archetype: string;
  mode: string;
  questionText: string;
  answer: string;
  priorAnswers: { questionText: string; answer: string }[];
  nextQuestionText?: string;
};

export function buildReflectPrompt({ archetype, mode, questionText, answer, priorAnswers, nextQuestionText }: ReflectArgs): ChatMessage[] {
  const system = `You are helping a user clarify a personal goal.

Return strict JSON only:
{ "reflection": string | null, "suggestedPlaceholder": string | null, "suggestions": string[] | null }

reflection: Compress what the user just said — 1 to 2 short sentences.
- Surface what is implicit. E.g. "So this is career-leverage learning, not general curiosity."
- Use their own language. Do NOT validate or praise. Do NOT ask a question.
- Set to null if answer is too vague to compress meaningfully.

suggestedPlaceholder: A brief personalized example for the NEXT question, grounded in the user's specific context. Under 15 words. Must start with "e.g.". Only set this if nextQuestionText is provided, otherwise null.

suggestions: 2–3 short clickable options for the NEXT question when it asks about: who the target audience is, what specific domain/area to focus on, what problem to solve, or what to build. Each option must be under 6 words, concrete, and specific to what the user has already shared. Return null (not an empty array) if the next question doesn't benefit from predefined options, or if nextQuestionText is not provided.`;

  const context = priorAnswers.length
    ? `\nPrior context:\n${priorAnswers.map(p => `Q: ${p.questionText}\nA: ${p.answer}`).join('\n')}\n`
    : '';

  const user = `Archetype: ${archetype}
Mode: ${mode}${context}
Question asked: ${questionText}
User's answer: ${answer}${nextQuestionText ? `\nNext question: ${nextQuestionText}` : ''}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// ─── Refine ───────────────────────────────────────────────────────────────────

type RefineArgs = {
  archetype: string;
  mode: string;
  questionText: string;
  answer: string;
};

export function buildRefinePrompt({ archetype, mode, questionText, answer }: RefineArgs): ChatMessage[] {
  const system = `Decide if the user's answer to this goal-setting question is specific enough to build on, or if it needs one clarifying sub-question.

Return strict JSON only: { "needsRefinement": boolean, "subQuestion": string | null, "reason": string }

Criteria for needsRefinement = true:
- Answer is under 5 words AND question is open-ended
- Answer uses generic terms like "stuff", "things", "better", "more"
- For "what are you learning/building" questions: answer names a broad domain without specifying the slice (e.g. "AI", "a startup")
- For "why now" questions: no real trigger stated

Criteria for needsRefinement = false (DEFAULT):
- Answer is specific, even if short
- Answer is an enum/select choice

The sub-question, if generated:
- One sentence
- Offers 2-3 concrete directions where useful
- Does NOT repeat the original question

Example:
Question: "What specifically do you want to learn?"
Answer: "AI"
Output: {"needsRefinement": true, "subQuestion": "Which part — building with LLMs, the underlying math, or the research side?", "reason": "Broad domain named"}`;

  const user = `Archetype: ${archetype}
Mode: ${mode}
Question: ${questionText}
Answer: ${answer}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// ─── Summary ──────────────────────────────────────────────────────────────────

type SummaryArgs = {
  archetype: string;
  mode: string;
  answers: { questionKey: string; questionText: string; answer: string }[];
  detectedFlags: { type: string; severity: string; message: string }[];
};

export function buildSummaryPrompt({ archetype, mode, answers, detectedFlags }: SummaryArgs): ChatMessage[] {
  const system = `You just guided a user through a goal-setting flow. Generate a structured goal card from their answers.

Return strict JSON only:
{
  "title": string,
  "whyNow": string,
  "commitment": string,
  "successSignal": string,
  "riskFlags": [{ "type": string, "severity": "info"|"warn", "message": string }]
}

Field notes:
- title: One line, under 80 chars, from their perspective
- whyNow: 1 sentence, the trigger
- commitment: Extract from answers, e.g. "3 hrs/week" or "daily for 30 min"
- successSignal: 1 sentence — how they'll know it's working

Rules for riskFlags (combine with the detectedFlags passed in):
- Flag if success criteria are vague ("I'll just know")
- Flag if time commitment is under 2 hours/week for Zoomed-out archetypes
- Flag if Build has no named first user/audience
- Flag if Connect has no named action, only sentiment
- Do NOT invent flags beyond what the answers support
- Keep flag messages to one sentence, actionable`;

  const user = `Archetype: ${archetype}
Mode: ${mode}
Answers:
${answers.map(a => `[${a.questionKey}] ${a.questionText}\n→ ${a.answer}`).join('\n\n')}

Pre-detected flags: ${JSON.stringify(detectedFlags)}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
