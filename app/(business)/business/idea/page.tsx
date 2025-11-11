"use client";

import React, { useEffect, useRef, useState } from "react";
import ResultsReport from "@/components/business/ResultsReport";
import StartScreenBatch from "@/components/business/StartScreenBatch";
import CollapsibleQuestionCard from "@/components/business/CollapsibleQuestionCard";
import LiveScoreDashboard from "@/components/business/LiveScoreDashboard";

/* -------------------- Types (renamed to avoid collisions) -------------------- */

interface BusinessOption {
  id?: string;
  value: string;
  label: string;
  score?: number;
  nextQuestionId?: string;
}

interface BusinessQuestion {
  id: string;
  order: number;
  text: string;
  type: string;
  category?: string;
  options?: BusinessOption[]; // optional, never null
  helpText?: string;
  examples?: string;
  randomizeOptions?: boolean;
}

interface LiveScore {
  scores: Record<string, number>;
  overallScore: number;
  report: any;
  answeredCount: number;
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

/* -------------------- Component -------------------- */

export default function IdeaBatchPage(): React.ReactElement {
  const [allQuestions, setAllQuestions] = useState<BusinessQuestion[]>([]);
  const [visibleQuestions, setVisibleQuestions] = useState<BusinessQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState<boolean>(true);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const autoStartedRef = useRef<boolean>(false);
  const [enableAutoScroll, setEnableAutoScroll] = useState<boolean>(false);

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

  const [liveScore, setLiveScore] = useState<LiveScore>({
    scores: {},
    overallScore: 0,
    report: null,
    answeredCount: 0,
  });

  const questionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const scoringTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /* -------------------- Fetch questions -------------------- */
  useEffect(() => {
    let alive = true;
    const fetchQuestions = async () => {
      try {
        setQuestionsLoading(true);
        const res = await fetch("/api/business/questions");
        if (!res.ok) throw new Error("Failed to fetch questions");

        const data: unknown = await res.json();

        const parsedQuestions: BusinessQuestion[] = (Array.isArray(data) ? data : []).map((q: any) => ({
          ...q,
          options:
            typeof q.options === "string"
              ? (JSON.parse(q.options) as BusinessOption[])
              : (q.options as BusinessOption[] | undefined),
        }));

        if (!alive) return;
        setAllQuestions(parsedQuestions);

        if (parsedQuestions.length > 0) {
          setExpandedQuestion(parsedQuestions[0].id);
          setVisibleQuestions([parsedQuestions[0]]);
          setEnableAutoScroll(false);
        }
      } catch (error) {
        console.error("Failed to fetch questions:", error);
        setState((prev) => ({
          ...prev,
          error: "Failed to load questions. Please refresh the page.",
        }));
      } finally {
        if (alive) setQuestionsLoading(false);
      }
    };

    fetchQuestions();
    return () => {
      alive = false;
    };
  }, []);

  /* -------------------- Auto-create idea (optional) -------------------- */
  useEffect(() => {
    if (questionsLoading || autoStartedRef.current) return;

    autoStartedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/business/idea", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Student",
            description: "Testing my idea",
            userEmail: "test@charaivati.com",
            userPhone: "",
          }),
        });

        if (!res.ok) {
          console.error("Auto-start create idea failed:", res.status);
          return;
        }

        const idea = await res.json();
        setState((prev) => ({
          ...prev,
          ideaId: idea.id,
          title: "Student",
          description: "Testing my idea",
          email: "test@charaivati.com",
          phone: "",
        }));
      } catch (error) {
        console.error("Error auto-starting:", error);
      }
    })();
  }, [questionsLoading]);

  /* ==================== BRANCHING LOGIC ====================
     Build visibleQuestions from allQuestions + state.responses
  */
  useEffect(() => {
    const calculateVisibleQuestions = (): BusinessQuestion[] => {
      if (allQuestions.length === 0) return [];

      const visible: BusinessQuestion[] = [];
      const visited = new Set<string>();

      // Track by index to avoid undefined currentQ
      let currentIndex = 0;

      // Safety guard to prevent infinite loops if graph has a cycle
      const MAX_ITER = Math.max(10000, allQuestions.length * 10);
      let iter = 0;

      while (currentIndex >= 0 && currentIndex < allQuestions.length) {
        if (++iter > MAX_ITER) {
          console.warn("Branch calculation stopped: iteration limit reached");
          break;
        }

        const currentQ: BusinessQuestion = allQuestions[currentIndex];

        if (visited.has(currentQ.id)) {
          // cycle detected — exit gracefully
          break;
        }
        visited.add(currentQ.id);

        visible.push(currentQ);

        const answer: string | undefined = state.responses[currentQ.id];

        // If not answered yet, stop the path here
        if (!answer) break;

        // Look for option matching the saved answer
        const selectedOption = currentQ.options?.find((opt) => opt.value === answer);

        if (selectedOption?.nextQuestionId) {
          // Jump to branched question; find its index
          const nextIndex = allQuestions.findIndex((q) => q.id === selectedOption.nextQuestionId);
          if (nextIndex === -1) {
            // Branch points to unknown question — stop gracefully
            break;
          }
          currentIndex = nextIndex;
        } else {
          // Default: next by order (sequential)
          currentIndex = currentIndex + 1;
        }
      }

      return visible;
    };

    setVisibleQuestions(calculateVisibleQuestions());
  }, [state.responses, allQuestions]);

  /* -------------------- Scroll expanded question to top -------------------- */
  useEffect(() => {
    if (!expandedQuestion || !enableAutoScroll) return;

    const scrollToQuestionTop = () => {
      const el = questionRefs.current.get(expandedQuestion);
      if (!el) return;

      try {
        const rect = el.getBoundingClientRect();
        const absoluteY = window.scrollY + rect.top - 5;
        window.scrollTo({ top: absoluteY, behavior: "smooth" });
      } catch (err) {
        // ignore
      }
    };

    const t = setTimeout(scrollToQuestionTop, 50);
    return () => clearTimeout(t);
  }, [expandedQuestion, enableAutoScroll]);

  /* -------------------- Live scoring (debounced) -------------------- */
  useEffect(() => {
    if (!state.ideaId || Object.keys(state.responses).length === 0) {
      setLiveScore({
        scores: {},
        overallScore: 0,
        report: null,
        answeredCount: 0,
      });
      return;
    }

    if (scoringTimeoutRef.current) {
      clearTimeout(scoringTimeoutRef.current);
    }

    scoringTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/business/idea/score-live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ideaId: state.ideaId,
            responses: state.responses,
          }),
        });

        if (!res.ok) {
          console.error("Failed to fetch live score:", res.status);
          return;
        }

        const data: {
          scores: Record<string, number>;
          overallScore: number;
          report: any;
          answeredCount: number;
        } = await res.json();

        setLiveScore({
          scores: data.scores,
          overallScore: data.overallScore,
          report: data.report,
          answeredCount: data.answeredCount,
        });
      } catch (error) {
        console.error("Failed to calculate live score:", error);
      }
    }, 500);

    return () => {
      if (scoringTimeoutRef.current) {
        clearTimeout(scoringTimeoutRef.current);
      }
    };
  }, [state.responses, state.ideaId]);

  /* -------------------- Auto-save responses -------------------- */
  useEffect(() => {
    if (!state.ideaId) return;
    if (Object.keys(state.responses).length === 0) return;

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
  }, [state.responses, state.ideaId]);

  /* -------------------- Handlers -------------------- */

  const handleStartIdea = async (
    title: string,
    description: string,
    email: string,
    phone: string
  ): Promise<void> => {
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

  const handleAnswerQuestion = (questionId: string, answer: string): void => {
    setState((prev) => ({
      ...prev,
      responses: {
        ...prev.responses,
        [questionId]: answer,
      },
    }));
  };

  const handleNextQuestion = (): void => {
    const currentIndex = visibleQuestions.findIndex((q) => q.id === expandedQuestion);
    const nextQuestion = visibleQuestions[currentIndex + 1];

    // Enable auto-scroll now that the user explicitly moved forward
    setEnableAutoScroll(true);

    if (nextQuestion) {
      setExpandedQuestion(nextQuestion.id);
    } else {
      setExpandedQuestion(null);
    }
  };

  const submitResponses = async (): Promise<void> => {
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

  /* -------------------- Render -------------------- */

  if (questionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Loading questions...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto" />
        </div>
      </div>
    );
  }

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

  const answeredCount = Object.keys(state.responses).length;
  const totalQuestions = visibleQuestions.length;
  const allAnswered = answeredCount === totalQuestions && totalQuestions > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Validate Your Idea</h1>
            <p className="text-slate-400">
              Answer all questions below. Your path adapts based on your answers.
            </p>
          </div>

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
                  width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {state.error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
              {state.error}
            </div>
          )}

          <div className="space-y-3 mb-8">
            {visibleQuestions.map((question) => {
              const isAnswered = !!state.responses[question.id];
              const isExpanded = expandedQuestion === question.id;

              if (!isAnswered && !isExpanded) return null;

              return (
                <div
                  key={question.id}
                  ref={(el) => {
                    if (el) questionRefs.current.set(question.id, el);
                    else questionRefs.current.delete(question.id);
                  }}
                >
                  <CollapsibleQuestionCard
                    question={question}
                    answer={state.responses[question.id] || ""}
                    onAnswerChange={(answer) => handleAnswerQuestion(question.id, answer)}
                    isExpanded={isExpanded}
                    onToggleExpand={() => setExpandedQuestion(isExpanded ? null : question.id)}
                    isAnswered={isAnswered}
                    onNext={handleNextQuestion}
                  />
                </div>
              );
            })}
          </div>

          {allAnswered && (
            <button
              onClick={submitResponses}
              disabled={state.loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 transition"
            >
              {state.loading ? "Generating Report..." : "Get Results"}
            </button>
          )}
        </div>

        <div className="lg:col-span-1">
          <LiveScoreDashboard
            scores={liveScore.scores}
            overallScore={liveScore.overallScore}
            report={liveScore.report}
            answeredCount={liveScore.answeredCount}
            totalQuestions={totalQuestions}
          />
        </div>
      </div>
    </div>
  );
}
