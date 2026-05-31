"use client";

import { motion } from "framer-motion";

export interface CouncilPosition {
  persona: string;
  name: string;
  emoji: string;
  colorClass: string;
  text: string;
}

export interface StatusStep {
  step: number;
  message: string;
  active: boolean;
}

export interface CouncilResponse {
  positions: CouncilPosition[];
  verdict: string;
  synthesis: string;
  trigger: "auto" | "manual";
  tier: "council";
  _fallback?: boolean;
  _pending?: boolean;
  _statusSteps?: StatusStep[];
}

interface CouncilViewProps extends CouncilResponse {
  onCancel?: () => void;
}

function splitClosingQuestion(text: string): { main: string; question: string | null } {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const last = sentences[sentences.length - 1]?.trim() ?? "";
  if (last.endsWith("?") && sentences.length > 1) {
    return { main: sentences.slice(0, -1).join(" "), question: last };
  }
  return { main: text, question: null };
}

export default function CouncilView({
  positions,
  verdict,
  synthesis,
  _fallback,
  _pending,
  _statusSteps,
  onCancel,
}: CouncilViewProps) {
  const hasStatusSteps = _statusSteps && _statusSteps.length > 0;
  const showHeader = !hasStatusSteps;

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Status steps — shown during streaming and in the completed view as journey record */}
      {hasStatusSteps && (
        <div className="flex flex-col gap-1 mb-0.5">
          {_statusSteps!.map((step) => (
            <motion.p
              key={step.step}
              initial={{ opacity: 0 }}
              animate={{ opacity: step.active ? 1 : 0.4 }}
              transition={{ duration: 0.2 }}
              className={`text-xs leading-snug ${step.active ? "text-gray-300" : "text-gray-600"}`}
            >
              {step.message}
            </motion.p>
          ))}
        </div>
      )}

      {/* Header — only when no status steps (backward-compat for non-streamed responses) */}
      {showHeader && <span className="text-xs text-gray-500">⚖️ Council deliberated</span>}

      {/* Persona cards — animate in as each arrives via stream */}
      {positions.map((pos) => {
        const { main, question } = splitClosingQuestion(pos.text);
        return (
          <motion.div
            key={pos.persona}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl bg-gray-800 px-3 py-2.5"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span>{pos.emoji}</span>
              <span className={`text-xs font-semibold ${pos.colorClass}`}>{pos.name}</span>
            </div>
            <p className="text-sm text-gray-100 leading-relaxed">{main}</p>
            {question && (
              <p className="text-xs text-gray-400 italic mt-1.5">{question}</p>
            )}
          </motion.div>
        );
      })}

      {/* Cancel button — only while pending */}
      {_pending && onCancel && (
        <button
          onClick={onCancel}
          className="text-xs text-gray-600 hover:text-red-400 transition-colors self-start mt-0.5"
        >
          ✕ Cancel
        </button>
      )}

      {/* Verdict + synthesis — appear when streaming completes */}
      {!_pending && (verdict || synthesis) && (
        <>
          <div className="border-t border-gray-700 my-0.5" />

          {verdict && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-xl bg-gray-800 border border-indigo-900/60 px-4 py-3"
            >
              <p className="text-xs text-indigo-400 font-medium mb-1.5">⚖️ The Council's Verdict</p>
              <p className="text-sm text-gray-100 leading-relaxed">{verdict}</p>
            </motion.div>
          )}

          {synthesis && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: verdict ? 0.2 : 0 }}
              className="rounded-xl bg-gray-900 border border-gray-700 px-4 py-3 text-center"
            >
              <p className="text-xs text-gray-500 mb-2">💭 The question behind your question:</p>
              <p className="text-sm text-gray-300 italic leading-relaxed">{synthesis}</p>
            </motion.div>
          )}

          {_fallback && (
            <p className="text-xs text-gray-600 text-right">responded via cloud</p>
          )}
        </>
      )}
    </div>
  );
}
