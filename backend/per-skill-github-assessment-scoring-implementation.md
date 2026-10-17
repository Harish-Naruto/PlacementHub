# Per-Skill Verification and Combined Scoring — Implementation Guide

## 1. Goal

Improve PlacementHub's existing GitHub skill verification so each resume skill receives a normalized, explainable evidence result that can be combined with the existing assessment score for that same skill.

The intended outcome is a per-skill result containing:
- Assessment score (0–100)
- GitHub evidence score (0–100 or `null` when unavailable)
- Combined score (0–100)
- GitHub evidence status and explanation
- Traceable evidence references

**Do not replace the current GitHub verifier or assessment evaluator.** Extend them with a normalization layer and a separate, deterministic scoring function.

## 2. Current architecture to preserve

According to the repository context:
- Resume parsing produces canonicalized skills and project/experience claims.
- `backend/src/github/claims.ts` derives skill and project claims.
- `backend/src/github/catalog.ts` contains deterministic technology detection rules.
- `backend/src/github/detect.ts` evaluates dependency and source evidence.
- `backend/src/github/verify.ts` orchestrates repository discovery and claim-level verification.
- `backend/src/github/types.ts` defines the verification report contract.
- `backend/src/services/assessmentEvaluator.service.ts` evaluates assessment answers and returns per-skill results.
- `backend/src/types/assessment.ts` defines assessment result types.
- GitHub verification currently does not modify the assessment score.
- GitHub verification is secondary evidence; it must not be treated as proof of skill or individual authorship.

Inspect the current implementations before editing. Reuse existing `Claim`, `Evidence`, report, and assessment result types wherever possible. Do not create duplicate models without a concrete need.

## 3. Design principles

1. **Assessment is primary.** The assessment score measures demonstrated knowledge on the generated assessment.
2. **GitHub is supporting evidence.** It provides repository-level evidence consistent with a resume claim; it does not prove individual authorship or proficiency.
3. **Missing evidence is not zero skill.** Private, unavailable, inaccessible, unsupported, or unrecognized repositories must not automatically lower a score.
4. **Deterministic scoring.** The scoring function must be ordinary TypeScript with unit tests, not an LLM call.
5. **Explainability.** Preserve evidence URLs, repository identity, commit SHA when available, and the reason for each status.
6. **No double-counting.** Avoid counting the same evidence or duplicate claim repeatedly.
7. **Backward compatibility.** Preserve existing GitHub report statuses and assessment grading behavior unless a migration is explicitly needed.
8. **Candidate privacy.** Only use public repository evidence already permitted by the current verifier. Never attempt to access private repositories without authorization.

## 4. Data model: normalized evidence per skill

Extend existing types only where necessary. Each skill's verification result should be able to represent:

```ts
type EvidenceStrength = "high" | "medium" | "low" | "unknown";

type SkillEvidenceType =
  | "dependency"
  | "source_usage"
  | "configuration"
  | "contribution";

interface NormalizedSkillVerification {
  skill: string; // canonical skill name
  status:
    | "supported"
    | "partially_supported"
    | "insufficient_evidence"
    | "needs_review"
    | "not_accessible"
    | "not_checked";
  evidenceStrength: EvidenceStrength;
  evidence: Array<{
    type: SkillEvidenceType;
    repositoryUrl: string;
    evidenceUrl?: string;
    commitSha?: string;
  }>;
  reason?: string;
}
```

This is a conceptual shape, not a requirement to introduce an identically named interface. Adapt it to existing `Claim` and `Evidence` contracts.

### Evidence strength guidance

- `high`: relevant dependency/configuration plus relevant source usage in a matched repository.
- `medium`: meaningful source/configuration evidence, but incomplete corroboration.
- `low`: weak indicator such as a dependency declaration without source usage.
- `unknown`: no meaningful evidence, verification not performed, inaccessible repository, unsupported catalog entry, or evidence requiring review.

Do not treat repository language statistics alone as evidence of skill. Do not treat a dependency declaration alone as proof of practical use. Preserve the current detector's rule that dependency plus source usage is needed for `supported`.

## 5. Normalize skills and aggregate evidence

Create or reuse a deterministic normalization helper that:
- Uses existing skill alias/canonicalization logic where available.
- Maps resume skills and GitHub claim names to the same canonical key.
- Preserves original resume claim references for traceability.
- Aggregates evidence across relevant, distinct repositories.
- Deduplicates evidence by a stable identity such as canonical skill + repository + evidence type + evidence URL/commit.
- Does not count the same repository/file evidence multiple times because it appears under duplicate claims.
- Does not associate evidence for one technology with another merely because they commonly appear together. For example, React evidence should not automatically count as TypeScript evidence.
- Keeps separate projects/repositories distinct where their evidence is genuinely different.

When aliases cannot be mapped confidently, do not guess. Keep the claim unscored for GitHub or flag it for review.

## 6. Per-skill assessment score

Use the existing evaluator's per-skill marks where possible. Calculate the assessment percentage for a skill as:

`assessmentScore = 100 * earnedPointsForSkill / possiblePointsForSkill`

Requirements:
- Aggregate earned and possible marks from questions mapped to that skill.
- Do not average question percentages if questions have different maximum marks; use total earned points divided by total possible points.
- If no question maps to the skill, `assessmentScore` is `null` (not zero).
- Clamp and round according to one documented convention, e.g. nearest integer from 0 to 100.
- Ensure multi-skill questions are handled consistently. Prefer existing skill attribution. If a question is assigned to multiple skills, do not silently award the entire question's marks to every skill unless that is already the established semantics. If no established rule exists, define and test a deterministic allocation rule (for example, divide question earned and possible points equally across its mapped skills).

## 7. GitHub evidence score

The GitHub score is a **product heuristic for evidence strength**, not a probability of competence. Keep the mapping centralized and documented so it can be calibrated later.

Suggested initial mapping:

| Claim status | Initial GitHub score | Scoring treatment |
|---|---:|---|
| `supported` | 100 | Eligible positive evidence |
| `partially_supported` | 60 | Eligible but incomplete evidence |
| `insufficient_evidence` | `null` | Unknown; do not penalize |
| `needs_review` | `null` | Human review needed |
| `not_accessible` | `null` | Unavailable |
| `not_checked` | `null` | Not verified |

Important:
- `null` means unavailable/inconclusive, not zero.
- If several claims/repositories exist for a skill, aggregate eligible evidence deterministically and avoid duplicate evidence.
- Do not let one `supported` claim hide important contradictory evidence from another; preserve a status summary or conflict flag for recruiters.
- If there are no eligible evidence results, the skill's GitHub score is `null`.
- If there are both eligible and inconclusive claims, compute from eligible evidence while preserving inconclusive statuses in the explanation.
- Define and test how multiple independent claims are aggregated. A simple MVP option is the arithmetic mean of distinct eligible claim scores, weighted so duplicate evidence from the same repository does not increase the result. If the current report has insufficient structure for that rule, use a conservative per-skill summary and explain it rather than inventing evidence.

## 8. Combined score

For the MVP, use an initial weighting of 80% assessment and 20% GitHub evidence **only when both scores are available**:

`combinedScore = 0.8 * assessmentScore + 0.2 * githubEvidenceScore`

If GitHub evidence is unavailable, use the assessment score alone:

`combinedScore = assessmentScore`

If the assessment score is unavailable but GitHub evidence exists, do not silently present the GitHub evidence score as a competence score. Set `combinedScore` to `null` or report a separate evidence-only state.

If neither score exists, combined score is `null`.

Keep weights in one named constant/configuration, not duplicated across functions. Round the final score using the same documented convention as the assessment score.

**Interpretation:** 80/20 is an initial product choice for an MVP, not a validated psychometric weighting. Keep all component scores visible and make the weighting easy to change after testing.

Example:
- Assessment score: 80
- GitHub evidence score: 100
- Combined score: `0.8 * 80 + 0.2 * 100 = 84`

If GitHub evidence is unavailable and assessment score is 80, combined score remains 80—not 64 or 0.

## 9. Where to implement the change

Inspect repository files first and follow existing conventions.

| Existing file | Intended responsibility |
|---|---|
| `backend/src/github/catalog.ts` | Technology-specific evidence detection rules |
| `backend/src/github/detect.ts` | Produce/retain structured evidence dimensions and strength |
| `backend/src/github/claims.ts` | Normalize skill claims and preserve resume references |
| `backend/src/github/types.ts` | Existing report/evidence contract; extend minimally |
| `backend/src/github/verify.ts` | Orchestrate and return normalized, traceable claim evidence |
| `backend/src/services/assessmentEvaluator.service.ts` | Reuse assessment marks and integrate the per-skill scoring function at the appropriate result-composition boundary |
| `backend/src/types/assessment.ts` | Define result fields and Zod validation |
| `backend/tests/github.test.ts` | Evidence normalization, deduplication, status mapping, and aggregation tests |
| `backend/tests/assessment.test.ts` | Per-skill score math, combined scores, null handling, and compatibility tests |

Recommended: implement the combination logic in a small pure module, for example `backend/src/services/skillScoring.service.ts` or the project's equivalent. Avoid coupling GitHub HTTP requests to assessment arithmetic.

Do not automatically run GitHub verification as part of every assessment submission unless that behavior is explicitly requested. GitHub verification has rate limits and can fail independently. Prefer combining an available verification report with assessment results, or define an explicit orchestration step that calls the existing verifier and handles its failure without breaking assessment grading.

## 10. Suggested result shape

Adapt to the existing `SkillResult` schema rather than replacing the entire report.

```ts
interface CombinedSkillResult {
  skill: string;
  assessmentScore: number | null;
  githubEvidenceScore: number | null;
  combinedScore: number | null;
  githubStatus:
    | "supported"
    | "partially_supported"
    | "insufficient_evidence"
    | "needs_review"
    | "not_accessible"
    | "not_checked"
    | "not_run";
  evidenceStrength: "high" | "medium" | "low" | "unknown";
  evidenceSummary: string;
  evidenceUrls: string[];
}
```

Keep detailed evidence and internal identifiers in the trusted backend response/model. Expose only fields appropriate to the current user role. Do not include private source content or secrets in public results.

## 11. Failure handling

- If GitHub verification fails, times out, hits a rate limit, or is incomplete, retain the assessment result and mark GitHub evidence unavailable for affected skills.
- Do not turn GitHub failures into assessment submission failures.
- Preserve a top-level report state that distinguishes `completed`, `incomplete`, `not_run`, and failed verification if the existing contract supports it.
- Do not cache a temporary error as if it were a definitive negative skill result.
- Avoid logging full resume contents, private candidate answers, or secrets.
- Preserve the current GitHub request budgets and timeouts.

## 12. Required tests

### Assessment score
- Uses total earned marks / total possible marks, not an unweighted average of percentages.
- A skill with no mapped assessment questions gets `null`.
- Multi-skill question attribution follows the documented rule.
- Score is bounded between 0 and 100.

### GitHub evidence
- `supported` maps to 100 and `partially_supported` maps to 60 under the initial mapping.
- `insufficient_evidence`, `needs_review`, `not_accessible`, and `not_checked` map to `null`.
- Duplicate claims or repeated evidence do not inflate the score.
- Aliases map to the same canonical skill.
- Evidence for React does not automatically count for TypeScript.
- Forks and existing review statuses preserve current behavior.
- Incomplete reports and rate limits do not become zero scores.

### Combined score
- Assessment 80 + GitHub 100 => combined 84.
- Assessment 80 + GitHub 60 => combined 76.
- Assessment 80 + unavailable GitHub => combined 80.
- Missing assessment score + available GitHub score => combined `null` (evidence-only state).
- Both scores unavailable => combined `null`.
- Rounding and bounds are consistent.
- GitHub failure does not fail assessment grading.
- Existing assessment and GitHub tests continue to pass.

## 13. Implementation steps for the coding agent

1. Inspect current `Claim`, `Evidence`, `VerificationReport`, and per-skill assessment result definitions.
2. Identify how assessment questions are currently attributed to skills and how marks are aggregated.
3. Implement/reuse skill canonicalization and evidence deduplication.
4. Extend GitHub evidence structures minimally, preserving existing status semantics.
5. Implement a pure function for assessment, GitHub evidence, and combined score calculation.
6. Integrate it at the result-composition layer without changing question grading behavior.
7. Add unit tests for all mappings, edge cases, and failure handling.
8. Run `cd backend && bun test` and the project's typecheck/lint scripts.
9. Report changed files, score formulas, any schema changes, test results, and limitations.

Do not stop at a plan or pseudocode; implement the change in the repository. Inspect first and adapt this guide to the actual source code rather than blindly copying example interfaces.
