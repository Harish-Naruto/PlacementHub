import React from 'react';
import type { PublicQuestion } from '../api/assessmentApi';
import { Badge, DifficultyBadge, QuestionTypeLabel } from './ui';

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

interface TimerProps {
    seconds: number;
}

export const Timer: React.FC<TimerProps> = ({ seconds }) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const isLow = seconds < 120;
    const isCritical = seconds < 30;

    return (
        <div
            className={`
        flex items-center gap-2 px-4 py-2 rounded-xl border font-mono font-bold text-sm
        ${isCritical
                    ? 'bg-red-500/20 border-red-500/40 text-red-300 animate-pulse'
                    : isLow
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-white/5 border-white/10 text-white'
                }
      `}
        >
            <span>{isCritical ? '🔴' : isLow ? '🟡' : '⏱'}</span>
            <span>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Question Navigator (sidebar index)
// ---------------------------------------------------------------------------

interface QuestionNavProps {
    questions: PublicQuestion[];
    answers: Record<string, string>;
    currentIndex: number;
    onNavigate: (i: number) => void;
}

export const QuestionNav: React.FC<QuestionNavProps> = ({
    questions,
    answers,
    currentIndex,
    onNavigate,
}) => (
    <div className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => {
            const answered = !!answers[q.id];
            const isCurrent = i === currentIndex;
            return (
                <button
                    key={q.id}
                    id={`nav-q-${i + 1}`}
                    onClick={() => onNavigate(i)}
                    className={`
            w-8 h-8 rounded-lg text-xs font-bold border transition-all duration-150
            ${isCurrent
                            ? 'bg-violet-600 border-violet-500 text-white scale-110 shadow-lg shadow-violet-500/30'
                            : answered
                                ? 'bg-emerald-600/40 border-emerald-500/50 text-emerald-300'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30'
                        }
          `}
                >
                    {i + 1}
                </button>
            );
        })}
    </div>
);

// ---------------------------------------------------------------------------
// Individual question renderer
// ---------------------------------------------------------------------------

interface QuestionCardProps {
    question: PublicQuestion;
    questionNumber: number;
    totalQuestions: number;
    answer: string;
    onAnswer: (answer: string) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
    question,
    questionNumber,
    totalQuestions,
    answer,
    onAnswer,
}) => {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Question {questionNumber}/{totalQuestions}
                    </span>
                    <QuestionTypeLabel type={question.type} />
                    <DifficultyBadge difficulty={question.difficulty} />
                </div>
                <span className="text-xs font-semibold text-violet-400 shrink-0 bg-violet-500/10 border border-violet-500/20 rounded-lg px-2.5 py-1">
                    {question.maxMarks} mark{question.maxMarks !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Skill tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
                {question.skills.map((s) => (
                    <Badge key={s} variant="gray" size="sm">
                        {s}
                    </Badge>
                ))}
            </div>

            {/* Question text */}
            <p className="text-white text-base leading-relaxed mb-5 font-medium">{question.text}</p>

            {/* Coding context */}
            {question.expectedLanguage && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <p className="text-xs text-blue-300 font-semibold">
                        Expected Language: {question.expectedLanguage}
                    </p>
                    {question.expectedBehavior && (
                        <p className="text-xs text-blue-200/70 mt-1">{question.expectedBehavior}</p>
                    )}
                </div>
            )}

            {/* Answer input */}
            {question.type === 'mcq' && question.options ? (
                <div className="space-y-2" id={`mcq-options-${question.id}`}>
                    {question.options.map((opt) => (
                        <button
                            key={opt.id}
                            id={`mcq-opt-${question.id}-${opt.id}`}
                            onClick={() => onAnswer(opt.id)}
                            className={`
                w-full text-left p-3.5 rounded-xl border text-sm transition-all duration-150
                ${answer === opt.id
                                    ? 'bg-violet-600/30 border-violet-500/60 text-white shadow-lg shadow-violet-500/10'
                                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                                }
              `}
                        >
                            <span
                                className={`
                  inline-flex items-center justify-center w-6 h-6 rounded-lg mr-3 text-xs font-bold border shrink-0
                  ${answer === opt.id
                                        ? 'bg-violet-500 border-violet-400 text-white'
                                        : 'bg-white/5 border-white/20 text-gray-400'
                                    }
                `}
                            >
                                {opt.id}
                            </span>
                            {opt.text}
                        </button>
                    ))}
                </div>
            ) : question.type === 'coding' ? (
                <textarea
                    id={`coding-answer-${question.id}`}
                    value={answer}
                    onChange={(e) => onAnswer(e.target.value)}
                    rows={10}
                    placeholder={`// Write your ${question.expectedLanguage ?? 'code'} solution here…`}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 resize-y transition-colors"
                    spellCheck={false}
                />
            ) : (
                <textarea
                    id={`answer-${question.id}`}
                    value={answer}
                    onChange={(e) => onAnswer(e.target.value)}
                    rows={6}
                    placeholder="Type your answer here…"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 resize-y transition-colors"
                />
            )}
        </div>
    );
};
