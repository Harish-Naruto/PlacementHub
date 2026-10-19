# PlacementHub: Hackathon MVP Plan

**Status: built. Backend tested (166 unit tests plus an end-to-end run against a throwaway Postgres); frontend screens typechecked, linted and built but not clicked through in a browser.** Where this plan and CONTEXT.md differ, CONTEXT.md describes what the code does now.

Scope is cut to the **core path of the brief**. Everything else is listed under "Cut" and can be added after the demo.

Decisions:
- The recruiter side is written from scratch (`recruiterPortal.*` files). `origin/recruitor_flow` is not merged or used.
- **Deterministic first.** Matching, explanations, gaps and resume bullets are plain code (no LLM), so they are fast, testable and cannot invent facts. Gemini is used only where it already is (resume parsing, assessment) and, optionally, to parse job descriptions, with a rules-based fallback.
- "Unsupported" means "not backed by evidence yet", never "proven false".

## MVP scope (what gets built)

| # | Feature | Brief item |
|---|---|---|
| 0 | Critical fixes, one skill taxonomy, store numeric skill scores, `PLACEMENT` role | all |
| 1 | Job ingestion: paste a posting + one free job API (with offline fixtures), parser, skill normalisation, dedupe across sources | 1 |
| 2 | Fit score, plain-language explanation, specific gaps (student x job) | 3 |
| 3 | Tailored one-page resume where every bullet carries evidence ids; unsupported claims blocked; claim check for an uploaded resume | 4 |
| 4 | Application pipeline with validated status changes; placement team ranks a whole batch for one pasted JD | 5 |
| 5 | Minimal recruiter portal: company profile, post/publish/close jobs, ranked applicants, status changes | 6 (reduced) |
| 6 | Seed script with demo data | demo |

Already built and reused: resume parsing, assessment, GitHub verification, per-skill verdicts, `SkillEvidence` rows, student apply/withdraw.

## Cut (not in the MVP)

Alumni mapping and referrals, interview-question bank, CSV import, Adzuna adapter, duplicate-review queue (fuzzy matches above the threshold auto-merge, the rest stay separate), project-evaluation endpoint, assessment persistence in the DB, PDF library (the resume is HTML with print styles; the browser saves it as PDF), LLM rewording of bullets or explanations, bulk status updates, CSV export, analytics pages.

## 0. Foundations

**Fixes:**
1. Declare `@node-rs/argon2` and `@prisma/adapter-pg` in `backend/package.json`.
2. Zod 4: use `error.issues` instead of `error.errors` (job and student routes; bad input currently becomes a 500).
3. Student job list shows only `PUBLISHED` jobs.
4. Remove `console.log(result)` in register (prints tokens) and the debug log in resume upload.
5. Route param typing (`string | string[]`) so `tsc --noEmit` is clean.

**Schema (one migration, generated as SQL, applied by you):**
```prisma
enum UserRole { STUDENT RECRUITER PLACEMENT }
StudentSkill  += assessmentScore Int?, githubScore Int?, combinedScore Int?, evidenceStrength String?, scoredAt DateTime?
JobPosting    += companyId String? (always set by code), recruiterProfileId now optional,
                 origin JobSourceType, dedupeKey String? (indexed), sourceCount Int @default(1), parseMethod String?
JobSource     += sourceLabel String?
Application   += fitScore Int?, fitSnapshot Json?, resumeSnapshot Json?
```

**Skill taxonomy** (`backend/src/skills/`): about 100 skills with aliases; `canonicalSkill(name)` used by resume normalisation, scoring, job parsing and matching. "ReactJS", "React.js", "React" give one skill; Java and JavaScript stay distinct.

**Persist scores:** `scoring/skillPersistence.ts` also writes the three scores and `scoredAt` to `StudentSkill`.

**Placement role:** `PLACEMENT_SIGNUP_CODE` env var; an invitation code equal to it registers a `PLACEMENT` user.

## 1. Job ingestion (`backend/src/jobs/`)

- **Sources:** `POST /placement/ingest/paste` (partner posting or alumni referral text, with `sourceType` and `sourceLabel`) and `POST /placement/ingest/api` (Remotive; `INGEST_USE_FIXTURES=true` reads `backend/fixtures/jobs/remotive.json`).
- **Parser** (`parseJob.ts`): rules parser always available (taxonomy scan; skills under "required / must have" are required, under "preferred / nice to have / plus" are preferred; CGPA, batch year and branch regexes). Gemini structured output is tried first when a key is set; `parseMethod` records which ran.
- **Dedupe** (`dedupe.ts`, pure): normalise company, title and city; `dedupeKey = sha1(company|title|city)`. Same key merges. Otherwise, same company (and not two different real cities; a remote listing fits any city) with similarity `0.6 * title Jaccard + 0.4 * skill overlap of the shorter list >= 80` also merges. Re-sending by the same labelled partner is not counted as a new source. A merge adds a `JobSource` row, bumps `sourceCount`, and unions skills (required beats preferred).
- **Endpoints (PLACEMENT):** the two ingest endpoints above, `PATCH /placement/jobs/:id` (fix parsed skills), `GET /placement/jobs`.
- **Tests:** alias normalisation, parser sections, dedupe merge and non-merge cases.

## 2. Matching (`backend/src/matching/fit.ts`, pure)

- Credit per skill: `combinedScore / 100` if present; GitHub-only evidence is capped at `0.5`; self-declared or missing is `0`.
- `weight = requirementWeight * (REQUIRED 1.0 | PREFERRED 0.25)`; `fit = round(100 * sum(weight * credit) / sum(weight))`. Bands: 70+ Strong, 50 to 69 Good, 30 to 49 Partial, below 30 Low (tuned after running the seeded demo: a student with every required skill demonstrated now reads Strong, not Good). A job with no skills gives `null`.
- Eligibility (CGPA, branch, graduation year, deadline) is returned as flags and does not change the score.
- Output: `matched[]` (with proof), `gaps[]` (`missing | claimed_only | weak | observed_only`, each with a next action) and a templated `explanation`.
- **Endpoints (STUDENT):** `GET /jobs/:jobId/fit`; `GET /jobs?withFit=true` adds a fit score per job.
- **Tests:** perfect profile, no skills, required vs preferred weight, GitHub cap, alias match, null job, eligibility flags.

## 3. Truthful resume (`backend/src/resumeBuilder/`)

- **Facts only:** build a fact list from verified `StudentSkill` evidence, `Project` rows and the latest parsed resume (projects, experience, education). Each fact has an id, its skills and its proof.
- **Selection:** rank facts by overlap with the job's required (1.0) and preferred (0.5) skills; keep the top 3 projects, up to 3 bullets each, the verified skills, education and experience.
- **Bullets** come from templates over fact fields (for example: "Built {project} using {tech}; {n} source files confirm {tech} on GitHub"). Every bullet has `factIds` and proof links. No generated text, so nothing can be invented.
- **Tiers:** *verified* (evidence) goes in; *self-reported* (employer, dates, degree) goes in, labelled; *unsupported* skills are **blocked** and returned with the reason and the action that would fix it.
- **Output:** JSON plus a single-column ATS HTML page with print CSS sized to one page (the page drops the lowest-relevance bullets until a line budget fits).
- **Claim check for an uploaded resume** (`GET /students/me/resumes/:id/claim-check`): lists every resume skill and project technology with the existing verdict (`verified`, `partially_verified`, `needs_review`, `unsupported`, `unverified`), flags the unsupported ones, and returns counts.
- **Endpoints (STUDENT):** `POST /jobs/:jobId/resume`, `GET /students/me/resumes/:id/claim-check`. Applying (`POST /jobs/:jobId/applications`) stores `fitScore`, `fitSnapshot` and `resumeSnapshot`.
- **Tests:** every bullet has a `factId`; unsupported skills never appear in the skills section; one-page budget; same input gives same output.

## 4. Pipeline and batch ranking

- **Transitions** (`pipeline/transitions.ts`, pure): `APPLIED` to `IN_REVIEW` to `SHORTLISTED` to `INTERVIEW_SCHEDULED` to `INTERVIEWING` to `OFFERED` to `HIRED`; `REJECTED` from any non-terminal status; `WITHDRAWN` only by the student. Invalid move returns 409 with the allowed next statuses. UI stages: Applied, Interview, Offer, Closed.
- **Placement endpoints:** `GET /placement/applications?stage=&jobId=` (board data), `PATCH /placement/applications/:id/status`.
- **Batch rank:** `POST /placement/rank` with `{ jobId | jobDescription, filter: { institutionId?, branch?, graduationYear?, minCgpa? }, limit }`. Parses the JD (nothing saved), loads all students in the filter with their skills in one query, ranks in memory, returns rank, fit, band, eligibility, matched, gaps and explanation per student. Ties: fit, verified required skills, CGPA.

## 5. Minimal recruiter portal (`routes/recruiterPortal.routes.ts`, mounted at `/recruiter`)

All routes: `authenticate`, `requireRole("RECRUITER")`, scoped to the recruiter's own company; another recruiter's data returns 404.

| Method and path | Function |
|---|---|
| `GET/PUT /recruiter/me` | company and recruiter profile (creates the company) |
| `GET /recruiter/jobs` | own jobs with applicant counts |
| `POST /recruiter/jobs` | create a draft from structured fields or `{ jobDescription }` (parsed) |
| `PATCH /recruiter/jobs/:id` | edit fields and skills |
| `POST /recruiter/jobs/:id/publish` / `close` | status (publish needs a title, a description and at least one required skill) |
| `GET /recruiter/jobs/:id/applicants` | **ranked shortlist** by fit, with matched, gaps, claim-check counts and status |
| `GET /recruiter/applications/:id` | applicant evidence view: skills with scores and proof, resume snapshot, timeline |
| `PATCH /recruiter/applications/:id/status` | validated transition, writes an `ApplicationEvent` |

## 6. Seed (`backend/prisma/seed.ts`)

Skills and aliases, a placement user, 2 recruiters with companies, about 12 synthetic students with varied evidence (strong, padded, GitHub-only), about 10 jobs including cross-source duplicates, and a few applications at different stages. Prints demo logins. Not run automatically.

## 7. Frontend (minimum screens)

- **Student:** job cards show fit; job detail shows fit, explanation and gaps; "Build resume" page (preview, blocked claims, print to PDF); claim check on the Resume page; applications page shows the stage timeline.
- **Recruiter:** profile, my jobs, post job (paste JD, review skills, publish), job detail with ranked applicants and status buttons.
- **Placement:** ingest (paste and API pull), batch rank, pipeline board.
- Sign-up gets a Placement option.

## Build order

1. Foundations (fixes, taxonomy, schema, score persistence, placement role)
2. Ingestion, matching, pipeline transitions (pure modules and tests first)
3. Resume builder and claim check
4. Placement, recruiter and student endpoints
5. Seed
6. Frontend screens
7. Rehearse the demo

## Acceptance

- The same opening pasted twice (worded differently) and pulled from the API is one job with several sources; "ReactJS", "React.js" and "React" are one skill.
- Each student and job pair shows a fit score, explanation and gaps with actions.
- The generated resume has an evidence id on every bullet and never contains an unsupported skill; an uploaded resume gets a claim check.
- Status changes are validated and logged; students, recruiters and placement see the same timeline.
- Placement ranks a batch for one pasted JD; the recruiter sees a ranked shortlist.
- `bun test` passes, `bunx tsc --noEmit` is clean, a clean clone installs.

## New environment variables

```
PLACEMENT_SIGNUP_CODE=
INGEST_USE_FIXTURES=false
GITHUB_TOKEN=            # strongly recommended for the demo
```
