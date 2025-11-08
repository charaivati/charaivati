// app/business/idea/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QuestionCard from "@/components/business/QuestionCard";
import ResultsReport from "@/components/business/ResultsReport";
import StartScreen from "@/components/business/StartScreen";

interface Question {
  id: string;
  order: number;
  text: string;
  type: string;
  category: string;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
  examples?: string;
}

interface IdeaState {
  ideaId: string | null;
  title: string;
  description: string;
  email: string;
  phone: string;
  currentStep: number;
  responses: Record<string, string>;
  scores: Record<string, number>;
  overallScore: number;
  report: any;
  loading: boolean;
}

export default function IdeaValidationPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [state, setState] = useState<IdeaState>({
    ideaId: null,
    title: "",
    description: "",
    email: "",
    phone: "",
    currentStep: 0,
    responses: {},
    scores: {},
    overallScore: 0,
    report: null,
    loading: false,
  });

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch("/api/business/questions");
        const data = await res.json();
        setQuestions(data);
      } catch (error) {
        console.error("Failed to fetch questions:", error);
      }
    };

    fetchQuestions();
  }, []);

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
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [state.responses, state.ideaId]);

  const handleStartIdea = async (
    title: string,
    description: string,
    email: string,
    phone: string
  ) => {
    setState((prev) => ({ ...prev, loading: true }));
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
        currentStep: 1,
        loading: false,
      }));
    } catch (error) {
      console.error("Error:", error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleAnswerQuestion = (answer: string) => {
    const currentQuestion = questions[state.currentStep - 1];
    setState((prev) => ({
      ...prev,
      responses: {
        ...prev.responses,
        [currentQuestion.id]: answer,
      },
    }));
  };

  const handleNextQuestion = () => {
    if (state.currentStep < questions.length) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }));
    } else if (state.currentStep === questions.length) {
      submitResponses();
    }
  };

  const handlePreviousQuestion = () => {
    if (state.currentStep > 0) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const submitResponses = async () => {
    setState((prev) => ({ ...prev, loading: true }));
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
        currentStep: questions.length + 1,
        loading: false,
      }));
    } catch (error) {
      console.error("Error:", error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  if (state.currentStep === 0) {
    return <StartScreen onStart={handleStartIdea} loading={state.loading} />;
  }

  if (state.currentStep > 0 && state.currentStep <= questions.length) {
    const currentQuestion = questions[state.currentStep - 1];
    const currentAnswer = state.responses[currentQuestion.id] || "";
    const isAnswered = currentAnswer.trim() !== "";

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">
                Question {state.currentStep} of {questions.length}
              </span>
              <span className="text-sm text-purple-400">
                {Math.round((state.currentStep / questions.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(state.currentStep / questions.length) * 100}%`,
                }}
              />
            </div>
          </div>

          <QuestionCard
            question={currentQuestion}
            answer={currentAnswer}
            onAnswerChange={handleAnswerQuestion}
          />

          <div className="flex gap-4 mt-8">
            <button
              onClick={handlePreviousQuestion}
              disabled={state.currentStep === 1}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition"
            >
              ← Back
            </button>
            <button
              onClick={handleNextQuestion}
              disabled={!isAnswered || state.loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition"
            >
              {state.loading
                ? "Saving..."
                : state.currentStep === questions.length
                  ? "See Results"
                  : "Next →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.currentStep > questions.length) {
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

  return null;
}