// ---------------------------------------------------------------------------
// Assessment Module – per-skill combined scores (assessment + GitHub evidence)
//
// Composition layer only. It reads the graded scorecard and, when explicitly asked, runs the
// existing GitHub verifier. Question grading is never touched, and a GitHub failure never
// fails the request: the assessment-only scores are still returned.
// ---------------------------------------------------------------------------

import type { VerificationReport } from "../github/types.ts";
import {
  buildCombinedSkillResults,
  githubReportState,
  SCORE_WEIGHTS,
  summarizeVerification,
  VERIFICATION_THRESHOLDS,
  type CombinedSkillResult,
  type GithubReportState,
  type VerificationSummary,
} from "../scoring/skillScoring.ts";
import { ApiError } from "../utils/apiError.ts";
import { getSession, updateSession } from "./store.ts";
import type { AssessmentSession } from "./types.ts";

export interface SkillScoresResponse {
  sessionId: string;
  resumeId: string;
  weights: typeof SCORE_WEIGHTS;
  thresholds: typeof VERIFICATION_THRESHOLDS;
  /** How many of the resume's skills are verified, partially verified, or flagged. */
  verification: VerificationSummary;
  github: {
    state: GithubReportState;
    username?: string;
    checkedAt?: string;
    repositoriesInspected?: number;
    limitations: string[];
    /** Set when state is `failed`. */
    error?: { code: string; message: string };
  };
  skills: CombinedSkillResult[];
  note: string;
}

const NOTE =
  "combinedScore = 0.8 * assessmentScore + 0.2 * githubEvidenceScore when both exist; otherwise the assessment score alone. " +
  "GitHub evidence is supporting evidence only: it does not prove skill, identity or authorship, and a missing or unavailable " +
  "GitHub score is never a penalty. A null score means unavailable, not zero. Every skill on the resume gets a verification " +
  "verdict; flagged skills are not backed by evidence yet, which is different from being proven false.";

/** The caller's graded session, or an ApiError. */
export function getGradedSession(userId: string, sessionId: string): AssessmentSession {
  const session = getSession(sessionId);
  if (!session) throw new ApiError("Assessment session not found or expired", 404);
  if (session.userId !== userId) throw new ApiError("Unauthorized", 403);
  if (!session.scorecard) throw new ApiError("The assessment has not been graded yet", 409);
  return session;
}

/**
 * Builds the per-skill scores. Pass `runVerification` to run GitHub verification now; omit it to use the
 * last report stored on the session (or none). Failures degrade to assessment-only scores and are not cached.
 */
export async function buildSkillScores(
  session: AssessmentSession,
  runVerification?: () => Promise<VerificationReport>,
  /** Every skill claimed on the resume, so none escapes verification. */
  resumeSkills: { name: string; references?: string[] }[] = [],
): Promise<SkillScoresResponse> {
  const scorecard = session.scorecard!;

  let report: VerificationReport | null = session.githubReport ?? null;
  let state: GithubReportState = report ? (session.githubState ?? githubReportState(report)) : "not_run";
  let error: { code: string; message: string } | undefined;

  if (runVerification) {
    const started = Date.now();
    try {
      report = await runVerification();
      console.info(`[Timing] GitHub verification took ${Date.now() - started}ms (${report.repositories.length} repositories)`);
      state = githubReportState(report);
      updateSession(session.id, { githubReport: report, githubState: state });
    } catch (err) {
      // Keep whatever report an earlier run produced; a temporary error is not a negative result.
      error =
        err instanceof ApiError
          ? { code: err.code ?? "GITHUB_VERIFICATION_FAILED", message: err.message }
          : { code: "GITHUB_VERIFICATION_FAILED", message: "GitHub verification failed unexpectedly" };
      if (!session.githubReport) {
        report = null;
        state = "failed";
      }
    }
  }

  const skills = buildCombinedSkillResults({
    questions: scorecard.questionResults.map((q) => ({
      id: q.questionId,
      skill: q.skill,
      awardedPoints: q.awardedPoints,
      maxPoints: q.maxPoints,
    })),
    report,
    reportState: state,
    resumeSkills,
  });

  return {
    sessionId: session.id,
    resumeId: session.resumeId,
    weights: SCORE_WEIGHTS,
    thresholds: VERIFICATION_THRESHOLDS,
    verification: summarizeVerification(skills),
    github: {
      state,
      ...(report
        ? {
            username: report.github_profile.username,
            checkedAt: report.github_profile.checked_at,
            repositoriesInspected: report.repositories.filter((r) => r.status !== "not_accessible").length,
          }
        : {}),
      limitations: report?.limitations ?? [],
      ...(error ? { error } : {}),
    },
    skills,
    note: NOTE,
  };
}
