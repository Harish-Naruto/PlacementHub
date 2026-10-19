// Deterministic detection rules per technology. Keys are canonical resume names (lower-cased on lookup).
// Anything not listed here is reported as "not_checked" rather than guessed.

import { canonicalSkill } from '../skills/canonical.ts';

export interface TechRule {
    /** Package names in dependency manifests (npm, pip, Maven, Cargo, go.mod ...). */
    packages?: string[];
    /** Config / schema files whose presence is an implementation signal. */
    files?: RegExp[];
    /** Extra patterns tested against fetched source text (imports of `packages` are derived automatically). */
    source?: RegExp[];
    /** Extensions of source files to scan with `source` patterns. */
    sourceExts?: string[];
    /** File extensions whose presence in the tree shows the language is used. */
    extensions?: string[];
    /** GitHub language names (statistics are a discovery signal only). */
    languages?: string[];
    /** Path hints used to choose which source files to download. */
    pathHints?: RegExp[];
}

const JS_EXTS = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'vue'];

export const CATALOG: Record<string, TechRule> = {
    'c++': { extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hxx'], languages: ['C++'], files: [/(^|\/)CMakeLists\.txt$/] },
    java: { extensions: ['java'], languages: ['Java'], files: [/(^|\/)(pom\.xml|build\.gradle(\.kts)?)$/] },
    javascript: { extensions: ['js', 'jsx', 'mjs', 'cjs'], languages: ['JavaScript'] },
    typescript: {
        extensions: ['ts', 'tsx'],
        languages: ['TypeScript'],
        packages: ['typescript'],
        files: [/(^|\/)tsconfig(\.[\w-]+)?\.json$/],
    },
    python: { extensions: ['py'], languages: ['Python'], files: [/(^|\/)(requirements\.txt|pyproject\.toml)$/] },
    go: { extensions: ['go'], languages: ['Go'], files: [/(^|\/)go\.mod$/] },
    rust: { extensions: ['rs'], languages: ['Rust'], files: [/(^|\/)Cargo\.toml$/] },
    sql: { extensions: ['sql'], languages: ['PLpgSQL', 'TSQL', 'PLSQL'] },
    html: { extensions: ['html', 'htm'], languages: ['HTML'] },
    css: { extensions: ['css', 'scss', 'sass', 'less'], languages: ['CSS', 'SCSS', 'Sass', 'Less'] },

    react: {
        packages: ['react', 'react-dom'],
        source: [/\buse(State|Effect|Memo|Ref|Context|Reducer)\s*\(/],
        sourceExts: ['jsx', 'tsx', 'js', 'ts'],
        pathHints: [/components?\//i, /pages?\//i, /app\//i, /(^|\/)(App|main|index)\.(jsx|tsx|js|ts)$/],
    },
    'next.js': {
        packages: ['next'],
        files: [/(^|\/)next\.config\.(js|mjs|ts|cjs)$/, /(^|\/)app\/(.*\/)?(page|layout)\.(jsx|tsx|js|ts)$/, /(^|\/)pages\/_app\.(jsx|tsx|js|ts)$/],
        pathHints: [/(^|\/)app\//, /(^|\/)pages\//],
    },
    'tailwind css': {
        packages: ['tailwindcss', '@tailwindcss/vite', '@tailwindcss/postcss'],
        files: [/(^|\/)tailwind\.config\.(js|cjs|mjs|ts)$/],
        source: [/@import\s+["']tailwindcss/, /@tailwind\s+(base|components|utilities)/],
        sourceExts: ['css'],
        pathHints: [/\.css$/],
    },
    redux: {
        packages: ['redux', '@reduxjs/toolkit', 'react-redux'],
        source: [/\b(createSlice|configureStore|createStore)\s*\(/],
        sourceExts: JS_EXTS,
        pathHints: [/redux|store|slice/i],
    },
    zustand: {
        packages: ['zustand'],
        source: [/\bcreate\s*(<[^>]*>)?\s*\(\s*\(?\s*set\b/],
        sourceExts: JS_EXTS,
        pathHints: [/store/i],
    },
    'tanstack query': {
        packages: ['@tanstack/react-query', '@tanstack/query-core', 'react-query', '@tanstack/vue-query'],
        source: [/\b(useQuery|useMutation|QueryClientProvider)\b/],
        sourceExts: JS_EXTS,
        pathHints: [/api|hooks?|query/i],
    },
    'framer motion': {
        packages: ['framer-motion', 'motion'],
        source: [/\bmotion\.[a-z]+\b/],
        sourceExts: ['jsx', 'tsx', 'js', 'ts'],
        pathHints: [/components?\//i, /pages?\//i],
    },

    'node.js': {
        packages: ['express', 'koa', 'fastify', '@nestjs/core', 'hono'],
        files: [/(^|\/)\.nvmrc$/],
        source: [/\bprocess\.env\b/, /\brequire\(\s*['"]node:/, /\bfrom\s+['"]node:/],
        sourceExts: ['js', 'ts', 'mjs', 'cjs'],
        pathHints: [/server|app\.(ts|js)$|index\.(ts|js)$/i],
    },
    'express.js': {
        packages: ['express'],
        source: [/\bexpress\s*\(\s*\)/, /\bRouter\s*\(\s*\)/],
        sourceExts: ['js', 'ts', 'mjs', 'cjs'],
        pathHints: [/routes?\//i, /server|app\.(ts|js)$/i, /controllers?\//i],
    },
    'rest api': {
        // Implementation signal only: route handlers declared against an HTTP framework.
        source: [/\b(router|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]\//],
        sourceExts: ['js', 'ts', 'mjs', 'cjs'],
        pathHints: [/routes?\//i, /controllers?\//i, /api\//i],
    },
    websocket: {
        packages: ['ws', 'socket.io', 'socket.io-client', 'websocket', 'uws'],
        source: [/\bnew\s+WebSocket(Server)?\s*\(/, /\bio\s*\(\s*['"`]/],
        sourceExts: JS_EXTS,
        pathHints: [/socket|ws|realtime/i],
    },
    'json web token': {
        packages: ['jsonwebtoken', 'jose', 'jwt-decode', 'passport-jwt', '@nestjs/jwt'],
        source: [/\b(jwt\.(sign|verify)|SignJWT|jwtVerify)\b/],
        sourceExts: ['js', 'ts', 'mjs', 'cjs'],
        pathHints: [/auth|jwt|token|middleware/i],
    },

    postgresql: {
        packages: ['pg', 'postgres', 'pg-promise', 'psycopg2', 'psycopg2-binary', 'psycopg', 'asyncpg', '@prisma/adapter-pg'],
        source: [/provider\s*=\s*"postgres(ql)?"/, /\bpostgres(ql)?:\/\//],
        sourceExts: ['prisma', 'ts', 'js', 'py'],
        pathHints: [/schema\.prisma$/, /(^|\/)(db|database)\//i],
    },
    mongodb: {
        packages: ['mongodb', 'mongoose', 'pymongo', 'motor'],
        source: [/\bmongoose\.(connect|model|Schema)\b/, /\bMongoClient\b/],
        sourceExts: ['js', 'ts', 'mjs', 'cjs', 'py'],
        pathHints: [/models?\//i, /(^|\/)(db|database|config)\//i],
    },
    prisma: {
        packages: ['prisma', '@prisma/client'],
        files: [/(^|\/)schema\.prisma$/, /(^|\/)prisma\/migrations\/.+\.sql$/],
        source: [/\bnew\s+PrismaClient\b/, /\bprisma\.\w+\.(find\w+|create\w*|update\w*|delete\w*|upsert)\b/],
        sourceExts: ['ts', 'js', 'mjs'],
        pathHints: [/prisma/i, /(^|\/)(db|database|config|services?)\//i],
    },
    supabase: {
        packages: ['@supabase/supabase-js', '@supabase/ssr', 'supabase'],
        files: [/(^|\/)supabase\/(config\.toml|migrations\/)/],
        source: [/\bcreateClient\s*\(/],
        sourceExts: JS_EXTS,
        pathHints: [/supabase/i, /(^|\/)(db|database|config|lib)\//i],
    },
    redis: {
        packages: ['redis', 'ioredis', '@upstash/redis', 'bullmq'],
        source: [/\bnew\s+Redis\s*\(/, /\bcreateClient\s*\(\s*\{[^}]*(url|socket)/],
        sourceExts: ['js', 'ts', 'mjs', 'cjs', 'py'],
        pathHints: [/redis|cache|queue/i],
    },
    'google gemini': {
        packages: ['@google/genai', '@google/generative-ai', 'google-generativeai', 'google-genai'],
        source: [/\bGoogleGenAI\b/, /\bGoogleGenerativeAI\b/, /\bgemini-[\w.-]+/],
        sourceExts: ['js', 'ts', 'mjs', 'py'],
        pathHints: [/gemini|ai|llm|nlp/i],
    },

    bun: { files: [/(^|\/)bun\.lockb?$/, /(^|\/)bunfig\.toml$/], packages: ['@types/bun', 'bun-types'] },
    npm: { files: [/(^|\/)package-lock\.json$/] },
};

// Catalog keys re-indexed by their taxonomy name, so "WebSockets" finds the "websocket" rule.
const BY_TAXONOMY_NAME = new Map<string, TechRule>(
    Object.entries(CATALOG).map(([key, rule]) => [(canonicalSkill(key) ?? key).toLowerCase(), rule]),
);

export const lookupRule = (canonical: string): TechRule | undefined => {
    const key = canonical.trim().toLowerCase();
    return CATALOG[key] ?? BY_TAXONOMY_NAME.get((canonicalSkill(key) ?? key).toLowerCase());
};

// Names that are intentionally not verifiable from a repository.
export const NOT_CHECKABLE_NOTE = 'No automated GitHub check exists for this item; it was not examined.';
