// Application pipeline rules. Pure: no database, so every rule is unit tested.
//
//   APPLIED -> IN_REVIEW -> SHORTLISTED -> INTERVIEW_SCHEDULED -> INTERVIEWING -> OFFERED -> HIRED
//   REJECTED is allowed from any status that is not final. WITHDRAWN is the student's own action.

export type ApplicationStatus =
    | 'APPLIED'
    | 'IN_REVIEW'
    | 'SHORTLISTED'
    | 'INTERVIEW_SCHEDULED'
    | 'INTERVIEWING'
    | 'OFFERED'
    | 'HIRED'
    | 'REJECTED'
    | 'WITHDRAWN';

export type Stage = 'Applied' | 'Interview' | 'Offer' | 'Closed';

export const STATUS_ORDER: ApplicationStatus[] = [
    'APPLIED',
    'IN_REVIEW',
    'SHORTLISTED',
    'INTERVIEW_SCHEDULED',
    'INTERVIEWING',
    'OFFERED',
    'HIRED',
];

export const FINAL_STATUSES: ApplicationStatus[] = ['HIRED', 'REJECTED', 'WITHDRAWN'];

export const STAGES: Record<Stage, ApplicationStatus[]> = {
    Applied: ['APPLIED', 'IN_REVIEW', 'SHORTLISTED'],
    Interview: ['INTERVIEW_SCHEDULED', 'INTERVIEWING'],
    Offer: ['OFFERED', 'HIRED'],
    Closed: ['REJECTED', 'WITHDRAWN'],
};

export function stageOf(status: ApplicationStatus): Stage {
    for (const [stage, statuses] of Object.entries(STAGES) as [Stage, ApplicationStatus[]][]) {
        if (statuses.includes(status)) return stage;
    }
    return 'Applied';
}

/** Statuses a recruiter or the placement team may move an application to next. */
export function allowedNext(from: ApplicationStatus): ApplicationStatus[] {
    if (FINAL_STATUSES.includes(from)) return [];
    const i = STATUS_ORDER.indexOf(from);
    const forward = STATUS_ORDER.slice(i + 1);
    // One step forward, or any later step except HIRED, which only follows an offer.
    const steps = forward.filter((s) => s !== 'HIRED' || from === 'OFFERED');
    return [...steps, 'REJECTED'];
}

export interface TransitionCheck {
    ok: boolean;
    reason?: string;
    allowed: ApplicationStatus[];
}

export function checkTransition(from: ApplicationStatus, to: ApplicationStatus): TransitionCheck {
    const allowed = allowedNext(from);
    if (to === 'WITHDRAWN') {
        return { ok: false, reason: 'Only the student can withdraw an application', allowed };
    }
    if (from === to) return { ok: false, reason: `Application is already ${from}`, allowed };
    if (FINAL_STATUSES.includes(from)) {
        return { ok: false, reason: `Application is ${from} and can no longer change`, allowed };
    }
    if (!allowed.includes(to)) {
        return { ok: false, reason: `Cannot move from ${from} to ${to}`, allowed };
    }
    return { ok: true, allowed };
}
