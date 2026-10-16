import React from 'react';
import type { AssessmentResult, QuestionResult, SkillResult } from '../api/assessmentApi';
import { Badge, Button, ProgressBar } from './ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(pct: number) {
    if (pct >= 75) return 'bg-emerald-500';
    if (pct >= 40) return 'bg-amber-500';
    return 'bg-red-500';
}

function getScoreBadge(pct: number): { label: string; class: string } {
    if (pct >= 90) return { label: '🏆 Excellent', class: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    if (pct >= 75) return { label: '✅ Good', class: 'bg-green-500/20 text-green-300 border-green-500/30' };
    if (pct >= 50) return { label: '📈 Average', class: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    return { label: '📝 Needs Work', class: 'bg-red-500/20 text-red-300 border-red-500/30' };
}

function skillStatusLabel(status: string): { label: string; color: 'green' | 'yellow' | 'red' | 'gray' } {
    switch (status) {
        case 'demonstrated': return { label: 'Demonstrated', color: 'green' };
        case 'developing': return { label: 'Developing', color: 'yellow' };
        case 'needs_improvement': return { label: 'Needs Improvement', color: 'red' };
        default: return { label: 'Not Assessed', color: 'gray' };
    }
}

// ---------------------------------------------------------------------------
// Overall Score Hero
// ---------------------------------------------------------------------------

const ScoreHero: React.FC<{ result: AssessmentResult }> = ({ result }) => {
    const { label, class: cls } = getScoreBadge(result.overallPercentage);

    return (
        <div className="text-center py-8 px-6 bg-gradient-to-b from-violet-600/10 to-transparent rounded-2xl border border-violet-500/20 mb-6">
            <div className={`inline-flex items-center px-4 py-1.5 rounded-full border text-sm font-bold mb-4 ${cls}`}>
                {label}
            </div>
            <div className="relative inline-flex items-center justify-center mb-4">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                    <circle
                        cx="60" cy="60" r="54" fill="none"
                        stroke="url(#scoreGrad)" strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 54}`}
                        strokeDashoffset={`${2 * Math.PI * 54 * (1 - result.overallPercentage / 100)}`}
                        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                    />
                    <defs>
                        <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#7c3aed" />
                            <stop offset="100%" stopColor="#a78bfa" />
                        </linearGradient>
                    </defs>
                </svg>
                <div className="absolute text-center">
                    <div className="text-3xl font-extrabold text-white">{result.overallPercentage.toFixed(1)}%</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                        {result.totalMarksEarned}/{result.totalMarksAvailable}
                    </div>
                </div>
            </div>
            <p className="text-gray-400 text-sm">{result.evaluationNote}</p>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Skill Results Grid
// ---------------------------------------------------------------------------

const SkillResultsGrid: React.FC<{ skillResults: SkillResult[] }> = ({ skillResults }) => (
    <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Skill Breakdown
        </h3>
        <div className="space-y-3">
            {skillResults.map((sr) => {
                const { label, color } = skillStatusLabel(sr.status);
                return (
                    <div key={sr.skill} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">{sr.skill}</span>
                                <Badge variant={color} size="sm">{label}</Badge>
                            </div>
                            <span className="text-sm font-bold text-white">
                                {sr.marksEarned}/{sr.marksAvailable}
                            </span>
                        </div>
                        <ProgressBar
                            value={sr.percentage}
                            color={getScoreColor(sr.percentage)}
                            size="sm"
                            showLabel
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {sr.questionCount} question{sr.questionCount !== 1 ? 's' : ''}
                        </p>
                    </div>
                );
            })}
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// Per-Question feedback accordion
// ---------------------------------------------------------------------------

const QuestionFeedbackCard: React.FC<{ qr: QuestionResult; index: number }> = ({ qr, index }) => {
    const [open, setOpen] = React.useState(false);
    const scorePct = qr.maxMarks > 0 ? (qr.awardedMarks / qr.maxMarks) * 100 : 0;

    return (
        <div className={`border rounded-xl overflow-hidden transition-all ${open ? 'border-violet-500/40' : 'border-white/10'}`}>
            <button
                id={`q-result-${qr.questionId}`}
                className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/8 transition-colors text-left gap-4"
                onClick={() => setOpen((o) => !o)}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-gray-500 shrink-0">Q{index + 1}</span>
                    <span className="text-xs text-gray-400 font-medium truncate">{qr.skill}</span>
                    {!qr.wasAnswered && (
                        <Badge variant="gray" size="sm">Unanswered</Badge>
                    )}
                    <Badge
                        variant={
                            qr.evaluationMethod === 'auto_correct'
                                ? 'blue'
                                : qr.evaluationMethod === 'unanswered'
                                    ? 'gray'
                                    : 'violet'
                        }
                        size="sm"
                    >
                        {qr.evaluationMethod === 'auto_correct'
                            ? 'Auto-graded'
                            : qr.evaluationMethod === 'unanswered'
                                ? 'Skipped'
                                : 'AI-reviewed'}
                    </Badge>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-sm font-bold ${scorePct >= 75 ? 'text-emerald-400' : scorePct >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                        {qr.awardedMarks}/{qr.maxMarks}
                    </span>
                    <span className={`text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
                </div>
            </button>

            {open && (
                <div className="p-4 border-t border-white/10 space-y-4 bg-black/20">
                    {/* Criterion scores */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Criterion Scores
                        </p>
                        <div className="space-y-2">
                            {qr.criterionScores.map((cs) => (
                                <div key={cs.criterion}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-300">{cs.criterion}</span>
                                        <span className="text-white font-semibold">{cs.awardedMarks}/{cs.maxMarks}</span>
                                    </div>
                                    <ProgressBar
                                        value={(cs.awardedMarks / cs.maxMarks) * 100}
                                        color={getScoreColor((cs.awardedMarks / cs.maxMarks) * 100)}
                                        size="sm"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{cs.reason}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Feedback */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Feedback</p>
                        <p className="text-sm text-gray-300 leading-relaxed">{qr.feedback}</p>
                    </div>

                    {qr.strengths.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Strengths</p>
                            <ul className="space-y-1">
                                {qr.strengths.map((s, i) => (
                                    <li key={i} className="text-xs text-gray-300 flex gap-2">
                                        <span className="text-emerald-400 shrink-0">✓</span>{s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {qr.improvements.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Areas to Improve</p>
                            <ul className="space-y-1">
                                {qr.improvements.map((s, i) => (
                                    <li key={i} className="text-xs text-gray-300 flex gap-2">
                                        <span className="text-amber-400 shrink-0">→</span>{s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Full Results Screen
// ---------------------------------------------------------------------------

interface ResultsScreenProps {
    result: AssessmentResult;
    onRestart: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({ result, onRestart }) => (
    <div className="max-w-2xl mx-auto">
        <ScoreHero result={result} />

        {/* Aggregated strengths & improvements */}
        <div className="grid grid-cols-2 gap-4 mb-6">
            {result.aggregatedStrengths.length > 0 && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">
                        Strengths
                    </p>
                    <ul className="space-y-1.5">
                        {result.aggregatedStrengths.map((s, i) => (
                            <li key={i} className="text-xs text-gray-300 flex gap-2">
                                <span className="text-emerald-400 shrink-0">✓</span>{s}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {result.aggregatedImprovements.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">
                        Focus Areas
                    </p>
                    <ul className="space-y-1.5">
                        {result.aggregatedImprovements.map((s, i) => (
                            <li key={i} className="text-xs text-gray-300 flex gap-2">
                                <span className="text-amber-400 shrink-0">→</span>{s}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>

        <SkillResultsGrid skillResults={result.skillResults} />

        {/* Per-question breakdown */}
        <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Question-by-Question Breakdown
            </h3>
            <div className="space-y-2">
                {result.questionResults.map((qr, i) => (
                    <QuestionFeedbackCard key={qr.questionId} qr={qr} index={i} />
                ))}
            </div>
        </div>

        <div className="sticky bottom-4 flex gap-3">
            <Button
                id="start-new-assessment-btn"
                onClick={onRestart}
                size="lg"
                className="flex-1"
                icon={<span>🔄</span>}
            >
                New Assessment
            </Button>
        </div>
    </div>
);
