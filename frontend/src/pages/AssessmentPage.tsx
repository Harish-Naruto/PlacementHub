import React, { useState } from 'react';
import { useAssessment } from '../hooks/useAssessment';
import { ResumeSelectScreen, ResumePreviewScreen } from '../components/ResumeScreens';
import { Timer, QuestionNav, QuestionCard } from '../components/AssessmentComponents';
import { ResultsScreen } from '../components/ResultsScreen';
import { Button, LoadingSpinner } from '../components/ui';

// ---------------------------------------------------------------------------
// Generating / loading overlay
// ---------------------------------------------------------------------------

const GeneratingScreen: React.FC = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="relative">
            <div className="w-20 h-20 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
            <div
                className="absolute inset-2 w-16 h-16 border-2 border-violet-300/10 border-t-violet-300/40 rounded-full animate-spin"
                style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
            />
        </div>
        <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">Generating Your Assessment</h2>
            <p className="text-gray-400 text-sm max-w-sm">
                Gemini is analysing the resume and crafting personalised questions. This usually takes
                seconds…
            </p>
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// Submitting overlay
// ---------------------------------------------------------------------------

const SubmittingScreen: React.FC = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <LoadingSpinner size="lg" label="Evaluating your answers with AI. Please wait…" />
        <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">Evaluating Answers</h2>
            <p className="text-gray-400 text-sm max-w-sm">
                Gemini is reviewing your written answers against the answer key. This usually takes
                a few seconds.
            </p>
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// Error screen
// ---------------------------------------------------------------------------

interface ErrorScreenProps {
    message: string;
    onRetry: () => void;
    onBack?: () => void;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({ message, onRetry, onBack }) => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl">
            ⚠
        </div>
        <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
        <p className="text-gray-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            {message}
        </p>
        <div className="flex gap-3 mt-2">
            <Button id="retry-btn" onClick={onRetry} variant="primary" size="md">
                Try Again
            </Button>
            {onBack && (
                <Button id="back-resume-btn" onClick={onBack} variant="secondary" size="md">
                    Back to Resume
                </Button>
            )}
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// Assessment attempt screen
// ---------------------------------------------------------------------------

interface AssessmentAttemptProps {
    state: ReturnType<typeof useAssessment>['state'];
    setAnswer: (qId: string, answer: string) => void;
    handleSubmit: () => void;
}

const AssessmentAttemptScreen: React.FC<AssessmentAttemptProps> = ({
    state,
    setAnswer,
    handleSubmit,
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const { questions, answers, timeLeftSeconds } = state;
    const current = questions[currentIndex];
    const answeredCount = Object.keys(answers).length;

    if (!current) return null;

    return (
        <div className="max-w-3xl mx-auto">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                    <h2 className="text-lg font-bold text-white">AI Skill Assessment</h2>
                    <p className="text-xs text-gray-500">
                        {answeredCount}/{questions.length} answered
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Timer seconds={timeLeftSeconds} />
                    <Button
                        id="submit-assessment-btn"
                        onClick={handleSubmit}
                        size="sm"
                        variant="primary"
                    >
                        Submit
                    </Button>
                </div>
            </div>

            {/* Progress */}
            <div className="w-full bg-white/5 rounded-full h-1 mb-5 overflow-hidden">
                <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-300"
                    style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                />
            </div>

            {/* Navigator */}
            <div className="mb-5">
                <QuestionNav
                    questions={questions}
                    answers={answers}
                    currentIndex={currentIndex}
                    onNavigate={setCurrentIndex}
                />
            </div>

            {/* Question */}
            <QuestionCard
                question={current}
                questionNumber={currentIndex + 1}
                totalQuestions={questions.length}
                answer={answers[current.id] ?? ''}
                onAnswer={(a) => setAnswer(current.id, a)}
            />

            {/* Prev / Next navigation */}
            <div className="flex justify-between mt-4 gap-3">
                <Button
                    id="prev-question-btn"
                    variant="secondary"
                    size="sm"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => i - 1)}
                >
                    ← Previous
                </Button>
                {currentIndex < questions.length - 1 ? (
                    <Button
                        id="next-question-btn"
                        variant="secondary"
                        size="sm"
                        onClick={() => setCurrentIndex((i) => i + 1)}
                    >
                        Next →
                    </Button>
                ) : (
                    <Button
                        id="finish-review-btn"
                        variant="primary"
                        size="sm"
                        onClick={handleSubmit}
                    >
                        Finish & Submit
                    </Button>
                )}
            </div>

            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-violet-600 inline-block" /> Current
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-600/40 inline-block" /> Answered
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-white/5 border border-white/10 inline-block" /> Unanswered
                </span>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main Assessment Page
// ---------------------------------------------------------------------------

interface AssessmentPageProps {
    onBack?: () => void;
}

const AssessmentPage: React.FC<AssessmentPageProps> = ({ onBack }) => {
    const { state, selectResume, upload, startGeneration, setAnswer, handleSubmit, restart, goBack } =
        useAssessment();

    const renderContent = () => {
        switch (state.phase) {
            case 'resume_select':
                return (
                    <ResumeSelectScreen
                        resumes={state.resumes}
                        loading={state.loadingResumes}
                        uploading={state.uploading}
                        error={state.resumeError}
                        onSelect={selectResume}
                        onUpload={upload}
                    />
                );
            case 'resume_preview':
                return (
                    <ResumePreviewScreen
                        resume={state.selectedResume!}
                        onProceed={startGeneration}
                        onBack={goBack}
                    />
                );
            case 'configuring':
            case 'generating':
                return <GeneratingScreen />;
            case 'attempting':
                return (
                    <AssessmentAttemptScreen
                        state={state}
                        setAnswer={setAnswer}
                        handleSubmit={handleSubmit}
                    />
                );
            case 'submitting':
                return <SubmittingScreen />;
            case 'results':
                return <ResultsScreen result={state.result!} onRestart={restart} />;
            case 'error':
                return (
                    <ErrorScreen
                        message={state.error ?? 'Unknown error'}
                        onRetry={state.selectedResume ? startGeneration : restart}
                        onBack={state.selectedResume ? goBack : restart}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-[#080B16] text-white">
            {/* Ambient gradient */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-800/10 rounded-full blur-3xl" />
            </div>

            {/* Header */}
            <header className="sticky top-0 z-10 bg-[#080B16]/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="mr-1 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                title="Back to Dashboard"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        <span className="text-xl font-extrabold text-white">
                            Placement<span className="text-violet-400">Hub</span>
                        </span>
                        <span className="hidden sm:inline text-xs bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2.5 py-0.5 rounded-full font-semibold">
                            AI Skill Assessment
                        </span>
                    </div>

                    {/* Breadcrumb steps */}
                    <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-500">
                        {['Select Resume', 'Preview', 'Assessment', 'Results'].map(
                            (step, i) => {
                                const phaseOrder = [
                                    'resume_select',
                                    'resume_preview',
                                    'attempting',
                                    'results',
                                ];
                                const currentPhaseIndex = phaseOrder.indexOf(state.phase);
                                const done = i < currentPhaseIndex;
                                const active = i === currentPhaseIndex;
                                return (
                                    <React.Fragment key={step}>
                                        <span
                                            className={
                                                active
                                                    ? 'text-violet-400 font-semibold'
                                                    : done
                                                        ? 'text-gray-400'
                                                        : ''
                                            }
                                        >
                                            {done ? '✓ ' : ''}
                                            {step}
                                        </span>
                                        {i < 3 && <span>›</span>}
                                    </React.Fragment>
                                );
                            },
                        )}
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="relative max-w-4xl mx-auto px-6 py-10">{renderContent()}</main>
        </div>
    );
};

export default AssessmentPage;
