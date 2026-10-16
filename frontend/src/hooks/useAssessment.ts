import { useState, useEffect, useCallback } from 'react';
import { fetchResumes, generateAssessment, submitAssessment, ApiError } from '../api/assessmentApi';
import type { MockResumeSummary, PublicQuestion, AssessmentResult } from '../api/assessmentApi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AssessmentPhase =
    | 'resume_select'
    | 'resume_preview'
    | 'configuring'
    | 'generating'
    | 'attempting'
    | 'submitting'
    | 'results'
    | 'error';

export interface AssessmentConfig {
    questionCount: number;
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
    durationMinutes: number;
}

interface AssessmentState {
    phase: AssessmentPhase;
    resumes: MockResumeSummary[];
    selectedResume: MockResumeSummary | null;
    config: AssessmentConfig;
    assessmentId: string | null;
    questions: PublicQuestion[];
    totalMaxMarks: number;
    answers: Record<string, string>;
    timeLeftSeconds: number;
    result: AssessmentResult | null;
    error: string | null;
    loadingResumes: boolean;
}

const DEFAULT_CONFIG: AssessmentConfig = {
    questionCount: 12,
    difficulty: 'mixed',
    durationMinutes: 20,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAssessment() {
    const [state, setState] = useState<AssessmentState>({
        phase: 'resume_select',
        resumes: [],
        selectedResume: null,
        config: DEFAULT_CONFIG,
        assessmentId: null,
        questions: [],
        totalMaxMarks: 100,
        answers: {},
        timeLeftSeconds: DEFAULT_CONFIG.durationMinutes * 60,
        result: null,
        error: null,
        loadingResumes: true,
    });

    // Load resumes on mount
    useEffect(() => {
        fetchResumes()
            .then(({ data }) =>
                setState((s) => ({ ...s, resumes: data, loadingResumes: false })),
            )
            .catch((err) =>
                setState((s) => ({
                    ...s,
                    loadingResumes: false,
                    error: err instanceof ApiError ? err.message : 'Failed to load resumes',
                    phase: 'error',
                })),
            );
    }, []);

    // Countdown timer (only during 'attempting' phase)
    useEffect(() => {
        if (state.phase !== 'attempting') return;
        if (state.timeLeftSeconds <= 0) {
            handleSubmit();
            return;
        }
        const timer = setInterval(() => {
            setState((s) => {
                if (s.timeLeftSeconds <= 1) {
                    clearInterval(timer);
                    return { ...s, timeLeftSeconds: 0 };
                }
                return { ...s, timeLeftSeconds: s.timeLeftSeconds - 1 };
            });
        }, 1000);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.phase, state.timeLeftSeconds]);

    const selectResume = useCallback((resume: MockResumeSummary) => {
        setState((s) => ({ ...s, selectedResume: resume, phase: 'resume_preview' }));
    }, []);

    const goToConfig = useCallback(() => {
        setState((s) => ({ ...s, phase: 'configuring' }));
    }, []);

    const updateConfig = useCallback((config: Partial<AssessmentConfig>) => {
        setState((s) => ({ ...s, config: { ...s.config, ...config } }));
    }, []);

    const startGeneration = useCallback(async () => {
        setState((s) => ({ ...s, phase: 'generating', error: null }));
        try {
            const res = await generateAssessment({
                resumeId: state.selectedResume!.id,
                config: state.config,
            });
            setState((s) => ({
                ...s,
                assessmentId: res.data.assessmentId,
                questions: res.data.questions,
                totalMaxMarks: res.data.totalMaxMarks,
                answers: {},
                timeLeftSeconds: s.config.durationMinutes * 60,
                phase: 'attempting',
            }));
        } catch (err) {
            setState((s) => ({
                ...s,
                phase: 'error',
                error: err instanceof ApiError ? err.message : 'Failed to generate assessment',
            }));
        }
    }, [state.selectedResume, state.config]);

    const setAnswer = useCallback((questionId: string, answer: string) => {
        setState((s) => ({
            ...s,
            answers: { ...s.answers, [questionId]: answer },
        }));
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!state.assessmentId) return;
        setState((s) => ({ ...s, phase: 'submitting', error: null }));
        try {
            const answers = Object.entries(state.answers).map(([questionId, answer]) => ({
                questionId,
                answer,
            }));
            const res = await submitAssessment(state.assessmentId, answers);
            setState((s) => ({ ...s, phase: 'results', result: res.data }));
        } catch (err) {
            setState((s) => ({
                ...s,
                phase: 'error',
                error: err instanceof ApiError ? err.message : 'Submission failed',
            }));
        }
    }, [state.assessmentId, state.answers]);

    const restart = useCallback(() => {
        setState((s) => ({
            ...s,
            phase: 'resume_select',
            selectedResume: null,
            config: DEFAULT_CONFIG,
            assessmentId: null,
            questions: [],
            totalMaxMarks: 100,
            answers: {},
            timeLeftSeconds: DEFAULT_CONFIG.durationMinutes * 60,
            result: null,
            error: null,
        }));
    }, []);

    const goBack = useCallback(() => {
        setState((s) => {
            switch (s.phase) {
                case 'resume_preview':
                    return { ...s, phase: 'resume_select', selectedResume: null };
                case 'configuring':
                    return { ...s, phase: 'resume_preview' };
                default:
                    return s;
            }
        });
    }, []);

    return {
        state,
        selectResume,
        goToConfig,
        updateConfig,
        startGeneration,
        setAnswer,
        handleSubmit,
        restart,
        goBack,
    };
}
