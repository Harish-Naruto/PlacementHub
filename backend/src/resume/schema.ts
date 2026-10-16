import { z } from 'zod';

export const SCHEMA_VERSION = '1.0';

const evidence = z.object({
    section: z.string().nullable(),
    text: z.string(),
    page: z.number().int().nullable(),
});

const skill = z.object({
    name: z.string(),
    canonical_name: z.string().nullable(),
    category: z.string().nullable(),
    claim_type: z.enum(['listed_skill', 'project_technology', 'experience_technology']),
    evidence: z.array(evidence),
});

const project = z.object({
    name: z.string(),
    description: z.string().nullable(),
    role: z.string().nullable(),
    technologies: z.array(z.string()),
    features: z.array(z.object({ claim: z.string(), evidence_text: z.string() })),
    repository_urls: z.array(z.string()),
    evidence: z.array(evidence),
});

const experience = z.object({
    organization: z.string().nullable(),
    title: z.string().nullable(),
    start_date: z.string().nullable(),
    end_date: z.string().nullable(),
    is_current: z.boolean().nullable(),
    responsibilities: z.array(z.string()),
    technologies: z.array(z.string()),
    evidence: z.array(evidence),
});

// What we ask the LLM for.
export const llmResumeSchema = z.object({
    skills: z.array(skill),
    projects: z.array(project),
    experience: z.array(experience),
    links: z.object({
        github_profiles: z.array(z.string()),
        github_repositories: z.array(z.string()),
        portfolios: z.array(z.string()),
    }),
});

export type LlmResume = z.infer<typeof llmResumeSchema>;
export type ParsedResume = LlmResume & { schema_version: string };
