# AGENTS.md

## Folder structure
- `backend/`
  - `package.json`
  - `prisma7.config.ts`
  - `README.md`
  - `tsconfig.json`
  - `prisma/`
    - `schema.prisma`
    - `migrations/`
      - `migration_lock.toml`
      - `20261016133541_init/`
        - `migration.sql`
  - `src/`
    - `app.ts`
    - `server.ts`
    - `config/`
      - `index.ts`
    - `routes/`
      - `index.ts`
    - `types/`
      - `express.d.ts`
    - `utils/`
      - `api.ts`
      - `apiError.ts`
- `frontend/`
  - `eslint.config.js`
  - `index.html`
  - `package.json`
  - `README.md`
  - `tsconfig.app.json`
  - `tsconfig.json`
  - `tsconfig.node.json`
  - `vite.config.ts`
  - `public/`
  - `src/`
    - `App.css`
    - `App.tsx`
    - `index.css`
    - `main.tsx`
    - `assets/`
- `package.json`
- `README.md`
- `tsconfig.json`

## Tech stack
- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Express, Bun, Prisma, PostgreSQL
- Additional: Supabase, Zod, ESLint
