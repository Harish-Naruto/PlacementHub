# PlacementHub

PlacementHub is a full-stack placement platform that helps students, recruiters, and placement teams manage campus hiring with evidence-based skill matching.

## Highlights

- Ingest jobs from pasted descriptions and external sources
- Match students to jobs using normalized skill data
- Generate truthful, job-specific resumes backed by evidence
- Track applications through a shared pipeline
- Support dedicated student, recruiter, and placement workflows

## Tech Stack

- **Backend:** Bun, Express, TypeScript, Prisma, PostgreSQL
- **Frontend:** React, Vite, TypeScript, Tailwind CSS

## Repository Structure

- `/backend` – API, business logic, Prisma schema/migrations, tests
- `/frontend` – web application UI
- `/docker` – container-related setup files

## Quick Start

### 1) Install dependencies

```bash
cd /home/runner/work/PlacementHub/PlacementHub/backend && bun install
cd /home/runner/work/PlacementHub/PlacementHub/frontend && bun install
```

### 2) Configure environment

```bash
cp /home/runner/work/PlacementHub/PlacementHub/backend/.env.example /home/runner/work/PlacementHub/PlacementHub/backend/.env
```

Update values in `/home/runner/work/PlacementHub/PlacementHub/backend/.env` (at minimum database URL, auth secrets, and signup codes).

### 3) Apply database setup

Run the Prisma SQL/migration steps used by your environment, then generate Prisma client:

```bash
cd /home/runner/work/PlacementHub/PlacementHub/backend
bunx prisma generate --config prisma7.config.ts
```

(Optional) Seed demo data:

```bash
bun run prisma/seed.ts
```

### 4) Start the app

From repository root:

```bash
cd /home/runner/work/PlacementHub/PlacementHub
bun run dev
```

- Backend: `http://localhost:4000`
- Frontend: `http://localhost:5173`

## Useful Commands

From `/home/runner/work/PlacementHub/PlacementHub/backend`:

- `bun run test` – run backend tests
- `bun run build` – type-check backend

From `/home/runner/work/PlacementHub/PlacementHub/frontend`:

- `bun run lint` – lint frontend
- `bun run build` – type-check and build frontend
