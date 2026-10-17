# Project Context: call-of-code ("PlacementHub")

Snapshot of what already exists in this repo (branch `scoring_workflow`, based on commit `68ee43b`, the merge of PR #12 "StudenProfile" / "Intigrate end to end feature", plus the uncommitted per-skill scoring work). Use it to orient quickly before adding features.

## What the product is

A campus-placement platform ("PlacementHub", backend package name `kurukshetra-backend`) built for a 24-hour hackathon. Two roles exist, `STUDENT` and `RECRUITER`, but **only the student side is built**. A student can:

1. Register and sign in.
2. Fill in a profile (institution, branch, CGPA, GitHub, LinkedIn).
3. Upload a PDF/DOCX resume, which Gemini parses into structured skills, projects and experience, and which auto-fills their skill list.
4. Manage skills and portfolio projects.
5. Take an AI-generated skill assessment based on the resume and get a scorecard.
6. Browse job postings and apply or withdraw.

There is also a backend-only GitHub-verification module, and a **per-skill scoring** layer that combines each skill's assessment score with its GitHub evidence (see "Per-skill scoring"). Recruiter features (posting jobs, reviewing applicants) are not built.

## Project brief (the requirement this repo is building toward)

Sponsored by TechSummitTrainers. Freshers send one generic resume full of claims they cannot back up, placement teams forward openings by hand over WhatsApp, and companies want shortlists they can trust. The platform should match students to openings on **verified evidence of their skills** and help them apply with tailored, entirely truthful resumes.

1. **Openings:** collect from multiple sources (partner postings, alumni referrals, legitimate job APIs), recognise the same opening arriving from more than one source, and parse each into required and preferred skills, normalising variants ("ReactJS", "React.js", "React").
2. **Evidence-based skill profile:** built from assessment scores, evaluated projects and actual GitHub work, with every skill linked to its proof.
3. **Matching:** a fit score and a plain-language explanation for each student-opening pair, with the specific gaps.
4. **Truthful resume:** for any opening, a one-page ATS-friendly resume where every bullet is traceable to evidence; block or flag any unsupported claim, including false claims in a resume the student uploads.
5. **Pipeline:** students and the placement team track every application (applied, interview, offer); the team can take one job description and rank an entire batch by evidence-backed fit.
6. **Optional:** a recruiter portal with ranked shortlists, alumni mapped at each company for referrals, and a company-wise bank of real interview questions from post-interview reports.

### Coverage today

| Requirement | State |
|---|---|
| 1. Openings: multi-source ingestion, deduplication, skill parsing | **Not built.** Only the schema (`JobPosting`, `JobSource` with a `fingerprint`, `JobSkillRequirement` required or preferred). No ingestion, no job creation, and skill normalisation is a tiny alias table. |
| 2. Evidence-based skill profile | **Partly built.** Assessment (AI quiz), GitHub verification and the per-skill verification verdict exist and link each skill to its proof (question ids, commit-pinned file URLs). The verdicts are **saved to `StudentSkill.verificationStatus` and `SkillEvidence`** (see "Persistence"). Projects can be created but are **not evaluated**. |
| 3. Matching with a fit score and gaps | **Not built.** |
| 4. Tailored truthful resume; flag unsupported claims | **Partly built.** The skill verification flags unsupported skills on the resume (`unsupported`, `unverified`, `needs_review`). Not covered: claims about projects, features, experience or dates, and resume generation. |
| 5. Pipeline and batch ranking | **Partly built.** `Application` and `ApplicationEvent` exist, and students can apply, withdraw and view applications. No placement-team or recruiter side, no status changes, no batch ranking. |
| 6. Optional recruiter portal, alumni, interview bank | **Not built.** |

## Repo layout

```
call-of-code/
├── package.json        root scripts: `bun run dev` runs backend + frontend via concurrently
├── CONTEXT.md          this file
├── backend/            Express 5 + TypeScript on Bun, Prisma 7 + Postgres (Supabase)
└── frontend/           React 19 + Vite + Tailwind 4 + react-router-dom 7
```

Package manager is **Bun** (`bun.lock` in the root, backend and frontend). The root `package.json` has only dev tooling (concurrently, husky, lint-staged).

## Running it

- Install in `backend/` and `frontend/` (`bun install`), then `cp backend/.env.example backend/.env` and fill it in.
- `bun run dev` from the root starts both. The backend runs on `:4000` under `/api/v1` and the frontend on Vite's default port (5173).
- Backend tests: `cd backend && bun test`. `bunfig.toml` preloads `tests/setup.ts`, which injects dummy env values.
- Frontend: `bun run dev | build | lint | preview`. The frontend reads `VITE_API_BASE_URL` (default `http://localhost:4000/api/v1`) in `api/student.ts` and `api/assessment.ts`; `api/auth.ts` still hard-codes the URL.
- Database: `prisma7.config.ts` is the Prisma CLI config. `backend/prisma/apply-schema.mjs` (`bun run prisma/apply-schema.mjs`) applies schema changes directly to the remote Supabase DB using `DATABASE_URL` read from `backend/.env`.
- Required backend env vars (config throws at startup if missing): `DATABASE_URL`, `JWT_ACCESS_SECRET` (at least 32 chars), `RECRUITER_SIGNUP_CODE`. `GEMINI_API_KEY` is required lazily on the first Gemini call.
- Optional env vars: `PORT`, `FRONTEND_URL` (also the CORS origin, default `http://localhost:5173`), `DIRECT_URL`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_TTL` (15m), `REFRESH_TOKEN_TTL_DAYS` (7), `RATE_LIMIT_*`, `GEMINI_MODEL` (default `gemini-2.5-flash`), `MAX_RESUME_SIZE_BYTES`, and the `GITHUB_*` settings listed under "GitHub verification".
- `config/index.ts` loads `backend/.env` with `override: true`, so values in the file win over shell env vars.

## Backend (`backend/src`)

### Entry and plumbing
- [server.ts](backend/src/server.ts) listens on `config.port`. [app.ts](backend/src/app.ts) wires cors (origin `config.allowed_origins`, credentials, methods GET/POST/PUT/PATCH/DELETE), helmet, a global rate limiter (100 requests per 15 min by default), cookie-parser, 1 MB body parsers, `GET /api/v1/health`, the `/api/v1` router, a 404 handler and the error handler.
- [config/prisma.ts](backend/src/config/prisma.ts) builds the PrismaClient with the `@prisma/adapter-pg` pool. It connects to `DATABASE_URL` with SSL (`rejectUnauthorized: false`) and logs the DB host on startup. The generated client goes to `backend/generated/prisma` (gitignored).
- [utils/apiError.ts](backend/src/utils/apiError.ts) defines `ApiError(message, statusCode, isOperational, code)` and `errorHandler`. Error shape is `{ error: true, message, code? }`, plus `stack` when `NODE_ENV=development`. The old `.status` getter was removed, so use `.statusCode`.
- [utils/fileStorage.ts](backend/src/utils/fileStorage.ts) has disk-storage and magic-byte helpers for resumes but is not used by the current upload flow (resumes are parsed from memory and never stored as files).
- [middleware/upload.ts](backend/src/middleware/upload.ts) is multer in-memory storage, 10 MB limit, filtered to PDF, DOC and DOCX.

### Routes (all mounted under `/api/v1`, see [routes/index.ts](backend/src/routes/index.ts))

Mounted: `/auth`, `/students`, `/jobs`, `/institutions`, `/assessments`, plus `/ping` and `/health`.

| Route | Auth | Purpose |
|---|---|---|
| `POST /auth/register` | none | email, name, password, optional role and `invitationCode`. A code matching `RECRUITER_SIGNUP_CODE` makes the user a RECRUITER. |
| `POST /auth/login` | none | optional `role` check (403 if the account's role differs) |
| `POST /auth/refresh` | refresh cookie | rotates the refresh token and returns a new access token |
| `POST /auth/logout` | refresh cookie | revokes the session and clears the cookie |
| `GET /auth/me` | Bearer | current user |
| `GET /auth/recruiter-check` | Bearer + RECRUITER | demo role-guard route |
| `GET /institutions` | none | list institutions; seeds the four fixed ones if the table is empty, and falls back to the fixed list if the DB errors |
| `GET /jobs` | optional | published-job browse; query `search`, `location`, `workMode`, `employmentType`, `page`, `limit` (max 50) |
| `GET /jobs/:jobId` | optional | job details with company, skill requirements and eligibility |
| `POST /jobs/:jobId/applications` | STUDENT | apply (body `resumeUrl?`); 409 if already applied, 400 if the job is `CLOSED` |
| `GET/PUT /students/me/profile` | STUDENT | read and update the profile (zod validated; empty strings become null) |
| `POST /students/me/resume` | STUDENT | multipart field `resume`; parse and save (see below) |
| `GET /students/me/resumes` | STUDENT | the student's parsed resumes with a skills summary |
| `GET /students/me/resumes/:id`, `GET /students/resumes/:id` | STUDENT | one parsed resume |
| `DELETE /students/me/resumes/:id` | STUDENT | delete a parsed resume |
| `GET/POST /students/me/skills`, `DELETE /students/me/skills/:skillId` | STUDENT | list (optional `?resumeId=`), add and remove skills |
| `GET/POST /students/me/projects`, `GET/PATCH/DELETE /students/me/projects/:projectId` | STUDENT | portfolio project CRUD |
| `GET /students/me/applications`, `GET /students/me/applications/:id`, `POST .../:id/withdraw` | STUDENT | the student's applications |
| `POST /assessments/generate` | Bearer | body `{ resumeId }`; returns `{ sessionId, totalQuestions, timeLimit, skills }` |
| `GET /assessments/:sessionId/questions` | Bearer | client-safe questions plus `remainingSeconds` |
| `POST /assessments/:sessionId/submit` | Bearer | body `{ answers: { [questionId]: answer } }`; grades and returns the scorecard |
| `GET /assessments/:sessionId/scorecard` | Bearer | the stored scorecard |
| `GET /assessments/:sessionId/skill-scores` | Bearer | per-skill assessment, GitHub and combined scores, without calling GitHub (graded sessions only) |
| `POST /assessments/:sessionId/skill-scores` | Bearer | same, but first runs GitHub verification; body `{ githubUsername? }`; 5 per 10 min per user |

All `/students/*` routes use `authenticate` then `requireRole("STUDENT")`.

### Auth ([services/auth.service.ts](backend/src/services/auth.service.ts), [middleware/](backend/src/middleware))
- Passwords are hashed with Argon2id (`@node-rs/argon2`).
- Access token is a 15-minute HS256 JWT (`jose`) with issuer, audience and `sub`.
- Refresh token is an opaque 48-byte value stored as a SHA-256 hash in `AuthSession`. It is sent as an HttpOnly cookie scoped to path `/api/v1/auth`. Tokens rotate on each refresh and share a `tokenFamily`. Reusing a revoked token revokes the whole family.
- `authenticate` verifies the Bearer token and reloads the user from the database on every request. `requireRole(...roles)` checks `req.user.role`. [types/express.d.ts](backend/src/types/express.d.ts) types `req.user`.
- Validation is zod in [validators/auth.validator.ts](backend/src/validators/auth.validator.ts) (password 8-128 chars, email lowercased).

### Student services ([services/](backend/src/services))
- `student.service.ts`: get and update the profile (creates a bare profile if missing) and `FIXED_INSTITUTIONS`, four hard-coded institutions (DPU Pune, IIT Bombay, COEP, PICT).
- `resume.service.ts` (`saveResume`):
  1. Extracts text (PDF via `pdf-parse`, DOCX via `mammoth`).
  2. Parses it with Gemini.
  3. Stores the structured result in `ParsedResume` (the raw file is not stored).
  4. Auto-syncs each parsed skill into `Skill` and `StudentSkill`, as `SELF_DECLARED` at `INTERMEDIATE`.
  5. Links each skill to the resume through a `SkillEvidence` row whose `sourceUrl` holds the resume id.
  Also `listResumes`, `getResumeById` (owner, or any recruiter) and `deleteResume`. It exports `getParsedResume(id)`.
- `skill.service.ts`: resolves skills by name or alias, creates custom skills, and lists, adds and removes `StudentSkill`. `mapVerificationStatus` maps `EVALUATED` to `VERIFIED`, `REPOSITORY_OBSERVED` to `OBSERVED`, and everything else to `UNVERIFIED`.
- `project.service.ts`: project CRUD with tech-stack skills (`ProjectSkill`).
- `job.service.ts`: browse and detail jobs, apply (creates an `Application` plus an initial `ApplicationEvent` atomically), list applications and withdraw. `applyForJob` accepts its two id arguments in either order and works out which is the job id by lookup. It auto-creates a student profile and attaches a default institution if needed.
- `validators/student.validator.ts`: zod schemas for profile, skill, project, apply and job-list query (GitHub username regex, CGPA 0-10, graduation year 2020-2035). `services/index.ts` is empty.

### Resume parsing ([resume/](backend/src/resume))
- `extractText.ts` detects the file type by magic bytes, uses `pdf-parse` for PDFs (adds `[Page N]` markers) and `mammoth` for DOCX, and rejects files with fewer than 50 characters of text (scanned PDFs).
- `parseResume.ts` makes one Gemini structured-output call at temperature 0 and validates it with zod, with up to 3 attempts and input capped at 60k characters.
  - **Model fallback:** it tries `GEMINI_MODEL`, then `gemini-3.8-flash`, `gemini-2.5-flash`, `gemini-2.0-flash` and `gemini-1.5-flash`, moving on only for not-found errors. If all fail it lists available models and tries each.
  - **Heuristic fallback:** if Gemini keeps failing in production, it silently returns a keyword-based skill extraction (about 30 known skills, GitHub profile links, no projects or experience). In unit tests, where a custom `generate` is passed, it throws the real `ApiError` instead.
- `schema.ts` is the zod schema for `llmResumeSchema` and `ParsedResume`; `SCHEMA_VERSION` is `"1.0"`. A skill has `claim_type`: `listed_skill`, `project_technology` or `experience_technology`. Projects have `features`, `repository_urls` and evidence. Experience has dates and responsibilities. Links are split into GitHub profiles, GitHub repos and portfolios.
- `normalize.ts` applies a tiny alias map (React, TypeScript, Node.js, PostgreSQL) and cleans URLs to https.

### Assessment ([assessment/](backend/src/assessment))
Self-contained module, rewritten in the latest merge. It holds no DB state: sessions are in memory only.
- `routes.ts`: the four endpoints above, all behind `authenticate`. Session ownership is checked in the service: 404 for a missing or expired session, 403 for someone else's.
- `service.ts`:
  - **Generate:** loads the user's `ParsedResume` (404 if not theirs) and takes up to 12 unique skill names (falls back to `StudentSkill` rows, then to generic topics). Gemini returns 6-12 questions. If Gemini fails or returns fewer than 4 questions, a deterministic fallback question bank is used instead. The session has a 30-minute time limit and a 1-hour TTL.
  - **Submit:** saves the answers and sends all questions to Gemini in a single grading call. Points are clamped to each question's max. Any question Gemini did not grade falls back to local grading (MCQ matched against the key, with a heuristic for free text). The scorecard has per-question grades, a per-skill breakdown, a letter grade, summary, strengths and improvements. If the session is already graded, the cached scorecard is returned.
- `prompts.ts`: system prompts and prompt builders. Question types are `MCQ`, `SHORT_ANSWER` and `CODE_ANALYSIS`. Points are EASY 5, MEDIUM 10, HARD 15. At least 40% of questions are MCQ and at least one is code analysis.
- `gemini.ts`: its own `generateJSON(system, user)` with a 60 s timeout, thinking disabled, temperature 0.3, and a model fallback list (`gemini-2.5-flash`, `gemini-3.8-flash`, `gemini-2.0-flash`) that moves on only for not-found errors.
- `store.ts`: in-memory `Map` with a 1-hour TTL and a 5-minute sweep. Sessions are lost on restart and are not shared across instances.
- `types.ts`: question, session, scorecard and API shapes.

### GitHub verification ([github/](backend/src/github))
Checks the claims in a parsed resume against the candidate's **public** GitHub repos. It is secondary evidence only: it never changes an assessment score (the report always has `assessment_score_changed: false`) and never claims to prove skill or authorship. Entry point is `verifyGithub({ resume, username?, profileUsername? })` in `verify.ts`.

- `identify.ts`: parses and validates GitHub usernames, profile URLs and repo URLs (`github.com/{owner}/{repo}`), and normalizes names for matching ("Web-Escape" matches "web_escape").
- `claims.ts`: turns a `ParsedResume` into skill claims (deduplicated by canonical name, with resume references) and project claims (technologies, feature count, repo URLs).
- `client.ts`: `GithubClient` is a thin REST wrapper with timeouts, bounded retries and pagination, and a per-run request budget. It has a 5-minute in-memory cache shared across runs (500 entries), and distinct `GithubError` kinds (not_found, forbidden, rate_limited, budget_exhausted, timeout, network). The token is sent only in the Authorization header.
- `collect.ts`: for each repo, reads metadata, the file tree and dependency manifests (package.json, requirements.txt, pyproject.toml, go.mod, Cargo.toml, pom.xml, gradle), and samples a capped number of source files. It skips vendored, generated, minified and `.env` files. Private repos are never read.
- `catalog.ts`: the deterministic rule table for each technology (packages, config files, source patterns, file extensions, GitHub language names). A technology missing from the catalog is reported as `not_checked`, never guessed.
- `detect.ts`: pure evidence detection. Observation text is generated by the code and never copied from repo text, which makes it safe against prompt injection. Language statistics alone can never reach `supported`; a dependency alone is `partially_supported`; a dependency plus source usage is `supported`.
- `verify.ts`: orchestration:
  1. Resolve the username in this order: request, resume profile link, student profile, or the single owner of repo links on the resume.
  2. Fetch the profile (404 if missing, 422 if it is an organization, 503 on rate limit).
  3. List repos (up to 3 pages).
  4. Match each project to a repo by linked URL, then exact name, then approximate name. Forks are flagged and cap a project at `needs_review`.
  5. Collect evidence per repo, with a per-run repo limit that is disclosed in the report.
  6. Build claim-level statuses (`supported`, `partially_supported`, `insufficient_evidence`, `needs_review`, `not_accessible`, `not_checked`) with traceable evidence. Evidence URLs are pinned to a commit SHA.
- `types.ts`: the report contract (`VerificationReport`, `Claim`, `Evidence`, `RepositorySummary`). A rate limit mid-run yields an incomplete report rather than an error.
- Settings (in `config`, all optional env vars): `GITHUB_TOKEN` (none by default), `GITHUB_TIMEOUT_MS` (10000), `GITHUB_MAX_REQUESTS` (150 per run), `GITHUB_MAX_REPOS` (6), `GITHUB_MAX_FILES_PER_REPO` (12), `GITHUB_MAX_FILE_BYTES` (100000).
- `VerificationReport` has an `incomplete: boolean` flag (true when a rate limit, request budget or repo-listing failure stopped collection early).
- **HTTP access:** the only mounted way to run it is `POST /assessments/:sessionId/skill-scores` (see below). The old `POST /resumes/:id/github-verification` endpoint still sits in [routes/resume.ts](backend/src/routes/resume.ts), but that router is no longer mounted.

### Per-skill scoring ([scoring/skillScoring.ts](backend/src/scoring/skillScoring.ts), [assessment/skillScores.ts](backend/src/assessment/skillScores.ts))
Implements `backend/per-skill-github-assessment-scoring-implementation.md`. Each skill gets an assessment score, a GitHub evidence score and a combined score. Grading and the GitHub verifier are unchanged; this layer only composes their output.

- **Pure module** `scoring/skillScoring.ts` (no network, database or LLM), with all tunable values in named constants:
  - **Scale:** every score is an integer 0-100 (`roundScore`: clamp, then round). `null` means unavailable, never zero.
  - **Assessment score:** `100 * earned / possible` per skill, using total marks (not an average of percentages). A skill with no questions has `null`. A question mapped to several distinct skills splits its earned and possible marks equally. Skills are matched by canonical key (`skillKey`, which reuses the resume alias table), so "ReactJS" and "React" are the same skill.
  - **GitHub score** (`GITHUB_STATUS_SCORE`): `supported` is 100, `partially_supported` is 60, and `insufficient_evidence`, `needs_review`, `not_accessible` and `not_checked` are `null`. It is built from the report's skill claims, which already aggregate evidence across repos. Duplicate claims for a skill are merged and their evidence deduplicated, so repeats never inflate the score. Evidence is looked up by exact canonical key, so React evidence never counts for TypeScript. Only dependency, source, configuration and file-presence evidence is exposed; language statistics and repository metadata are not.
  - **Evidence strength:** `high` is (dependency or configuration) plus source usage, `medium` is source or configuration alone, `low` is a dependency or file presence alone, and `unknown` is anything else, including every status that is not scored.
  - **Conflicts:** if a project's repo was inspected and showed no sign of a technology the project lists, a conflict note is attached to the skill instead of being hidden.
  - **Combined score** (`combineScores`, `SCORE_WEIGHTS` 0.8 and 0.2): both scores exist gives `0.8 * assessment + 0.2 * github` (80 and 100 gives 84, 80 and 60 gives 76). Only the assessment score exists gives that score alone (80 stays 80). No assessment score gives `null`, even if GitHub evidence exists. It uses the rounded component scores.
  - `buildCombinedSkillResults` returns one `CombinedSkillResult` per skill (assessment score, GitHub score, combined score, `githubStatus`, `evidenceStrength`, `evidenceSummary`, `evidenceUrls`, raw marks, evidence refs with repo URL, evidence URL and commit SHA, conflicts, resume references). Assessed skills come first. `githubStatus` is `not_run` when no report is available, and `not_checked` for an assessed skill the report did not cover.
- **Composition** `assessment/skillScores.ts` (`buildSkillScores`): reads the graded scorecard's `questionResults`. A GitHub failure never fails the request: it returns assessment-only scores with `github.state = "failed"` and an error code. Failures are not cached, and a failed re-run keeps an earlier good report. Successful and incomplete reports are stored on the in-memory session (`githubReport`, `githubState`). `github.state` is `completed`, `incomplete`, `not_run` or `failed`.
- **Endpoints** (in `assessment/routes.ts`; the session must already be graded, otherwise 409):
  - `GET /assessments/:sessionId/skill-scores`: makes no GitHub requests; uses the stored report if there is one.
  - `POST /assessments/:sessionId/skill-scores`: body `{ githubUsername? }`. Explicitly runs `verifyGithub` for the session's resume, using the profile's `githubUsername` as a fallback. Limited to 5 per 10 min per user.
- GitHub verification is deliberately **not** run on every assessment submission, because it has rate limits and can fail independently.
- **Verification verdict per resume skill** (`verifySkill`, thresholds `VERIFICATION_THRESHOLDS` pass 60 and fail 40). This is the skill-verification method: it checks **every skill listed on the resume**, not only the assessed ones. The routes pass the resume's full skill list (from `extractClaims`), so a skill that was never assessed and that GitHub could not check still shows up, flagged. Skills are matched through the alias table, so "ReactJS" and "React" are one skill.

  | Verdict | Rule | Flagged |
  |---|---|---|
  | `verified` | assessment at least 60 **and** GitHub evidence | no |
  | `partially_verified` | one positive source only (assessment at least 60, or GitHub evidence only, or assessment 40-59 with GitHub evidence) | no |
  | `needs_review` | assessment below 40 but GitHub shows use (sources disagree) | yes |
  | `unsupported` | assessed below 60 with no GitHub evidence | yes |
  | `unverified` | no assessment and no GitHub evidence (not assessed, not checkable, or GitHub not run) | yes |

  `unsupported` and `unverified` mean "not backed by evidence yet", never "proven false". Each result also carries its proof: `assessmentPoints`, `assessmentQuestionIds`, GitHub `evidence` refs (repo URL, file URL, commit SHA), `resumeReferences` (where the resume claimed it), and `conflicts`. The response has a `verification` summary (counts per verdict plus `flagged`) and the `thresholds` used.
- **Frontend:** `SkillVerificationPanel` is shown on the assessment scorecard (see Frontend).

#### Persistence ([scoring/skillPersistence.ts](backend/src/scoring/skillPersistence.ts), [services/skillEvidence.service.ts](backend/src/services/skillEvidence.service.ts))
Scored skills are written to the student's skill profile, so matching and recruiter views can read them later.

- **When:** (1) right after an assessment is graded (`POST /assessments/:id/submit`), with assessment-only scores, and (2) on every `POST /assessments/:id/skill-scores`, with the GitHub evidence. A failed save is logged and never fails the request; the POST response carries a `persistence` summary (`skills`, `evidenceCreated`, `evidenceUpdated`, `statusesChanged`, `failed`, or `{ error }`). `GET .../skill-scores` writes nothing.
- **`StudentSkill.verificationStatus`:**

  | Verdict | Saved status |
  |---|---|
  | `verified` | `EVALUATED` |
  | `partially_verified` with assessment at least 60 | `EVALUATED` |
  | `partially_verified` otherwise (GitHub only, or a moderate assessment) | `REPOSITORY_OBSERVED` |
  | `needs_review`, `unsupported` | `NEEDS_REVIEW` |
  | `unverified` | unchanged; a skill that was never verified is created as `SELF_DECLARED`, and an earlier verified status is never downgraded |

  The latest evidence wins, so a later low assessment can move a skill from `EVALUATED` to `NEEDS_REVIEW`.
- **`SkillEvidence` rows:**
  - **Assessment:** one `ASSESSMENT` row per skill per session, with `sourceUrl` `assessment:{sessionId}` (an identifier, not a browsable link). The description holds the score, points and question ids. Status is `EVALUATED` at 60 or above, `OBSERVED` at 40-59, and `REJECTED` below 40 (evaluated, and it did not support the claim).
  - **GitHub:** one `GITHUB_REPOSITORY` row per evidence item, with the commit-pinned file URL as `sourceUrl`, status `OBSERVED`.
  - **Idempotent:** rows are upserted by (student skill, source type, source URL), so re-running updates in place and never duplicates. A newer commit or a new session adds a new row, so history is kept.
  - The existing resume-link rows (`sourceType` `OTHER`, `sourceUrl` = resume id) are untouched.
- **Reading it back:** `GET /students/me/skills` now returns a `proof` array per skill (the assessment and GitHub rows). The Skills page does not display it yet.
- Design: `planSkillPersistence` (pure) builds the rows, and `applySkillPlan` applies them through a small `SkillEvidenceRepo` interface (Prisma in production, an in-memory fake in tests). One failing skill does not stop the others.

### Database ([prisma/schema.prisma](backend/prisma/schema.prisma))
Two migrations exist (`init` and `add_parsed_resume`). The latest merge changed `StudentProfile.institutionId` to optional and moved `Application.status`, but added no migration file. Changes are applied with `apply-schema.mjs`.

- **Used by code today:**
  - Users and sessions: `User` (role `STUDENT` or `RECRUITER`), `AuthSession`.
  - Resumes and profiles: `ParsedResume` (`data` is JSON of the parsed resume, with `schemaVersion`), `StudentProfile`, `Institution`.
  - Skills and projects: `Skill`, `SkillAlias`, `StudentSkill`, `SkillEvidence`, `Project`, `ProjectSkill`.
  - Jobs and applications (read and apply only): `JobPosting`, `Company`, `RecruiterProfile`, `JobSkillRequirement`, `JobEligibleBranch`, `JobEligibleGraduationYear`, `Application`, `ApplicationEvent`.
- **Schema only:** `JobSource`. Nothing in the app creates jobs or companies, so the job board is empty until rows are inserted manually. There is no seed script.
- **Enum values now set:** `SkillVerificationStatus` `EVALUATED`, `REPOSITORY_OBSERVED` and `NEEDS_REVIEW` are written by skill verification. `EvidenceSourceType` `ASSESSMENT` and `GITHUB_REPOSITORY` are used too; `PROJECT` and `CERTIFICATE` are still unused. The assessment scorecard itself (questions and answers) is still not stored in the DB; only the per-skill proof is.

### Tests ([backend/tests](backend/tests))
`bun test`; Gemini and GitHub are mocked.
- `resume.test.ts`: normalization, parse retries, schema failure, prompt-injection handling, file-type rejection.
- `github.test.ts`: uses a fake GitHub (injected `fetch`). Covers username and repo URL parsing, evidence strength rules, injection safety, the client (404 vs rate limit vs forbidden, pagination cap, request budget, token handling), and `verifyGithub` (missing profile, rate limits, private and inaccessible repos, forks, malformed package.json, repo limit, organization accounts).

- `skillPersistence.test.ts`: the verdict-to-status mapping, evidence rows (assessment score bands, commit-pinned GitHub rows, duplicates collapsed), and applying a plan to an in-memory repository (creates rows, idempotent re-runs, no downgrade for unverified skills, latest evidence wins, one failing skill does not block the rest, a new session adds a new assessment row).
- `skillScoring.test.ts`: assessment score math (total marks, null for unmapped skills, multi-skill split, aliases, bounds), GitHub status mapping, duplicate and alias handling, React not counting for TypeScript, evidence strength, conflicts, the 80/20 combined score and its null cases, every verdict and its flag, coverage of all resume skills (aliases merged, unassessed skills flagged, proof ids and references kept), and `buildSkillScores` (GitHub failure degrades to assessment-only, failures are not cached, incomplete reports, session ownership).
- `github.test.ts` also feeds real `verifyGithub` output into the scorer (supported evidence gives 84 for an 80% assessment, nothing found stays at the assessment score, a rate-limited run is `incomplete` and produces no zero scores).

The old assessment and Gemini-classifier tests were deleted with the old assessment code. There are no tests for the new assessment module, the student, job or auth routes, or the frontend.

## Frontend (`frontend/src`)

Stack: Vite 8, React 19, TypeScript, Tailwind 4 (`@tailwindcss/vite`), react-router-dom 7, ESLint. No state library.

- **Routes** ([App.tsx](frontend/src/App.tsx)):
  - Public pages under `MainLayout` (navbar and footer): `/` (HomePage), `/about`, `/jobs` (PublicJobsPage).
  - Auth pages: `/signin`, `/signup`.
  - Dashboard under `ProtectedRoute` and `DashboardLayout` (sidebar):

    | Route | Page |
    |---|---|
    | `/dashboard` | Overview |
    | `/dashboard/profile` | Profile |
    | `/dashboard/resume` | Resume upload and list |
    | `/dashboard/skills` | Skills |
    | `/dashboard/assessment` | AI Assessment |
    | `/dashboard/projects` | Projects |
    | `/dashboard/jobs` | Jobs |
    | `/dashboard/applications` | Applications |

  - Any other path redirects to `/`.
- **Auth** ([context/AuthContext.tsx](frontend/src/context/AuthContext.tsx), [api/auth.ts](frontend/src/api/auth.ts)): keeps `user` and `accessToken` in memory only, restores the session on load through the refresh cookie, and exposes `login`, `register`, `logout` and `checkSession`. `ProtectedRoute` redirects to `/signin` when signed out and supports an `allowedRoles` prop.
- **API modules:**
  - `api/student.ts`: a token-passing `request()` helper plus profile, institutions (with a hard-coded fallback list), resume, skill, project, job and application calls.
  - `api/assessment.ts`: `generateAssessmentApi`, `fetchAssessmentQuestionsApi`, `submitAssessmentApi`, `fetchAssessmentScorecardApi`, plus types mirroring the backend.
- **Assessment page** ([pages/dashboard/AssessmentPage.tsx](frontend/src/pages/dashboard/AssessmentPage.tsx), 832 lines): a local step machine `SELECT`, `GENERATING`, `RUNNER` (one question at a time with a countdown), `EVALUATING`, `SCORECARD`. The scorecard step now includes the skill verification panel between the skill breakdown and the question results.
- **Skill verification panel** ([components/SkillVerificationPanel.tsx](frontend/src/components/SkillVerificationPanel.tsx)): loads `GET /assessments/:id/skill-scores` on mount (no GitHub calls). It has an optional GitHub username box and a "Verify with GitHub" button, which calls the POST. It shows:
  - a GitHub status banner (`not_run`, `completed`, `incomplete`, `failed`);
  - a count per verdict and a "flagged only" filter;
  - one row per resume skill with its verdict badge, assessment, GitHub and combined scores, and the reason;
  - an expandable "Show proof" section with assessment points and question ids, resume references, evidence links to GitHub files at a commit, and conflicts.
  The API types and calls (`fetchSkillScoresApi`, `runSkillVerificationApi`) are in `api/assessment.ts`. The UI has not been run in a browser: `react-router-dom` is not installed in `frontend/node_modules` here, so only type and lint checks were done.
- **Layout and shared components:** `layout/Navbar`, `Footer`, `MainLayout`, `DashboardLayout`; `common/ProtectedRoute`, `StatusBadge`.
- **Unused leftovers:** `components/AuthCard.tsx`, `components/Dashboard.tsx` and `components/StudentModule.tsx` (879 lines) are no longer imported anywhere. The old assessment hook, screens and `api/assessmentApi.ts` were deleted.

## Known gaps and gotchas

- **Dead resume router:** `routes/index.ts` no longer mounts `routes/resume.ts` (`/resumes` and `/resumes/:id/github-verification`); the `/students/me/resume*` routes replaced it. GitHub verification is reachable only through `POST /assessments/:sessionId/skill-scores`, which needs a graded assessment session and is student-facing. A recruiter-facing or session-independent verification endpoint does not exist.
- **Typecheck is not clean:** `bunx tsc --noEmit` in `backend/` reports 25 errors in the student, job and auth code (zod `.errors` usage, `string | string[]` params, and similar). None are in the scoring, persistence, assessment or GitHub modules, and the tests are unaffected. If you see `institutionId` errors, regenerate the Prisma client (`bunx prisma generate --config prisma7.config.ts`): the schema made it optional but a stale generated client still required it.
- **Hidden AI fallbacks:** resume parsing, question generation and grading each fall back to heuristics or canned content when Gemini fails, without telling the user. A broken API key therefore still yields a "successful" resume parse (keyword skills only), a generic question bank and heuristic scores. Check server logs (`[ResumeParser]`, `[AssessmentService]`) to see which path ran.
- **Only the proof is persisted, not the scores:** `StudentSkill.verificationStatus` and the `SkillEvidence` rows survive restarts, but the numeric assessment, GitHub and combined scores and the full GitHub report still live on the in-memory session. The assessment row's description holds the score as text. A numeric, queryable score per skill (needed for ranking and matching) would need a schema change.
- **Persistence is untested against a real database:** the Prisma repository was type-checked, and the logic is tested with an in-memory fake, but nothing here has run against Postgres. Try one assessment end to end and check the `SkillEvidence` table.
- **Verification only covers skills, and only what the resume lists:** claims about project features, experience and dates are not verified, and the assessment covers at most 12 skills per run, so the rest show as `unverified` until GitHub covers them. Skills with no catalog rule (tools such as VS Code, or soft skills) can only ever be `unverified`.
- **Free-text grading fallback is weak:** if Gemini grading fails, free-text answers get heuristic scores, and the scorecard does not mark which questions were AI-graded versus heuristic. The per-skill assessment scores inherit this.
- **Invalid Gemini model name:** the fallback lists include `gemini-3.8-flash`, which may not exist. A not-found error just moves to the next model.
- **Sessions are in memory:** assessment sessions and scorecards are lost on backend restart, and results are never persisted. `GET .../scorecard` only works while the session lives.
- **Prisma schema vs migrations:** the schema changed (optional `institutionId`) without a migration file, and the app relies on `apply-schema.mjs` against the remote DB. A fresh `prisma migrate` would not match.
- **Loose TLS:** `config/prisma.ts` sets `ssl: { rejectUnauthorized: false }`.
- **Dependency changes:** the backend dropped `@node-rs/argon2`, `@prisma/adapter-pg` and `@supabase/supabase-js` from `package.json`, but the code still imports the first two (`auth.service.ts` and `config/prisma.ts`), so a clean install would fail to resolve them. Please check `backend/package.json` and `bun.lock`. TypeScript was also downgraded to `^5.8.3`.
- **Frontend API URLs:** `api/auth.ts` hard-codes `http://localhost:4000/api/v1`, while the other API modules honor `VITE_API_BASE_URL`.
- **Stray debug logging:** `auth.routes.ts` has `console.log(result)` in register (prints tokens), and `student.routes.ts` has `console.log("control reach here!!")` in the resume upload handler.
- **Job board is empty:** there is no recruiter UI, no job-creation route and no seed data.
- **GitHub rate limits:** without `GITHUB_TOKEN`, GitHub allows only 60 requests per hour, which is roughly one verification.
- **Unbuilt features:** see "Coverage today" in the project brief section: job ingestion and deduplication, matching and fit scores, truthful resume generation, the placement-team and recruiter side (posting jobs, status changes, batch ranking), project evaluation and evidence review.
- **Root `README.md`** is a one-liner and `backend/README.md` covers setup only. This file is the fuller description.
