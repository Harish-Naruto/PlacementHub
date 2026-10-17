# PlacementHub

A placement platform that matches students to openings on **verified evidence of their skills**, not claims, and helps them apply with **tailored, entirely truthful resumes**. Built in 24 hours for the TechSummitTrainers problem statement.

Freshers send one generic resume full of claims they cannot back up. Placement teams forward openings by hand over WhatsApp. Companies want shortlists they can trust. PlacementHub puts evidence in the middle of all three.

## What it does

| Brief | What you can do |
|---|---|
| **Openings from many sources** | The placement team pastes a WhatsApp-style posting, an alumni referral, or pulls from a job API. The same opening arriving twice ("ReactJS Developer, Acme Pvt Ltd" and "React.js developer - ACME") becomes **one job with several sources**. Required and preferred skills are parsed and normalised ("ReactJS", "React.js", "React" are one skill). |
| **Skills from evidence** | Each skill carries its proof: AI assessment questions and commit-pinned GitHub files. Self-declared skills are clearly marked as claims. |
| **Fit score with reasons** | For every student and opening: a score, a plain-language explanation and the **specific gaps**, each with a next action. Eligibility (CGPA, branch, batch, deadline) is shown separately and never hides skill fit. |
| **Truthful one-page resume** | Generated per opening. **Every bullet traces to evidence.** Unsupported skills, project technologies and unverifiable figures ("improved speed by 40%") are blocked, with the reason and how to fix it. An uploaded resume gets a **claim check** that flags what is not backed by evidence yet. |
| **Shared pipeline** | Applied, Interview, Offer, visible to the student, the recruiter and the placement team, with a logged history. The placement team can **rank a whole batch against one pasted job description**. |
| **Recruiter portal** | Post a job by pasting its description, then see a **ranked shortlist** with the proof behind every skill and the exact resume each candidate sent. |

Not built: alumni mapping and the interview-question bank (the optional extras).

"Unsupported" and "unverified" always mean *not backed by evidence yet*, never "false".

## Design choices worth knowing

- **Deterministic where it matters.** Matching, explanations, gaps and resume bullets are plain code, not LLM output, so they are reproducible and can never name a skill that is not in the evidence. Gemini is used only to parse resumes and job descriptions and to run the assessment; every one of those has a non-LLM fallback and the job parser records which one ran.
- **One skill vocabulary** (`backend/src/skills`) shared by resume parsing, job parsing, scoring and matching.
- **Pure, tested modules** (`matching/`, `jobs/`, `resumeBuilder/`, `pipeline/`, `scoring/`, `github/`): no database or network, 166 unit tests.
- **Honest ranking.** A padded resume with a dozen claimed skills and no evidence scores near zero and ranks below a student with fewer, proven skills.

## Run it

Requirements: [Bun](https://bun.sh), a Postgres database (Supabase works), and optionally a Gemini API key and a GitHub token.

```bash
# 1. Install
cd backend && bun install && cd ../frontend && bun install && cd ..

# 2. Configure the backend
cp backend/.env.example backend/.env
#   fill in DATABASE_URL, JWT_ACCESS_SECRET (32+ chars), RECRUITER_SIGNUP_CODE, PLACEMENT_SIGNUP_CODE,
#   GEMINI_API_KEY and GITHUB_TOKEN (recommended: without a token GitHub allows ~1 verification per hour)

# 3. Create the schema changes and (optionally) demo data.
#    A brand-new empty database first needs the two older migrations:
#    prisma/migrations/20261016133541_init and 20261016180000_add_parsed_resume (same command, run once).
cd backend
bun run prisma/apply-sql.mjs prisma/migrations/20261017100000_auth_and_drift/migration.sql prisma/migrations/20261017120000_placement_mvp/migration.sql
bunx prisma generate --config prisma7.config.ts
bun run prisma/seed.ts          # synthetic demo data; prints the logins
cd ..

# 4. Start both (backend :4000, frontend :5173)
bun run dev
```

The seed creates synthetic accounts (password `Demo@12345`, emails end in `@demo.placementhub.test`): `placement@`, `recruiter.acme@`, `recruiter.globex@`, and twelve students such as `asha@` (strong, well evidenced), `karan@` (padded resume, little evidence), `neha@` (strong skills, CGPA below the cut-off).

Register your own accounts in the app: students sign up freely; recruiters and the placement team need the invitation codes from `backend/.env`.

## Five-minute demo

1. **Placement team** (`placement@`): *Ingest openings*, paste a posting, then pull from the job API. Watch the same opening merge into one job with several sources.
2. **Student** (`asha@`): *Campus Jobs* shows every opening ranked by evidence-backed fit. Open one: the score, the explanation, the gaps and what to do about each.
3. **Student**: *Build tailored resume*. Every bullet has its proof; the "Not on this resume" panel shows what was left out and why. Print it to PDF.
4. **Student** (`karan@`): the same opening, a near-zero fit and a long list of blocked claims. On *Resume Upload*, run *Check claims*.
5. **Student**: apply. (`neha@` is refused with the reason: CGPA below the minimum.)
6. **Recruiter** (`recruiter.acme@`): open the job, see the ranked applicants, open one to see the proof behind every skill and the resume that was sent, then move them to *Interview*.
7. **Placement team**: *Batch ranking*: paste a job description, rank the whole batch, export the CSV. *Pipeline* shows the same application moving.

## Layout

```
backend/    Express 5 + TypeScript on Bun, Prisma 7 + Postgres
  src/skills       the shared skill vocabulary
  src/jobs         job parsing and cross-source dedupe
  src/matching     fit score, explanations, gaps, ranking
  src/resumeBuilder  truthful resume and uploaded-resume claim check
  src/pipeline     application status rules
  src/scoring, src/github, src/assessment   evidence: assessments and GitHub verification
  prisma/seed.ts   demo data
frontend/   React 19 + Vite + Tailwind 4: student dashboard, recruiter portal, placement portal
CONTEXT.md  the detailed description of every module (start here when changing code)
IMPLEMENTATION_PLAN.md  the plan this was built from
```

Tests: `cd backend && bun test`. Types: `bunx tsc --noEmit` (backend) and `bunx tsc -p tsconfig.app.json --noEmit` (frontend).
