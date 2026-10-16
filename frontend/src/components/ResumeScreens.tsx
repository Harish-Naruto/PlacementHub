import React from 'react';
import type { MockResumeSummary } from '../api/assessmentApi';
import { Badge, Card, Button } from './ui';

// ---------------------------------------------------------------------------
// Resume Card (list item)
// ---------------------------------------------------------------------------

interface ResumeCardProps {
    resume: MockResumeSummary;
    onSelect: (resume: MockResumeSummary) => void;
}

export const ResumeCard: React.FC<ResumeCardProps> = ({ resume, onSelect }) => (
    <Card
        id={`resume-card-${resume.id}`}
        hoverable
        onClick={() => onSelect(resume)}
        className="p-5 group"
    >
        <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-white truncate">{resume.name}</span>
                </div>
                <p className="text-sm text-gray-400 mb-0.5">
                    {resume.education.degree}
                </p>
                <p className="text-xs text-gray-500">
                    {resume.education.institution} · Class of {resume.education.graduationYear}
                    {resume.education.cgpa ? ` · CGPA: ${resume.education.cgpa}` : ''}
                </p>
            </div>
            <div className="text-right shrink-0">
                <span className="text-xs text-violet-400 font-semibold uppercase tracking-wider">
                    {resume.skills.length} skills
                </span>
            </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
            {resume.skills.slice(0, 6).map((skill) => (
                <Badge key={skill} variant="violet" size="sm">
                    {skill}
                </Badge>
            ))}
            {resume.skills.length > 6 && (
                <Badge variant="gray" size="sm">
                    +{resume.skills.length - 6} more
                </Badge>
            )}
        </div>

        <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">
                {resume.projects.length} project{resume.projects.length !== 1 ? 's' : ''}
                {resume.experience.length > 0
                    ? ` · ${resume.experience.length} experience`
                    : ''}
            </span>
            <span className="text-xs font-semibold text-violet-400 group-hover:translate-x-1 transition-transform duration-200">
                View & Select →
            </span>
        </div>
    </Card>
);

// ---------------------------------------------------------------------------
// Resume Select Screen
// ---------------------------------------------------------------------------

interface ResumeSelectProps {
    resumes: MockResumeSummary[];
    loading: boolean;
    onSelect: (resume: MockResumeSummary) => void;
}

export const ResumeSelectScreen: React.FC<ResumeSelectProps> = ({ resumes, loading, onSelect }) => (
    <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-violet-400 text-xs font-semibold uppercase tracking-widest mb-4">
                ✦ AI Skill Assessment
            </span>
            <h1 className="text-4xl font-extrabold text-white mb-3 leading-tight">
                Select a <span className="text-violet-400">Student Profile</span>
            </h1>
            <p className="text-gray-400 max-w-md mx-auto">
                Choose a fictional student profile to generate a personalised AI-powered technical assessment.
            </p>
            <p className="mt-2 text-xs text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 inline-block">
                ⚠ These are dummy test profiles for demonstration purposes only
            </p>
        </div>

        {loading ? (
            <div className="flex justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                    <p className="text-gray-400 text-sm">Loading profiles…</p>
                </div>
            </div>
        ) : (
            <div className="grid gap-4">
                {resumes.map((r) => (
                    <ResumeCard key={r.id} resume={r} onSelect={onSelect} />
                ))}
            </div>
        )}
    </div>
);

// ---------------------------------------------------------------------------
// Resume Preview Screen
// ---------------------------------------------------------------------------

interface ResumePreviewProps {
    resume: MockResumeSummary;
    onProceed: () => void;
    onBack: () => void;
}

export const ResumePreviewScreen: React.FC<ResumePreviewProps> = ({
    resume,
    onProceed,
    onBack,
}) => (
    <div className="max-w-2xl mx-auto">
        <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
            id="back-to-resume-list"
        >
            ← Back to profiles
        </button>

        <Card className="p-6 mb-4">
            <div className="flex items-start gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-2xl font-bold text-violet-400 shrink-0">
                    {resume.name.charAt(0)}
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">{resume.name}</h2>
                    <p className="text-gray-400 text-sm">{resume.education.degree}</p>
                    <p className="text-gray-500 text-xs">
                        {resume.education.institution} · Class of {resume.education.graduationYear}
                        {resume.education.cgpa ? ` · CGPA: ${resume.education.cgpa}` : ''}
                    </p>
                </div>
            </div>

            <section className="mb-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                    Skills
                </h3>
                <div className="flex flex-wrap gap-1.5">
                    {resume.skills.map((s) => (
                        <Badge key={s} variant="violet" size="sm">
                            {s}
                        </Badge>
                    ))}
                </div>
            </section>

            <section className="mb-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                    Projects
                </h3>
                <div className="space-y-3">
                    {resume.projects.map((p) => (
                        <div
                            key={p.title}
                            className="p-3 bg-white/5 rounded-xl border border-white/10"
                        >
                            <p className="font-semibold text-white text-sm mb-1">{p.title}</p>
                            <p className="text-gray-400 text-xs mb-2">{p.description}</p>
                            <div className="flex flex-wrap gap-1">
                                {p.technologies.map((t) => (
                                    <Badge key={t} variant="gray" size="sm">
                                        {t}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {resume.experience.length > 0 && (
                <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                        Experience
                    </h3>
                    <div className="space-y-3">
                        {resume.experience.map((e) => (
                            <div
                                key={e.company}
                                className="p-3 bg-white/5 rounded-xl border border-white/10"
                            >
                                <p className="font-semibold text-white text-sm">{e.role}</p>
                                <p className="text-violet-400 text-xs mb-1">
                                    {e.company} · {e.duration}
                                </p>
                                <p className="text-gray-400 text-xs">{e.description}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </Card>

        <Button
            id="proceed-to-config-btn"
            onClick={onProceed}
            size="lg"
            className="w-full"
            icon={<span>🚀</span>}
        >
            Configure & Start Assessment
        </Button>
    </div>
);

// ---------------------------------------------------------------------------
// Config Screen
// ---------------------------------------------------------------------------

interface ConfigScreenProps {
    config: { questionCount: number; difficulty: string; durationMinutes: number };
    onUpdate: (patch: Partial<{ questionCount: number; difficulty: 'easy' | 'medium' | 'hard' | 'mixed'; durationMinutes: number }>) => void;
    onStart: () => void;
    onBack: () => void;
}

export const ConfigScreen: React.FC<ConfigScreenProps> = ({ config, onUpdate, onStart, onBack }) => (
    <div className="max-w-lg mx-auto">
        <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
        >
            ← Back
        </button>
        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Assessment Settings</h2>
            <p className="text-gray-400 text-sm">Customise or accept the default configuration.</p>
        </div>

        <Card className="p-6 space-y-6">
            {/* Question Count */}
            <div>
                <label className="text-sm font-semibold text-gray-300 block mb-2">
                    Number of Questions: <span className="text-violet-400">{config.questionCount}</span>
                </label>
                <input
                    id="question-count-slider"
                    type="range"
                    min={5}
                    max={20}
                    value={config.questionCount}
                    onChange={(e) => onUpdate({ questionCount: parseInt(e.target.value) })}
                    className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>5</span>
                    <span>20</span>
                </div>
            </div>

            {/* Difficulty */}
            <div>
                <label className="text-sm font-semibold text-gray-300 block mb-2">Difficulty</label>
                <div className="grid grid-cols-4 gap-2">
                    {(['easy', 'medium', 'hard', 'mixed'] as const).map((d) => (
                        <button
                            key={d}
                            id={`difficulty-${d}`}
                            onClick={() => onUpdate({ difficulty: d })}
                            className={`
                py-2 rounded-xl text-sm font-semibold border transition-all duration-150 capitalize
                ${config.difficulty === d
                                    ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/30'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                                }
              `}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            </div>

            {/* Duration */}
            <div>
                <label className="text-sm font-semibold text-gray-300 block mb-2">
                    Duration: <span className="text-violet-400">{config.durationMinutes} min</span>
                </label>
                <input
                    id="duration-slider"
                    type="range"
                    min={10}
                    max={60}
                    step={5}
                    value={config.durationMinutes}
                    onChange={(e) => onUpdate({ durationMinutes: parseInt(e.target.value) })}
                    className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>10 min</span>
                    <span>60 min</span>
                </div>
            </div>
        </Card>

        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
            ℹ The assessment will be personalised based on the selected student's resume. Gemini will
            analyse their skills and projects to generate relevant questions.
        </div>

        <Button
            id="start-assessment-btn"
            onClick={onStart}
            size="lg"
            className="w-full mt-6"
            icon={<span>⚡</span>}
        >
            Generate Assessment with AI
        </Button>
    </div>
);
