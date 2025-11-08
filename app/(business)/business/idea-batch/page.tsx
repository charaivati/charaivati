// app/business/idea-batch/page.tsx
"use client";

import { useState, useEffect } from "react";
import ResultsReport from "@/components/business/ResultsReport";
import StartScreenBatch from "@/components/business/StartScreenBatch";
import CollapsibleQuestionCard from "@/components/business/CollapsibleQuestionCard";

interface Question {
  id: string;
  order: number;
  text: string;
  type: string;
  category?: string;
  options?: Array<{ value: string; label: string; score?: number }>;
  helpText?: string;
  examples?: string;
  randomizeOptions?: boolean;
}

interface IdeaState {
  ideaId: string | null;
  title: string;
  description: string;
  email: string;
  phone: string;
  responses: Record<string, string>;
  scores: Record<string, number>;
  overallScore: number;
  report: any;
  loading: boolean;
  submitted: boolean;
  error?: string;
}

export default function IdeaBatchPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [state, setState] = useState<IdeaState>({
    ideaId: null,
    title: "",
    description: "",
    email: "",
    phone: "",
    responses: {},
    scores: {},
    overallScore: 0,
    report: null,
    loading: false,
    submitted: false,
  });

  // Fetch questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setQuestionsLoading(true);
        const res = await fetch("/api/business/questions");
        if (!res.ok) throw new Error("Failed to fetch questions");

        const data = await res.json();

        // Parse options if they're JSON strings
        const parsedQuestions = data.map((q: any) => ({
          ...q,
          options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
        }));

        setQuestions(parsedQuestions);
        // Auto-expand first question
        if (parsedQuestions.length > 0) {
          setExpandedQuestion(parsedQuestions[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch questions:", error);
        setState((prev) => ({
          ...prev,
          error: "Failed to load questions. Please refresh the page.",
        }));
      } finally {
        setQuestionsLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  // Auto-save responses
  useEffect(() => {
    if (state.ideaId && Object.keys(state.responses).length > 0) {
      const timeout = setTimeout(async () => {
        try {
          await fetch("/api/business/idea", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ideaId: state.ideaId,
              responses: state.responses,
            }),
          });
        } catch (error) {
          console.error("Failed to auto-save:", error);
        }
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [state.responses, state.ideaId]);

  const handleStartIdea = async (
    title: string,
    description: string,
    email: string,
    phone: string
  ) => {
    setState((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch("/api/business/idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          userEmail: email,
          userPhone: phone,
        }),
      });

      if (!res.ok) throw new Error("Failed to create idea");

      const idea = await res.json();
      setState((prev) => ({
        ...prev,
        ideaId: idea.id,
        title,
        description,
        email,
        phone,
        loading: false,
      }));
    } catch (error) {
      console.error("Error:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to start validation. Please try again.",
      }));
    }
  };

  const handleAnswerQuestion = (questionId: string, answer: string) => {
    setState((prev) => ({
      ...prev,
      responses: {
        ...prev.responses,
        [questionId]: answer,
      },
    }));
  };

  const handleNextQuestion = (fromQuestionId?: string) => {
    const currentQuestionIndex = questions.findIndex(
      (q) => q.id === (fromQuestionId ?? expandedQuestion)
    );
    const nextQuestion = questions[currentQuestionIndex + 1];

    if (nextQuestion) {
      setExpandedQuestion(nextQuestion.id);
    } else {
      // If no next question, collapse all
      setExpandedQuestion(null);
    }
  };

  const submitResponses = async () => {
    setState((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await fetch("/api/business/idea/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaId: state.ideaId,
          responses: state.responses,
        }),
      });

      if (!res.ok) throw new Error("Failed to score idea");

      const { scores, overallScore, report } = await res.json();
      setState((prev) => ({
        ...prev,
        scores,
        overallScore,
        report,
        submitted: true,
        loading: false,
      }));
    } catch (error) {
      console.error("Error:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to generate report. Please try again.",
      }));
    }
  };

  // Loading state
  if (questionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Loading questions...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Start screen
  if (!state.ideaId) {
    return (
      <StartScreenBatch
        onStart={handleStartIdea}
        loading={state.loading}
        error={state.error}
      />
    );
  }

  // Results screen
  if (state.submitted) {
    return (
      <ResultsReport
        title={state.title}
        description={state.description}
        scores={state.scores}
        overallScore={state.overallScore}
        report={state.report}
        ideaId={state.ideaId}
      />
    );
  }

  // All questions on one page
  const answeredCount = Object.keys(state.responses).length;
  const totalQuestions = questions.length;
  const allAnswered = answeredCount === totalQuestions;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Validate Your Idea
          </h1>
          <p className="text-slate-400">
            Answer all questions below. You can edit your answers anytime.
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-300">Progress</span>
            <span className="text-purple-400 font-bold">
              {answeredCount}/{totalQuestions}
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(answeredCount / totalQuestions) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Error message */}
        {state.error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
            {state.error}
          </div>
        )}

        {/* Questions List - Only show answered questions + current expanded */}
        <div className="space-y-3 mb-8">
          {questions.map((question) => {
            const isAnswered = !!state.responses[question.id];
            const isExpanded = expandedQuestion === question.id;

            // Show: answered questions OR current expanded question
            if (!isAnswered && !isExpanded) {
              return null;
            }

            return (
              <CollapsibleQuestionCard
                key={question.id}
                question={question}
                answer={state.responses[question.id] || ""}
                onAnswerChange={(answer) => {
                  handleAnswerQuestion(question.id, answer);
                }}
                isExpanded={isExpanded}
                onToggleExpand={() =>
                  setExpandedQuestion(isExpanded ? null : question.id)
                }
                isAnswered={isAnswered}
                onNext={() => handleNextQuestion(question.id)} // <-- pass handler
              />
            );
          })}
        </div>

        {/* Submit Button */}
        <div className="sticky bottom-4 flex gap-4">
          <button
            onClick={() => setExpandedQuestion(null)}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition"
          >
            Collapse All
          </button>
          <button
            onClick={submitResponses}
            disabled={!allAnswered || state.loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition"
          >
            {state.loading
              ? "Generating Report..."
              : allAnswered
              ? "✨ See Your Results"
              : `Answer all questions (${answeredCount}/${totalQuestions})`}
          </button>
        </div>
      </div>
    </div>
  );
}
