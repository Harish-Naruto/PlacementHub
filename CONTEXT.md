# Project Context: call-of-code ("PlacementHub")

Snapshot of what exists in this repo (branch `scoring_workflow`). It now covers the whole brief: evidence-based skills, multi-source job ingestion with dedupe, fit scoring with gaps, a truthful resume builder, an application pipeline, a recruiter portal and a placement-team portal. Use it to orient quickly before adding features. The plan that produced this work is in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## What the product is

A campus-placement platform ("PlacementHub", backend package name `kurukshetra-backend`) built for a 24-hour hackathon. Three roles exist: `STUDENT`, `RECRUITER` and `PLACEMENT` (the placement team).

- **Student:** registers, fills in a profile, uploads a resume (Gemini parses it), takes an AI assessment, verifies GitHub, sees each opening with an evidence-backed **fit score, plain-language explanation and gaps**, builds a **tailored one-page resume where every line traces to evidence**, checks the claims in an uploaded resume, applies, and tracks the application on a pipeline.
- **Recruiter:** sets up a company, posts openings (paste a job description and it is parsed), publishes them, sees a **ranked, evidence-backed shortlist** of applicants with proof behind every skill, and moves applications through the pipeline.
- **Placement team:** ingests openings from partner postings, alumni referrals and a job API (the same opening arriving twice becomes one job with several sources), **ranks a whole batch against one pasted job description**, and runs the shared pipeline board.

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
| 1. Openings: multi-source ingestion, deduplication, skill parsing | **Built.** Partner paste, alumni referral and the Remotive API (with offline fixtures) go through one `ingestJob`. Skills are normalised through a shared taxonomy; exact and fuzzy dedupe merge repeats into one job with several `JobSource` rows. |
| 2. Evidence-based skill profile | **Built.** Assessment, GitHub verification and per-skill verdicts, now with the numeric scores stored on `StudentSkill`. Every skill links to its proof. Projects are **not** separately evaluated (project technologies are checked through the skills). |
| 3. Matching with a fit score and gaps | **Built.** `matching/fit.ts`: score, band, plain-language explanation, typed gaps with next actions, and eligibility flags kept separate from the score. |
| 4. Tailored truthful resume; flag unsupported claims | **Built.** `resumeBuilder/`: bullets are templates over evidence-backed facts, unsupported skills and claims are blocked with the reason and a fix, one-page budget, HTML output. `claimCheck.ts` flags unsupported skills, project technologies, features, metrics and impossible dates in an uploaded resume. |
| 5. Pipeline and batch ranking | **Built.** Validated status transitions with a logged history, a placement board, and `POST /placement/rank` for a whole batch. |
| 6. Optional recruiter portal, alumni, interview bank | **Recruiter portal built** (own company, jobs, ranked shortlist, status changes). Alumni mapping and the interview-question bank are **not built**. |

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
- Placement MVP env vars: `PLACEMENT_SIGNUP_CODE` (optional), `INGEST_USE_FIXTURES`, `JOB_PARSE_LLM`. After pulling this work: apply `prisma/migrations/20261017120000_placement_mvp/migration.sql` (see "Database") and optionally run `bun run prisma/seed.ts` for demo data.
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

Mounted: `/auth`, `/students`, `/jobs`, `/institutions`, `/assessments`, `/placement`, `/recruiter`, plus `/ping` and `/health`. The new endpoints are listed under "Placement MVP" below.

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

- **When:** (1) right after an assessment is graded (`POST /assessments/:id/submit`), with assessment-only scores, and (2) on every `POST /assessments/:id/skill-scores`, with the GitHub evidence. The save after grading runs **in the background** (the scorecard response does not wait for it); the POST waits for it so it can report the result. Skills are written 6 at a time (`PERSIST_CONCURRENCY`), and a skill's evidence rows in parallel, because each skill is several round-trips to a remote database. A failed save is logged and never fails the request; the POST response carries a `persistence` summary (`skills`, `evidenceCreated`, `evidenceUpdated`, `statusesChanged`, `failed`, or `{ error }`). `GET .../skill-scores` writes nothing.
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

### Placement MVP (skills, openings, matching, resume builder, pipeline, portals)

Pure logic lives in dedicated folders (no database, network or LLM, all unit tested); services own the Prisma calls; routes are thin. New routes use Express 5 async handlers without try/catch and `validate(schema, data)` from [utils/params.ts](backend/src/utils/params.ts), which throws a 400 with every message.

- **Skill taxonomy** ([skills/](backend/src/skills)): `taxonomy.ts` is the one vocabulary (about 110 skills; `aliases` are safe to scan for in free text, `lookupOnly` aliases such as "Go" or "Express" only match a whole name). `canonical.ts` has `canonicalSkill(name)` ("ReactJS", "React.js", "React" give React; Java and JavaScript stay distinct) and `findSkillMentions(text)` (longest name wins, "Chart.js" is not JavaScript). `resume/normalize.ts#canonicalize`, `scoring/skillScoring.ts#skillKey`, the GitHub catalog lookup and `skill.service#resolveOrCreateSkill` all use it.
- **Openings** ([jobs/](backend/src/jobs), [services/ingest.service.ts](backend/src/services/ingest.service.ts)):
  - `parseJob.ts`: `parseJobRules` (always available: required vs preferred sections and phrases, CGPA, batch years, branches, deadline, work mode, type, title and company guesses) and `parseJob` (Gemini first when `GEMINI_API_KEY` is set and `JOB_PARSE_LLM` is not `false`, rules on any failure; `parseMethod` records which ran).
  - `dedupe.ts`: `dedupeKey` = sha1 of normalised company, title tokens (developer = engineer, skill aliases canonicalised) and city. A match is **exact** (same key) or **fuzzy** (same normalised company, `0.6 * title Jaccard + 0.4 * skill overlap` of the shorter list, at least 80, never across two different real cities; a remote listing fits any city). A merge adds a `JobSource` (unless the same labelled partner already sent it), bumps `sourceCount` and unions skills (required beats preferred).
  - `ingestJob` resolves the company by normalised name, ignores an identical re-import (`JobSource.fingerprint`), and publishes immediately unless no skills were found (then a draft). `ingestFromApi("remotive")` reads `fixtures/jobs/remotive.json` when `INGEST_USE_FIXTURES=true` or the network fails.
- **Matching** ([matching/fit.ts](backend/src/matching/fit.ts), [rank.ts](backend/src/matching/rank.ts), [branches.ts](backend/src/matching/branches.ts), [services/match.service.ts](backend/src/services/match.service.ts)): skill credit is the stored combined score / 100; GitHub-only evidence is capped at 0.5; self-declared or missing is 0. `fit = round(100 * sum(weight * credit) / sum(weight))` with weight = requirement weight x (REQUIRED 1.0, PREFERRED 0.25). Bands: Strong 70, Good 50, Partial 30, Low. A job with no skills has a `null` fit. Gaps are typed (`missing`, `claimed_only`, `weak`, `observed_only`) with a next action; the explanation is a template over the result so it cannot name a skill that is not in the inputs. Eligibility (CGPA, branch via aliases, batch, deadline) is reported as flags and never changes the score; missing profile data is "unknown", not a failure. Ranking: eligible first, then fit, required skills demonstrated, CGPA, name.
- **Resume builder** ([resumeBuilder/build.ts](backend/src/resumeBuilder/build.ts), [claimCheck.ts](backend/src/resumeBuilder/claimCheck.ts), [services/resumeBuilder.service.ts](backend/src/services/resumeBuilder.service.ts)): tiers are *verified* (evidence), *self-reported* (education, descriptions the student attests; still checked) and *blocked*. A skill is usable when its stored status is `EVALUATED` or `REPOSITORY_OBSERVED`. Project bullets list only verified technologies; a project with none is blocked. A free-text line that names an unverified skill, or states a number that cannot be verified (percentages, "10k users", "team of 10"), is blocked. Output: skills ordered by job relevance, up to 3 projects and 2 roles, a 48-line budget that drops the least relevant bullets first (recorded in the ledger), every bullet with `factIds` and `proof`, plus a standalone single-column HTML page. No LLM is involved, so output is deterministic.
- **Pipeline** ([pipeline/transitions.ts](backend/src/pipeline/transitions.ts), [services/pipeline.service.ts](backend/src/services/pipeline.service.ts)): `APPLIED, IN_REVIEW, SHORTLISTED, INTERVIEW_SCHEDULED, INTERVIEWING, OFFERED, HIRED` forward (skipping allowed, HIRED only after OFFERED), `REJECTED` from any open status, `WITHDRAWN` only by the student. UI stages: Applied, Interview, Offer, Closed. `changeApplicationStatus` validates, updates guarded by the old status (a concurrent change gets 409 `STALE_STATUS`) and writes an `ApplicationEvent` in one transaction.
- **Applying** ([services/job.service.ts](backend/src/services/job.service.ts)): published jobs only; a student outside the CGPA, branch, batch or deadline rules gets 422 `NOT_ELIGIBLE` with the reasons; the application stores `fitScore`, `fitSnapshot` and `resumeSnapshot` (the evidence-backed resume and its claim summary as sent). Job list and detail return one `company` (ingested jobs have no recruiter).
- **Job admin** ([services/jobAdmin.service.ts](backend/src/services/jobAdmin.service.ts)): shared edit and status changes (publish needs a title, description and a required skill, and a deadline not in the past; closed stays closed; only a draft without applicants can be deleted). A recruiter's calls are scoped to their own jobs.
- **Recruiter portal** ([routes/recruiterPortal.routes.ts](backend/src/routes/recruiterPortal.routes.ts), [services/recruiterPortal.service.ts](backend/src/services/recruiterPortal.service.ts)), role `RECRUITER`, everything scoped to the recruiter's company (another recruiter's data is a 404):

  | Route | Purpose |
  |---|---|
  | `GET/PUT /recruiter/me` | company and recruiter profile (name locked after the first save; joins an existing company of the same normalised name) |
  | `GET/POST /recruiter/jobs`, `GET/PATCH/DELETE /recruiter/jobs/:id` | own jobs; create from `{ jobDescription }` (parsed) or fields; warns about a possible duplicate |
  | `POST /recruiter/jobs/:id/publish|pause|close` | status |
  | `GET /recruiter/jobs/:id/applicants?stage=&minFit=&eligibleOnly=` | **ranked shortlist** with fit, matched, gaps, claim summary |
  | `GET /recruiter/applications/:id` | applicant evidence view: skills with proof, fit now and at apply, resume snapshot, timeline |
  | `PATCH /recruiter/applications/:id/status` | validated transition with a note |

- **Placement portal** ([routes/placement.routes.ts](backend/src/routes/placement.routes.ts), [services/placement.service.ts](backend/src/services/placement.service.ts)), role `PLACEMENT`:

  | Route | Purpose |
  |---|---|
  | `POST /placement/ingest/paste` | partner or alumni posting text, with optional `company`, `title`, `location`, `sourceLabel` |
  | `POST /placement/ingest/api` | pull from Remotive (or its fixtures) |
  | `GET /placement/jobs`, `GET/PATCH /placement/jobs/:id`, `POST /placement/jobs/:id/publish|pause|close` | review and fix parsed openings |
  | `POST /placement/rank` | rank a batch against `{ jobId }` or a pasted `{ jobDescription }` (never saved), with institution, branch, batch and CGPA filters |
  | `GET /placement/applications`, `GET /placement/applications/:id`, `PATCH /placement/applications/:id/status` | the shared pipeline board |
  | `GET /placement/students`, `GET /placement/stats` | readiness table and dashboard counts |

- **Student additions:** `GET /jobs?withFit=true` (cards with a fit, sorted by it), `GET /jobs/:id/fit`, `POST /jobs/:id/resume`, `GET /students/me/resumes/:id/claim-check`, `GET /students/me/recommendations`.
- **Auth:** `PLACEMENT` is a third role. `RECRUITER_SIGNUP_CODE` and the new optional `PLACEMENT_SIGNUP_CODE` are the only way to register as those roles; asking for a privileged role without its code is a 403 (this used to create a recruiter without any code).
- **Seed** ([prisma/seed.ts](backend/prisma/seed.ts), `bun run prisma/seed.ts`): SYNTHETIC demo data and idempotent. Skills and aliases, a placement user, two recruiters with companies, 12 students (strong, padded, GitHub-only, low CGPA, wrong branch, wrong batch), one Acme opening that arrives from four places and ends up as one job, five API fixture jobs, and applications at several stages. Password for every demo account is `Demo@12345` (emails end in `@demo.placementhub.test`; the script prints them). It writes to the database in `backend/.env`.

### Database ([prisma/schema.prisma](backend/prisma/schema.prisma))
Migrations: `init`, `add_parsed_resume` and `20261017120000_placement_mvp` (idempotent SQL: `PLACEMENT` role, score columns on `StudentSkill`, job ingestion fields, application snapshots). The remote database also drifted earlier (optional `institutionId`) without a migration file, so apply the new one with the helper instead of `prisma migrate`:

```
cd backend
bun run prisma/apply-sql.mjs prisma/migrations/20261017120000_placement_mvp/migration.sql
bunx prisma generate --config prisma7.config.ts
bun run prisma/seed.ts          # optional demo data
```

- **Used by code:** `User` (roles STUDENT, RECRUITER, PLACEMENT), `AuthSession`, `ParsedResume`, `StudentProfile`, `Institution`, `Skill`, `SkillAlias`, `StudentSkill` (status plus `assessmentScore`, `githubScore`, `combinedScore`, `evidenceStrength`, `scoredAt`), `SkillEvidence`, `Project`, `ProjectSkill`, `Company`, `RecruiterProfile`, `JobPosting` (now with a direct `companyId`, optional `recruiterProfileId`, `origin`, `dedupeKey`, `sourceCount`, `parseMethod`), `JobSkillRequirement`, `JobEligibleBranch`, `JobEligibleGraduationYear`, `JobSource` (with `sourceLabel`), `Application` (with `fitScore`, `fitSnapshot`, `resumeSnapshot`), `ApplicationEvent`.
- **Not used:** `SkillEvidence` source types `PROJECT` and `CERTIFICATE`; `Project.status` is never set to `EVALUATED` (projects are not evaluated). Alumni and interview-question tables do not exist.
- The assessment scorecard (questions and answers) is still only in memory; the per-skill proof and numeric scores are persisted.

### Tests ([backend/tests](backend/tests))
`bun test`; Gemini and GitHub are mocked.
- `resume.test.ts`: normalization, parse retries, schema failure, prompt-injection handling, file-type rejection.
- `github.test.ts`: uses a fake GitHub (injected `fetch`). Covers username and repo URL parsing, evidence strength rules, injection safety, the client (404 vs rate limit vs forbidden, pagination cap, request budget, token handling), and `verifyGithub` (missing profile, rate limits, private and inaccessible repos, forks, malformed package.json, repo limit, organization accounts).

- `skillPersistence.test.ts`: the verdict-to-status mapping, evidence rows (assessment score bands, commit-pinned GitHub rows, duplicates collapsed), and applying a plan to an in-memory repository (creates rows, idempotent re-runs, no downgrade for unverified skills, latest evidence wins, one failing skill does not block the rest, a new session adds a new assessment row).
- `skillScoring.test.ts`: assessment score math (total marks, null for unmapped skills, multi-skill split, aliases, bounds), GitHub status mapping, duplicate and alias handling, React not counting for TypeScript, evidence strength, conflicts, the 80/20 combined score and its null cases, every verdict and its flag, coverage of all resume skills (aliases merged, unassessed skills flagged, proof ids and references kept), and `buildSkillScores` (GitHub failure degrades to assessment-only, failures are not cached, incomplete reports, session ownership).
- `github.test.ts` also feeds real `verifyGithub` output into the scorer (supported evidence gives 84 for an 80% assessment, nothing found stays at the assessment score, a rate-limited run is `incomplete` and produces no zero scores).

- `skills.test.ts`: alias resolution, no shared variants across skills, finding skills in free text.
- `jobs.test.ts`: the rules parser (sections, eligibility, deadline, title and company), the LLM path and its fallbacks, normalisation, exact and fuzzy dedupe (subset skills merge, different cities do not, remote fits any city), merging requirements.
- `fit.test.ts`: score math, required vs preferred, GitHub cap, aliases, null job, bands, explanations, eligibility.
- `transitions.test.ts`: every allowed and refused pipeline move.
- `resumeBuilder.test.ts`: verified-only skills, blocked claims with reasons, projects and experience checks, fact ids and proof on every bullet, one-page fit, determinism, HTML escaping, the claim check.

There are no automated tests for the routes or the frontend. The services were exercised end to end against a throwaway local Postgres (see "Testing the API locally" under Known gaps).

## Frontend (`frontend/src`)

Stack: Vite 8, React 19, TypeScript, Tailwind 4 (`@tailwindcss/vite`), react-router-dom 7, ESLint. No state or UI library. `bunx tsc -p tsconfig.app.json --noEmit` is clean and `bunx vite build` succeeds. **The screens have not been clicked through in a browser** (none was available); they were typechecked, linted and written against the real API response shapes.

- **Routes** ([App.tsx](frontend/src/App.tsx)): public `/`, `/about`, `/jobs`; `/signin`, `/signup` (Student, Recruiter or Placement; recruiter and placement need an invitation code). After signing in each role lands on its own home (`lib/roles.ts#homeFor`) and `ProtectedRoute allowedRoles` sends a wrong-role user there.

  | Area | Routes |
  |---|---|
  | Student (`DashboardLayout`) | `/dashboard` overview, `profile`, `resume` (upload, list, **Check claims**), `skills`, `assessment`, `projects`, `jobs` (cards with fit), `jobs/:jobId` (fit panel, gaps with actions, eligibility, sources, Apply), `jobs/:jobId/resume` (tailored resume preview, print to PDF, blocked claims, evidence ledger), `applications` (fit at apply, stage tracker, timeline) |
  | Recruiter (`PortalLayout`, purple) | `/recruiter` my jobs, `profile` (company), `jobs/new` (paste a JD, review the parsed skills, publish), `jobs/:jobId` (ranked applicants, applicant drawer with proof, resume sent, timeline and status controls) |
  | Placement (`PortalLayout`, emerald) | `/placement` overview, `ingest` (paste a posting, pull the job API), `jobs` (sources, edit skills, publish), `rank` (batch ranking, CSV export), `pipeline` (4-stage board, drawer with timeline), `students` (readiness table) |

- **API modules** (`src/api`): `http.ts` (`request`, `requestData`, `ApiRequestError` with `status` and `code`; the base URL honours `VITE_API_BASE_URL` everywhere, including auth), `types.ts` (shared shapes: fit, gaps, jobs, generated resume, claim check, pipeline statuses and `allowedNext`), `match.ts` (student: jobs with fit, fit, resume builder, claim check, apply), `recruiterPortal.ts`, `placement.ts`, plus the older `student.ts`, `assessment.ts`, `auth.ts`.
- **Shared UI:** `components/common` (`FitBadge`, `FitBar`, `Feedback`: `Loading`, `ErrorBox`, `Empty`, `PageHeader`; `StatusBadge`, `ProtectedRoute`), `components/layout` (`PortalLayout`, `DashboardLayout`, `Navbar`...), and per-area folders `components/student`, `components/recruiter`, `components/placement`. The repo's `react-hooks/set-state-in-effect` lint rule rejects fetch-in-effect, so each area has a small fetch hook (`useAsync`, `useApi`, `useQuery`).
- **Resume preview** is the one place HTML is injected: the server-built page goes in a sandboxed `<iframe srcDoc sandbox="allow-same-origin allow-modals">` and "Print / Save as PDF" calls the iframe's `print()`.
- **Auth** ([context/AuthContext.tsx](frontend/src/context/AuthContext.tsx)): `user` and `accessToken` in memory only, session restored through the refresh cookie. There is no automatic token refresh: after 15 minutes an API call fails with 401 and the user has to reload.
- **Assessment page** (`pages/dashboard/AssessmentPage.tsx`) and the **skill verification panel** (`components/SkillVerificationPanel.tsx`) are unchanged from before.
- **Lint:** the new files are lint clean. The older pages (`api/student.ts`, `AssessmentPage`, `OverviewPage`, `ProfilePage`, `ProjectsPage`, `SkillsPage`) still have `no-explicit-any` errors from before.
- **Removed:** the unused `StudentModule`, `AuthCard` and `Dashboard` components.

## Performance notes

Where the time goes (from reading the code; nothing was measured against a real database or Gemini). A vector database would not help: nothing here does similarity search.
- **Gemini calls** dominate generation and grading: output length is the main cost (6-12 questions with rubrics, or a batched grade with feedback). Each model-fallback attempt adds time when a model name is rejected.
- **Resume upload:** `resume.service.saveResume` syncs every parsed skill with roughly 5-6 sequential queries per skill, awaited before the response. This is likely the slowest part of the upload and is not optimised yet.
- **GitHub verification:** about 2 serial rounds per repo plus file fetches in batches of 4, 3 repos at a time, up to 150 requests. The latest-commit and language lookups now run together. Without `GITHUB_TOKEN` it is also rate limited.
- **Every request** reloads the user from the database in `authenticate`, over SSL to a remote host.
- **Timing logs:** `[Timing]` lines (assessment generated, assessment graded, GitHub verification) and `[SkillEvidence] saved ...` show which step is slow in the server log.

## Known gaps and gotchas

**Not built (cut for the hackathon):** alumni mapping and referrals, the company-wise interview-question bank, an endpoint that evaluates a portfolio project on its own (project technologies are checked through the skills), a server-side PDF (the resume is HTML; the browser prints it to PDF), a duplicate-review queue (fuzzy matches at 80 or above merge automatically, the rest stay separate), CSV import, and LLM rewording of bullets or explanations (deliberate: output stays deterministic).

**Behaviour to know**
- **Hidden AI fallbacks:** resume parsing, question generation and grading each fall back to heuristics or canned content when Gemini fails, without telling the user. Check server logs (`[ResumeParser]`, `[AssessmentService]`). Job parsing is the exception: `parseMethod` (`llm` or `rules`) is stored and shown.
- **Matching reads stored scores:** a student's fit only changes after a new assessment or GitHub verification persists scores to `StudentSkill`. Skills outside the taxonomy are stored as custom skills and match only by exact name. Weights, bands and the GitHub-only cap are constants at the top of `matching/fit.ts`.
- **Resume builder checks are heuristic:** the unverifiable-figure detector is a regex (percentages, "10k users", "team of 10"); vaguer boasts that name no number and no unverified skill pass as self-reported. Self-reported text appears on the resume but is labelled as such in the ledger.
- **Job parser is heuristic without Gemini:** ambiguous words (Go, R, C, Excel, Oracle, Swift) are not picked up from free text, so check the parsed skills on the placement Openings page. Skills named only in a "benefits" or "about us" section are ignored on purpose.
- **Dedupe thresholds:** merge at a similarity of 80 or more within one company and city (remote fits any city). A wrong merge hides a real opening, so the number is deliberately high; the job's source list shows what was merged.
- **Applying is gated:** a student outside the CGPA, branch, batch or deadline rules gets 422 `NOT_ELIGIBLE`; missing profile data (no CGPA, branch or year) does not block, but is reported as "could not check".
- **Verification only covers skills the resume lists**, and the assessment covers at most 12 skills per run; skills with no GitHub catalog rule (tools, soft skills) can only be `unverified`.
- **Free-text grading fallback is weak:** if Gemini grading fails, free-text answers get heuristic scores and the scorecard does not mark which were AI-graded.
- **Invalid Gemini model name:** the fallback lists include `gemini-3.8-flash`, which may not exist; a not-found error moves on to the next model.
- **Assessment sessions are in memory:** sessions and scorecards are lost on restart (`GET .../scorecard` only works while the session lives). The per-skill proof and numeric scores are persisted.
- **GitHub rate limits:** without `GITHUB_TOKEN`, GitHub allows 60 requests per hour (about one verification). Set a token for any demo that verifies live.
- **Dead resume router:** `routes/resume.ts` is not mounted (the `/students/me/resume*` routes replaced it).
- **TLS:** `config/prisma.ts` uses `rejectUnauthorized: false` for hosted databases (Supabase) and no TLS for a `localhost` / `127.0.0.1` database URL.

**Housekeeping**
- **Lockfiles:** `backend/package.json` now declares `@node-rs/argon2` and `@prisma/adapter-pg` (the code imports both; a clean install used to fail). If you run `bun install` behind a corporate registry, the lockfile gets rewritten with that registry's URLs: restore it or install with `--registry https://registry.npmjs.org` before committing.
- **Typecheck:** `bunx tsc --noEmit` is clean in `backend/`, and `bunx tsc -p tsconfig.app.json --noEmit` in `frontend/`. If you see `institutionId` or `PLACEMENT` errors, regenerate the Prisma client (`bunx prisma generate --config prisma7.config.ts`).
- **Remote database:** apply the new migration before running the new code (see "Database"). Until then `StudentSkill` has no score columns and the `PLACEMENT` role does not exist.
- **Env vars added:** `PLACEMENT_SIGNUP_CODE` (optional; without it nobody can register as placement staff), `INGEST_USE_FIXTURES` (`true` reads `backend/fixtures/jobs/remotive.json` instead of calling the API), `JOB_PARSE_LLM` (`false` forces the rules parser). All are in `backend/.env.example`.

**Testing the API locally without touching the shared database.** `config/index.ts` loads `backend/.env` with `override: true`, so a shell variable cannot redirect it. To run the whole API against a throwaway Postgres: start one (`backend/node_modules/.bin/pglite-server.exe --db=memory:// --port=5544 -m 20`), copy `backend/` (without `.env`) to a scratch folder with its own `.env` whose `DATABASE_URL` is `postgresql://postgres:postgres@127.0.0.1:5544/postgres`, create the tables (`prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`), run `prisma/seed.ts`, then `src/server.ts`. That is how the services in this file were verified end to end.

**Root `README.md`** is a one-liner and `backend/README.md` covers setup only. This file is the fuller description.
