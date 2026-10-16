import React, { useRef } from 'react';
import type { ParsedResume, StoredResume } from '../api/assessmentApi';
import { Badge, Card, Button } from './ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The parser emits one row per mention (listed + each project), so merge by canonical name. */
function uniqueSkills(resume: ParsedResume): string[] {
    const seen = new Map<string, string>();
    for (const s of resume.skills) {
        const name = s.canonical_name ?? s.name;
        if (!seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
    }
    return [...seen.values()];
}

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// ---------------------------------------------------------------------------
// Resume Card (list item)
// ---------------------------------------------------------------------------

interface ResumeCardProps {
    resume: StoredResume;
    onSelect: (resume: StoredResume) => void;
}

export const ResumeCard: React.FC<ResumeCardProps> = ({ resume, onSelect }) => {
    const skills = uniqueSkills(resume.resume);
    const { projects, experience } = resume.resume;
    return (
        <Card
            id={`resume-card-${resume.id}`}
            hoverable
            onClick={() => onSelect(resume)}
            className="p-5 group"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-lg font-bold text-white truncate">
                        {projects[0]?.name ?? experience[0]?.title ?? 'Parsed resume'}
                        {projects.length > 1 ? ` + ${projects.length - 1} more` : ''}
                    </p>
                    <p className="text-xs text-gray-500">Uploaded {formatDate(resume.createdAt)}</p>
                </div>
                <span className="text-xs text-violet-400 font-semibold uppercase tracking-wider shrink-0">
                    {skills.length} skills
                </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
                {skills.slice(0, 6).map((skill) => (
                    <Badge key={skill} variant="violet" size="sm">
                        {skill}
                    </Badge>
                ))}
                {skills.length > 6 && (
                    <Badge variant="gray" size="sm">
                        +{skills.length - 6} more
                    </Badge>
                )}
            </div>

            <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                    {projects.length} project{projects.length !== 1 ? 's' : ''}
                    {experience.length > 0 ? ` · ${experience.length} experience` : ''}
                </span>
                <span className="text-xs font-semibold text-violet-400 group-hover:translate-x-1 transition-transform duration-200">
                    View & Select →
                </span>
            </div>
        </Card>
    );
};

// ---------------------------------------------------------------------------
// Resume Select Screen (upload a new resume or reuse a parsed one)
// ---------------------------------------------------------------------------

interface ResumeSelectProps {
    resumes: StoredResume[];
    loading: boolean;
    uploading: boolean;
    error: string | null;
    onSelect: (resume: StoredResume) => void;
    onUpload: (file: File) => void;
}

export const ResumeSelectScreen: React.FC<ResumeSelectProps> = ({
    resumes,
    loading,
    uploading,
    error,
    onSelect,
    onUpload,
}) => {
    const fileInput = useRef<HTMLInputElement>(null);

    return (
        <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <span className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-violet-400 text-xs font-semibold uppercase tracking-widest mb-4">
                    ✦ AI Skill Assessment
                </span>
                <h1 className="text-4xl font-extrabold text-white mb-3 leading-tight">
                    Verify your <span className="text-violet-400">Resume Skills</span>
                </h1>
                <p className="text-gray-400 max-w-md mx-auto">
                    Upload your resume and we'll generate a short assessment that tests the skills and projects you
                    claim.
                </p>
            </div>

            <input
                ref={fileInput}
                id="resume-file-input"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = ''; // allow re-selecting the same file after an error
                    if (file) onUpload(file);
                }}
            />

            <Card className="p-6 mb-6 text-center border-dashed">
                {uploading ? (
                    <div className="flex flex-col items-center gap-3 py-2">
                        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                        <p className="text-gray-300 text-sm">Reading your resume with AI…</p>
                        <p className="text-gray-500 text-xs">This can take 10–20 seconds.</p>
                    </div>
                ) : (
                    <>
                        <p className="text-white font-semibold mb-1">Upload a resume</p>
                        <p className="text-gray-500 text-xs mb-4">PDF or DOCX, up to 5MB</p>
                        <Button id="upload-resume-btn" onClick={() => fileInput.current?.click()} size="md">
                            Choose file
                        </Button>
                    </>
                )}
                {error && (
                    <p className="mt-4 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {error}
                    </p>
                )}
            </Card>

            {loading ? (
                <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                </div>
            ) : (
                resumes.length > 0 && (
                    <>
                        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                            Or use a resume you've already uploaded
                        </h2>
                        <div className="grid gap-4">
                            {resumes.map((r) => (
                                <ResumeCard key={r.id} resume={r} onSelect={onSelect} />
                            ))}
                        </div>
                    </>
                )
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Resume Preview Screen
// ---------------------------------------------------------------------------

interface ResumePreviewProps {
    resume: StoredResume;
    onProceed: () => void;
    onBack: () => void;
}

export const ResumePreviewScreen: React.FC<ResumePreviewProps> = ({ resume, onProceed, onBack }) => {
    const { projects, experience } = resume.resume;
    const skills = uniqueSkills(resume.resume);

    return (
        <div className="max-w-2xl mx-auto">
            <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
                id="back-to-resume-list"
            >
                ← Back to resumes
            </button>

            <Card className="p-6 mb-4">
                <h2 className="text-2xl font-bold text-white mb-1">What we found in your resume</h2>
                <p className="text-gray-500 text-xs mb-5">
                    The assessment will only ask about the skills and projects below.
                </p>

                <section className="mb-5">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Skills</h3>
                    <div className="flex flex-wrap gap-1.5">
                        {skills.map((s) => (
                            <Badge key={s} variant="violet" size="sm">
                                {s}
                            </Badge>
                        ))}
                    </div>
                </section>

                {projects.length > 0 && (
                    <section className="mb-5">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                            Projects
                        </h3>
                        <div className="space-y-3">
                            {projects.map((p) => (
                                <div key={p.name} className="p-3 bg-white/5 rounded-xl border border-white/10">
                                    <p className="font-semibold text-white text-sm mb-1">{p.name}</p>
                                    {(p.description ?? p.features[0]?.claim) && (
                                        <p className="text-gray-400 text-xs mb-2">
                                            {p.description ?? p.features[0].claim}
                                        </p>
                                    )}
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
                )}

                {experience.length > 0 && (
                    <section>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                            Experience
                        </h3>
                        <div className="space-y-3">
                            {experience.map((e, i) => (
                                <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/10">
                                    <p className="font-semibold text-white text-sm">{e.title ?? 'Role'}</p>
                                    <p className="text-violet-400 text-xs mb-1">
                                        {e.organization ?? 'Unknown'}
                                        {e.start_date ? ` · ${e.start_date} – ${e.is_current ? 'Present' : (e.end_date ?? '')}` : ''}
                                    </p>
                                    {e.responsibilities[0] && (
                                        <p className="text-gray-400 text-xs">{e.responsibilities[0]}</p>
                                    )}
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
};

// ---------------------------------------------------------------------------
// Config Screen
// ---------------------------------------------------------------------------

interface ConfigScreenProps {
    config: { questionCount: number; difficulty: string; durationMinutes: number };
    onUpdate: (patch: Partial<{ questionCount: number; difficulty: 'easy' | 'medium' | 'hard' | 'mixed'; durationMinutes: number }>) => void;
    onStart: () => void;
    onBack: () => void;
    isGenerating?: boolean;
}

export const ConfigScreen: React.FC<ConfigScreenProps> = ({ config, onUpdate, onStart, onBack, isGenerating = false }) => (
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
                    min={3}
                    max={12}
                    value={config.questionCount}
                    onChange={(e) => onUpdate({ questionCount: parseInt(e.target.value) })}
                    className="w-full accent-violet-500"
                    disabled={isGenerating}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>3</span>
                    <span>12</span>
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
                            disabled={isGenerating}
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
                    disabled={isGenerating}
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
            disabled={isGenerating}
            loading={isGenerating}
            icon={!isGenerating ? <span>⚡</span> : undefined}
        >
            {isGenerating ? 'Generating Assessment with Gemini...' : 'Generate Assessment with AI'}
        </Button>
    </div>
);
