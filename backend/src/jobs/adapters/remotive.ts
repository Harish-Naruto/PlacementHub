// Remotive public job API (no key needed). https://remotive.com/api/remote-jobs
// Keep the attribution link in the UI when showing these jobs, as the API terms ask.
// INGEST_USE_FIXTURES=true (or any network failure) reads backend/fixtures/jobs/remotive.json instead,
// so a demo never depends on the network.

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlToText } from '../html.ts';
import type { RawJob } from '../types.ts';

const URL_ = 'https://remotive.com/api/remote-jobs?category=software-dev&limit=25';
const FIXTURE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../fixtures/jobs/remotive.json');

interface RemotiveJob {
    id: number | string;
    url?: string;
    title: string;
    company_name: string;
    candidate_required_location?: string;
    job_type?: string;
    description?: string;
    tags?: string[];
}

function toRaw(j: RemotiveJob): RawJob {
    const tags = j.tags?.length ? `\nTech stack: ${j.tags.join(', ')}` : '';
    return {
        externalId: `remotive:${j.id}`,
        title: j.title,
        company: j.company_name,
        location: j.candidate_required_location ? `Remote - ${j.candidate_required_location}` : 'Remote',
        description: `${htmlToText(j.description ?? '')}${tags}`,
        applyUrl: j.url ?? null,
    };
}

export async function fetchRemotive(useFixtures: boolean): Promise<{ jobs: RawJob[]; source: 'api' | 'fixture' }> {
    if (!useFixtures) {
        try {
            const res = await fetch(URL_, { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } });
            if (res.ok) {
                const body = (await res.json()) as { jobs?: RemotiveJob[] };
                if (body.jobs?.length) return { jobs: body.jobs.map(toRaw), source: 'api' };
            }
        } catch {
            // fall through to the recorded sample
        }
    }
    const body = JSON.parse(await readFile(FIXTURE, 'utf8')) as { jobs: RemotiveJob[] };
    return { jobs: body.jobs.map(toRaw), source: 'fixture' };
}
