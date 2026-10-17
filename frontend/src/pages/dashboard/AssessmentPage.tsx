import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { fetchStudentResumes, type ResumeItem } from "../../api/student";
import {
  generateAssessmentApi,
  fetchAssessmentQuestionsApi,
  submitAssessmentApi,
  type ClientQuestion,
  type Scorecard,
} from "../../api/assessment";

type AssessmentStep = "SELECT" | "GENERATING" | "RUNNER" | "EVALUATING" | "SCORECARD";

export const AssessmentPage: React.FC = () => {
  const { accessToken } = useAuth();

  // State
  const [step, setStep] = useState<AssessmentStep>("SELECT");
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active Assessment State
  const [sessionId, setSessionId] = useState<string>("");
  const [questions, setQuestions] = useState<ClientQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1800);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Scorecard State
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);

  // Timer Ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ---------------------------------------------------------------------------
  // Load Resumes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function loadResumes() {
      if (!accessToken) return;
      setLoadingResumes(true);
      setErrorMsg(null);
      try {
        const data = await fetchStudentResumes(accessToken);
        setResumes(data);
        if (data.length > 0) {
          setSelectedResumeId(data[0].id);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to load resumes");
      } finally {
        setLoadingResumes(false);
      }
    }
    loadResumes();
  }, [accessToken]);

  // ---------------------------------------------------------------------------
  // Timer Management
  // ---------------------------------------------------------------------------
  const handleAutoSubmit = useCallback(async () => {
    if (!accessToken || !sessionId) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setStep("EVALUATING");
    try {
      const res = await submitAssessmentApi(accessToken, sessionId, answers);
      setScorecard(res.scorecard);
      setStep("SCORECARD");
    } catch (err: any) {
      setErrorMsg(err.message || "Evaluation failed. Please try again.");
      setStep("RUNNER");
    }
  }, [accessToken, sessionId, answers]);

  useEffect(() => {
    if (step === "RUNNER") {
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, handleAutoSubmit]);

  // ---------------------------------------------------------------------------
  // Step 1: Start / Generate Assessment
  // ---------------------------------------------------------------------------
  const handleStartAssessment = async () => {
    if (!accessToken || !selectedResumeId) return;
    setErrorMsg(null);
    setStep("GENERATING");

    try {
      const generated = await generateAssessmentApi(accessToken, selectedResumeId);
      setSessionId(generated.sessionId);

      // Fetch questions
      const qData = await fetchAssessmentQuestionsApi(accessToken, generated.sessionId);
      setQuestions(qData.questions);
      setAnswers(qData.savedAnswers || {});
      setRemainingSeconds(qData.remainingSeconds || generated.timeLimit || 1800);
      setCurrentIdx(0);
      setStep("RUNNER");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate assessment. Please try again.");
      setStep("SELECT");
    }
  };

  // ---------------------------------------------------------------------------
  // Answer Update
  // ---------------------------------------------------------------------------
  const handleAnswerChange = (qId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  // ---------------------------------------------------------------------------
  // Step 2: Submit
  // ---------------------------------------------------------------------------
  const handleFinalSubmit = async () => {
    if (!accessToken || !sessionId) return;
    setShowSubmitModal(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setStep("EVALUATING");

    try {
      const res = await submitAssessmentApi(accessToken, sessionId, answers);
      setScorecard(res.scorecard);
      setStep("SCORECARD");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit assessment.");
      setStep("RUNNER");
    }
  };

  // ---------------------------------------------------------------------------
  // Helper calculations
  // ---------------------------------------------------------------------------
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const answeredCount = questions.filter((q) => answers[q.id]?.trim()).length;
  const currentQ = questions[currentIdx];

  // ---------------------------------------------------------------------------
  // RENDER: Screen 1 - Select Resume & Launch
  // ---------------------------------------------------------------------------
  if (step === "SELECT") {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                AI Powered
              </span>
              <span className="text-xs text-slate-400">• Ephemeral Session</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Resume-Based Technical Assessment
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Select an uploaded resume to generate a personalized, timed technical test evaluating your declared skills.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="font-bold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Feature Highlights Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100/80">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold mb-3 shadow-sm shadow-blue-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900">Tailored to Your Stack</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Questions are created in real time based strictly on the technologies extracted from your resume.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50/50 border border-indigo-100/80">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold mb-3 shadow-sm shadow-indigo-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900">30-Minute Timed Runner</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              A balanced mix of MCQs, concise architectural questions, and practical code analysis snippets.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-100/80">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold mb-3 shadow-sm shadow-emerald-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900">AI Detailed Scorecard</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Receive instant skill-by-skill evaluation, specific rubric feedback, and constructive recommendations.
            </p>
          </div>
        </div>

        {/* Resume Selection */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-2">1. Select Target Resume</h2>
          <p className="text-xs text-slate-500 mb-4">
            The assessment will be synthesized specifically targeting the technical skills found in this resume.
          </p>

          {loadingResumes ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading your resumes...</div>
          ) : resumes.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-sm font-semibold text-slate-700">No resumes found</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">Upload a resume first so we can analyze your skills.</p>
              <Link
                to="/dashboard/resume"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition"
              >
                Upload Resume Now
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resumes.map((r) => {
                const isSelected = selectedResumeId === r.id;
                const skills = r.skills || [];
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedResumeId(r.id)}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/40 shadow-sm shadow-blue-500/10 ring-2 ring-blue-500/20"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                            isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">
                            Resume uploaded {new Date(r.createdAt).toLocaleDateString()}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            ID: {r.id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center border text-[10px] ${
                          isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"
                        }`}
                      >
                        {isSelected && "✓"}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-600 mb-1.5">
                        Extracted Skills ({skills.length}):
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {skills.slice(0, 8).map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs"
                          >
                            {s.name}
                          </span>
                        ))}
                        {skills.length > 8 && (
                          <span className="px-1.5 py-0.5 text-[10px] text-slate-400 font-medium">
                            +{skills.length - 8} more
                          </span>
                        )}
                        {skills.length === 0 && (
                          <span className="text-[11px] text-slate-400 italic">No specific skills listed</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Launch Button */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Session is valid for 1 hour. Tests are evaluated server-side.
            </div>
            <button
              disabled={!selectedResumeId || resumes.length === 0}
              onClick={handleStartAssessment}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Generate & Start Assessment</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: Screen 2 - Generating Loading State
  // ---------------------------------------------------------------------------
  if (step === "GENERATING") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-blue-100 animate-ping absolute inset-0 opacity-40"></div>
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white relative shadow-lg shadow-blue-500/30">
            <svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Generating Technical Assessment...
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          Google Gemini is analyzing the skills on your resume and synthesizing a balanced set of MCQs, conceptual questions, and code analysis scenarios.
        </p>
        <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-200/60">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
          <span>Configuring session parameters...</span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: Screen 3 - Evaluating Loading State
  // ---------------------------------------------------------------------------
  if (step === "EVALUATING") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 animate-ping absolute inset-0 opacity-40"></div>
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white relative shadow-lg shadow-emerald-500/30">
            <svg className="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Evaluating Your Assessment...
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          Grading your responses against technical rubrics, verifying code analysis accuracy, and compiling a skill-by-skill scorecard.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: Screen 4 - Timed Assessment Runner
  // ---------------------------------------------------------------------------
  if (step === "RUNNER" && currentQ) {
    const isLast = currentIdx === questions.length - 1;
    const isFirst = currentIdx === 0;
    const progressPercent = Math.round((answeredCount / questions.length) * 100);

    const timerColor =
      remainingSeconds < 180
        ? "text-rose-600 bg-rose-50 border-rose-200 animate-pulse"
        : remainingSeconds < 600
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-slate-700 bg-slate-50 border-slate-200";

    return (
      <div className="space-y-6">
        {/* Top Control Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Timer Clock */}
            <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 font-mono font-bold text-sm ${timerColor}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{formatTime(remainingSeconds)}</span>
            </div>

            {/* Answer Progress */}
            <div>
              <div className="text-xs font-bold text-slate-800">
                Answered {answeredCount} of {questions.length}
              </div>
              <div className="w-32 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Quick Navigator Circles */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id]?.trim();
              const isCurrent = idx === currentIdx;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    isCurrent
                      ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-400"
                      : isAnswered
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition shadow-sm"
          >
            Review & Submit
          </button>
        </div>

        {/* Current Question Box */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 md:p-8 shadow-xs">
          {/* Question Metadata Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                Question {currentIdx + 1} of {questions.length}
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
                {currentQ.skill}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  currentQ.difficulty === "HARD"
                    ? "bg-rose-100 text-rose-700"
                    : currentQ.difficulty === "MEDIUM"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {currentQ.difficulty}
              </span>
            </div>
            <div className="text-xs font-bold text-slate-500">
              {currentQ.maxPoints} Points
            </div>
          </div>

          {/* Question Prompt */}
          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug mb-6 whitespace-pre-line">
            {currentQ.questionText}
          </h3>

          {/* Code Snippet for CODE_ANALYSIS */}
          {currentQ.codeSnippet && (
            <div className="mb-6 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 text-slate-100 p-4 font-mono text-xs shadow-inner">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
                <span>Code Analysis Snippet</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(currentQ.codeSnippet || "")}
                  className="hover:text-white transition"
                >
                  Copy
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre leading-relaxed">{currentQ.codeSnippet}</pre>
            </div>
          )}

          {/* Input Variant: MCQ */}
          {currentQ.type === "MCQ" && currentQ.options && (
            <div className="space-y-3 mb-6">
              {currentQ.options.map((opt) => {
                const isSelected = answers[currentQ.id] === opt.label;
                return (
                  <label
                    key={opt.label}
                    onClick={() => handleAnswerChange(currentQ.id, opt.label)}
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-500"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                        isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {opt.label}
                    </div>
                    <span className="text-sm font-medium text-slate-800 leading-relaxed">
                      {opt.text}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Input Variant: SHORT_ANSWER / CODE_ANALYSIS */}
          {currentQ.type !== "MCQ" && (
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Your Answer / Technical Analysis:
              </label>
              <textarea
                rows={5}
                value={answers[currentQ.id] || ""}
                onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                placeholder={
                  currentQ.type === "CODE_ANALYSIS"
                    ? "Explain the bug, performance issue, or edge cases and propose your solution..."
                    : "Provide a concise explanation (2-4 sentences covering core mechanisms)..."
                }
                className="w-full p-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-hidden text-sm leading-relaxed text-slate-800 font-sans"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
                <span>Answers are evaluated by Gemini AI grader against technical rubrics.</span>
                <span>{(answers[currentQ.id] || "").length} characters</span>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <button
              disabled={isFirst}
              onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span>← Previous</span>
            </button>

            {isLast ? (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold uppercase tracking-wider hover:from-emerald-700 hover:to-teal-700 transition shadow-sm"
              >
                Submit Test
              </button>
            ) : (
              <button
                onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-sm flex items-center gap-2"
              >
                <span>Save & Next →</span>
              </button>
            )}
          </div>
        </div>

        {/* Confirmation Modal */}
        {showSubmitModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-lg font-bold text-slate-900">Ready to Submit?</h3>
              <p className="text-xs text-slate-500 mt-1">
                You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
              </p>

              {answeredCount < questions.length && (
                <div className="my-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>You have unanswered questions. Are you sure you want to finalize now?</span>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition"
                >
                  Return to Test
                </button>
                <button
                  onClick={handleFinalSubmit}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-sm"
                >
                  Confirm & Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: Screen 5 - Comprehensive Scorecard
  // ---------------------------------------------------------------------------
  if (step === "SCORECARD" && scorecard) {
    const gradeColor =
      scorecard.grade.startsWith("A")
        ? "from-emerald-500 to-teal-600 text-white"
        : scorecard.grade.startsWith("B")
        ? "from-blue-500 to-indigo-600 text-white"
        : scorecard.grade.startsWith("C")
        ? "from-amber-500 to-orange-600 text-white"
        : "from-rose-500 to-red-600 text-white";

    return (
      <div className="space-y-6">
        {/* Scorecard Hero Banner */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                Evaluation Complete
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
                Assessment Scorecard
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Completed on {new Date(scorecard.completedAt).toLocaleString()}
              </p>
              <p className="text-sm text-slate-600 mt-3 max-w-xl leading-relaxed">
                {scorecard.summary}
              </p>
            </div>

            {/* Score Ring & Badge */}
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="text-center">
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {scorecard.percentage}%
                </div>
                <div className="text-[11px] font-bold text-slate-500 uppercase mt-0.5">
                  {scorecard.totalPoints} / {scorecard.maxPoints} pts
                </div>
              </div>
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${gradeColor} flex items-center justify-center font-black text-xl shadow-md`}
              >
                {scorecard.grade}
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={() => {
                setStep("SELECT");
                setScorecard(null);
                setQuestions([]);
                setAnswers({});
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
            >
              Take Another Assessment
            </button>
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard/skills"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
              >
                View Skills & Badges →
              </Link>
            </div>
          </div>
        </div>

        {/* Strengths & Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                ✓
              </div>
              <h3 className="text-sm font-bold text-slate-900">Key Strengths</h3>
            </div>
            <ul className="space-y-2">
              {scorecard.strengths.map((str, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Improvements */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                ↗
              </div>
              <h3 className="text-sm font-bold text-slate-900">Areas for Improvement</h3>
            </div>
            <ul className="space-y-2">
              {scorecard.improvements.map((imp, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Skill Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Skill Performance Breakdown</h3>
          <div className="space-y-4">
            {scorecard.skillBreakdown.map((sb, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-slate-800">{sb.skill}</span>
                  <span className="text-slate-500 font-mono">
                    {sb.totalPoints} / {sb.maxPoints} pts ({sb.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      sb.percentage >= 75
                        ? "bg-emerald-500"
                        : sb.percentage >= 50
                        ? "bg-blue-500"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${sb.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Question Review */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Detailed Question Results</h3>
          <div className="space-y-4">
            {scorecard.questionResults.map((q, idx) => {
              const pct = q.maxPoints > 0 ? (q.awardedPoints / q.maxPoints) * 100 : 0;
              return (
                <div key={q.questionId} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        Q{idx + 1}. {q.skill}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 font-mono">
                        {q.type}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        pct >= 80
                          ? "bg-emerald-100 text-emerald-800"
                          : pct >= 50
                          ? "bg-blue-100 text-blue-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {q.awardedPoints} / {q.maxPoints} pts
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    <strong>Feedback:</strong> {q.feedback}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
