import { describe, expect, test } from 'bun:test';
import { allowedNext, checkTransition, stageOf } from '../src/pipeline/transitions';

describe('pipeline transitions', () => {
    test('moves forward through the stages', () => {
        expect(checkTransition('APPLIED', 'IN_REVIEW').ok).toBe(true);
        expect(checkTransition('SHORTLISTED', 'INTERVIEW_SCHEDULED').ok).toBe(true);
        expect(checkTransition('INTERVIEWING', 'OFFERED').ok).toBe(true);
        expect(checkTransition('OFFERED', 'HIRED').ok).toBe(true);
    });

    test('cannot go backwards or stay put', () => {
        expect(checkTransition('INTERVIEWING', 'APPLIED').ok).toBe(false);
        expect(checkTransition('APPLIED', 'APPLIED').ok).toBe(false);
    });

    test('HIRED only follows an offer', () => {
        const r = checkTransition('INTERVIEWING', 'HIRED');
        expect(r.ok).toBe(false);
        expect(r.allowed).not.toContain('HIRED');
    });

    test('REJECTED is allowed from any open status', () => {
        for (const s of ['APPLIED', 'IN_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWING', 'OFFERED'] as const) {
            expect(checkTransition(s, 'REJECTED').ok).toBe(true);
        }
    });

    test('final statuses never change', () => {
        for (const s of ['HIRED', 'REJECTED', 'WITHDRAWN'] as const) {
            expect(allowedNext(s)).toEqual([]);
            expect(checkTransition(s, 'IN_REVIEW').ok).toBe(false);
        }
    });

    test('withdrawing is not a recruiter or placement action', () => {
        const r = checkTransition('APPLIED', 'WITHDRAWN');
        expect(r.ok).toBe(false);
        expect(r.reason).toContain('student');
    });

    test('an invalid move reports what is allowed', () => {
        const r = checkTransition('OFFERED', 'APPLIED');
        expect(r.allowed).toEqual(['HIRED', 'REJECTED']);
    });

    test('stages', () => {
        expect(stageOf('IN_REVIEW')).toBe('Applied');
        expect(stageOf('INTERVIEWING')).toBe('Interview');
        expect(stageOf('OFFERED')).toBe('Offer');
        expect(stageOf('REJECTED')).toBe('Closed');
    });
});
