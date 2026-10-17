import config from '../config/index.ts';
import type { ParsedResume } from '../resume/schema.ts';
import { ApiError } from '../utils/apiError.ts';
import { lookupRule, NOT_CHECKABLE_NOTE } from './catalog.ts';
import { GithubClient, GithubError } from './client.ts';
import { extractClaims, type ProjectClaim } from './claims.ts';
import { collectRepo, defaultLimits, type CollectedRepo, type CollectLimits, type RepoMeta } from './collect.ts';
import { assessEvidence, detectTechnology } from './detect.ts';
import { normalizeName, parseRepoUrl, parseUsername } from './identify.ts';
import type {
    Claim,
    ClaimStatus,
    Evidence,
    RepoResolution,
    RepositorySummary,
    UsernameSource,
    VerificationReport,
} from './types.ts';

export interface VerifyInput {
    resume: ParsedResume;
    /** Username or profile URL supplied with the request. Takes precedence over the resume. */
    username?: string | null;
    /** githubUsername from the candidate's profile, if any. */
    profileUsername?: string | null;
}

export interface VerifyOptions {
    client?: GithubClient;
    limits?: CollectLimits;
    maxRepos?: number;
    now?: () => Date;
}

interface Target {
    owner: string;
    name: string;
    resolution: RepoResolution;
    meta?: RepoMeta;
}

interface Outcome {
    target: Target;
    collected?: CollectedRepo;
    failure?: string; // why the repository could not be read
    skipped?: boolean; // not attempted (limit or earlier rate limit)
}

const STRENGTH = { strong: 0, moderate: 1, weak: 2 } as const;
const bestFirst = (a: Evidence, b: Evidence) => STRENGTH[a.strength] - STRENGTH[b.strength];
const emptySummary = (): Record<ClaimStatus, number> => ({
    supported: 0,
    partially_supported: 0,
    insufficient_evidence: 0,
    needs_review: 0,
    not_accessible: 0,
    not_checked: 0,
});

function resolveUsername(input: VerifyInput): { username: string; source: UsernameSource; notes: string[] } {
    const links = input.resume.links;
    const notes: string[] = [];
    const fromResume = links.github_profiles.map(parseUsername).filter((u): u is string => !!u);
    if (new Set(fromResume.map((u) => u.toLowerCase())).size > 1) notes.push('The resume lists more than one GitHub profile; the first was used.');

    if (input.username?.trim()) {
        const u = parseUsername(input.username);
        if (!u) throw new ApiError('Not a valid GitHub username or profile URL', 400, true, 'INVALID_GITHUB_USERNAME');
        if (fromResume[0] && fromResume[0].toLowerCase() !== u.toLowerCase()) notes.push('The supplied username differs from the GitHub profile linked on the resume.');
        return { username: u, source: 'request', notes };
    }
    if (fromResume[0]) return { username: fromResume[0], source: 'resume_profile_link', notes };
    const fromProfile = input.profileUsername ? parseUsername(input.profileUsername) : null;
    if (fromProfile) return { username: fromProfile, source: 'student_profile', notes };

    // Explicit repository links on the resume name their owner; this is not a guess.
    const urls = [...links.github_repositories, ...input.resume.projects.flatMap((p) => p.repository_urls)];
    const owners = new Set(urls.map((u) => parseRepoUrl(u)?.owner.toLowerCase()).filter(Boolean));
    if (owners.size === 1) {
        const owner = urls.map((u) => parseRepoUrl(u)?.owner).find(Boolean)!;
        return { username: owner, source: 'resume_repository_link', notes };
    }
    throw new ApiError('Provide a GitHub username; none was found on the resume or profile', 400, true, 'GITHUB_USERNAME_REQUIRED');
}

function matchByName(project: ProjectClaim, repos: RepoMeta[]): { meta: RepoMeta; approximate: boolean } | null {
    const p = normalizeName(project.name);
    if (!p) return null;
    const exact = repos.find((r) => normalizeName(r.name) === p);
    if (exact) return { meta: exact, approximate: false };
    const approx = repos.find((r) => {
        const n = normalizeName(r.name);
        return Math.min(n.length, p.length) >= 5 && (n.includes(p) || p.includes(n));
    });
    return approx ? { meta: approx, approximate: true } : null;
}

const fullName = (t: { owner: string; name: string }) => `${t.owner}/${t.name}`.toLowerCase();

export async function verifyGithub(input: VerifyInput, opts: VerifyOptions = {}): Promise<VerificationReport> {
    const client = opts.client ?? new GithubClient();
    const limits = opts.limits ?? defaultLimits();
    const maxRepos = opts.maxRepos ?? config.githubMaxRepos;
    const now = opts.now ?? (() => new Date());
    const limitations: string[] = [
        'GitHub evidence is supporting evidence only. It is not proof of skill, identity or authorship, and a missing repository is not evidence that a claim is false.',
        'Only public repositories were inspected, statically. No code was executed or tested.',
        'Commit, pull-request and review history were not analysed, so contribution by the candidate is not established.',
        'Project feature descriptions were not individually verified; only the technologies attributed to each project were checked.',
        `At most ${limits.maxFiles} source files per repository were sampled.`,
    ];

    const { username, source, notes } = resolveUsername(input);
    limitations.push(...notes);

    // 1. Profile
    let login = username;
    let profileUrl = `https://github.com/${username}`;
    try {
        const profile = await client.json<{ login: string; html_url: string; type: string }>(`/users/${encodeURIComponent(username)}`);
        if (profile.type !== 'User') throw new ApiError('That GitHub account is an organization, not a user', 422, true, 'GITHUB_NOT_A_USER');
        login = profile.login;
        profileUrl = profile.html_url;
    } catch (e) {
        if (e instanceof ApiError) throw e;
        if (e instanceof GithubError && e.kind === 'not_found') {
            throw new ApiError('GitHub profile not found; it may be misspelled, renamed or unavailable', 404, true, 'GITHUB_PROFILE_NOT_FOUND');
        }
        if (e instanceof GithubError && (e.kind === 'rate_limited' || e.kind === 'budget_exhausted')) {
            throw new ApiError('GitHub rate limit reached; please try again later', 503, true, 'GITHUB_RATE_LIMITED');
        }
        throw new ApiError('GitHub is unavailable; please try again later', 502, true, 'GITHUB_UNAVAILABLE');
    }

    // 2. Public repositories (bounded pagination)
    let incomplete = false;
    let listed: RepoMeta[] = [];
    try {
        const res = await client.paged<RepoMeta>(`/users/${encodeURIComponent(login)}/repos?type=owner&sort=pushed`, 3);
        listed = res.items; // private entries (if the token can see any) are matched by name but never read
        if (res.truncated) limitations.push('Only the 300 most recently pushed public repositories were listed.');
    } catch (e) {
        incomplete = true;
        limitations.push(
            e instanceof GithubError && e.kind === 'rate_limited'
                ? 'The repository list could not be retrieved because the GitHub rate limit was reached.'
                : 'The repository list could not be retrieved from GitHub.',
        );
    }

    // 3. Claims from the existing resume parse + repositories to inspect
    const { skills, projects } = extractClaims(input.resume);
    const claimedKeys = skills.map((s) => s.key).filter((k) => lookupRule(k));

    const targets: Target[] = [];
    const byName = new Map<string, Target>();
    // Returns the canonical Target for a repository so that duplicates share one outcome.
    const addTarget = (t: Target) => {
        const existing = byName.get(fullName(t));
        if (existing) return existing;
        byName.set(fullName(t), t);
        targets.push(t);
        return t;
    };

    const projectTarget = new Map<string, { target: Target; approximate: boolean }>();
    for (const p of projects) {
        const link = p.repositoryUrls.map(parseRepoUrl).find(Boolean);
        if (link) {
            const known = listed.find((r) => r.full_name.toLowerCase() === `${link.owner}/${link.repo}`.toLowerCase());
            const target = addTarget({ owner: link.owner, name: link.repo, resolution: 'linked_url', meta: known });
            projectTarget.set(p.name, { target, approximate: false });
        }
    }
    // Repository links that appear on the resume without a project attached.
    for (const url of input.resume.links.github_repositories) {
        const r = parseRepoUrl(url);
        if (!r) continue;
        const name = normalizeName(r.repo);
        const owning = projects.find((p) => !projectTarget.has(p.name) && normalizeName(p.name) === name);
        const target = addTarget({ owner: r.owner, name: r.repo, resolution: 'linked_url' });
        if (owning) projectTarget.set(owning.name, { target, approximate: false });
    }
    for (const p of projects) {
        if (projectTarget.has(p.name)) continue;
        const m = matchByName(p, listed);
        if (!m) continue;
        const target = addTarget({
            owner: m.meta.full_name.split('/')[0]!,
            name: m.meta.name,
            resolution: m.approximate ? 'name_match_approximate' : 'name_match',
            meta: m.meta,
        });
        projectTarget.set(p.name, { target, approximate: m.approximate });
    }

    // Other public, non-fork repositories that plausibly relate to a claimed language/technology.
    const claimedLanguages = new Set(claimedKeys.flatMap((k) => lookupRule(k)?.languages ?? []).map((l) => l.toLowerCase()));
    const claimedNames = new Set(skills.map((s) => s.key));
    let omittedExtras = 0;
    for (const r of listed) {
        const relevant = (r.language && claimedLanguages.has(r.language.toLowerCase())) || (r.topics ?? []).some((t) => claimedNames.has(t.toLowerCase()));
        if (r.fork || r.private || !relevant || byName.has(r.full_name.toLowerCase())) continue;
        if (targets.length >= maxRepos) omittedExtras++;
        else addTarget({ owner: r.full_name.split('/')[0]!, name: r.name, resolution: 'additional', meta: r });
    }

    // 4. Collect evidence (resume-linked repositories first, bounded in number)
    const outcomes: Outcome[] = targets.map((target) => ({ target }));
    const toRun = outcomes.slice(0, maxRepos);
    for (const o of outcomes.slice(maxRepos)) o.skipped = true;
    const notInspected = outcomes.length - toRun.length + omittedExtras;
    if (notInspected > 0) limitations.push(`${notInspected} other candidate repositories were not inspected because of the per-run repository limit (${maxRepos}).`);

    let stopped = false;
    for (let i = 0; i < toRun.length; i += 3) {
        const batch = toRun.slice(i, i + 3);
        if (stopped) {
            for (const o of batch) o.skipped = true;
            continue;
        }
        await Promise.all(
            batch.map(async (o) => {
                try {
                    o.collected = await collectRepo(client, o.target.owner, o.target.name, claimedKeys, limits, o.target.meta);
                    if (o.collected.incomplete) {
                        incomplete = true;
                        stopped = true;
                    }
                } catch (e) {
                    if (e instanceof GithubError && e.kind === 'not_found') o.failure = 'Not found; it may be private, renamed or deleted.';
                    else if (e instanceof GithubError && e.kind === 'forbidden') o.failure = 'Not accessible without authorization.';
                    else if (e instanceof GithubError && (e.kind === 'rate_limited' || e.kind === 'budget_exhausted')) {
                        o.failure = 'Not inspected: GitHub rate limit or request budget reached.';
                        incomplete = true;
                        stopped = true;
                    } else o.failure = 'Could not be retrieved from GitHub.';
                }
            }),
        );
    }
    const failures = outcomes.filter((o) => o.failure).length;
    if (incomplete) limitations.push('GitHub rate limits or the request budget stopped collection early; results may be incomplete.');

    // 5. Evidence per repository per technology
    const perRepo = new Map<string, Map<string, Evidence[]>>();
    for (const o of outcomes) {
        if (!o.collected) continue;
        const byTech = new Map<string, Evidence[]>();
        for (const k of new Set(claimedKeys)) byTech.set(k, detectTechnology(k, o.collected.facts));
        perRepo.set(fullName(o.target), byTech);
    }
    const examined = outcomes.filter((o) => o.collected);

    // 6. Skill claims (aggregated across inspected repositories)
    const claims: Claim[] = [];
    for (const s of skills) {
        if (!lookupRule(s.key)) {
            claims.push({ claim_type: 'skill', claim: s.name, status: 'not_checked', confidence: null, resume_references: s.references, evidence: [], limitations: [NOT_CHECKABLE_NOTE] });
            continue;
        }
        const evidence = [...perRepo.values()].flatMap((m) => m.get(s.key) ?? []).sort(bestFirst);
        const support = assessEvidence(evidence);
        const lim: string[] = [];
        let status: ClaimStatus;
        if (support === 'none') {
            status = incomplete || (examined.length === 0 && failures > 0) ? 'not_accessible' : 'insufficient_evidence';
            lim.push(
                examined.length
                    ? `No supporting evidence was found in the ${examined.length} repositories inspected; this does not show the claim is false.`
                    : 'No public repository could be inspected for this claim.',
            );
        } else {
            status = support === 'supported' ? 'supported' : 'partially_supported';
            const types = new Set(evidence.map((e) => e.evidence_type));
            if (!types.has('source_code') && !types.has('configuration') && !types.has('file_presence')) lim.push('Only dependency or language statistics were found; these do not by themselves show the technology is used.');
            else if (support === 'partial') lim.push('Evidence is limited to a single kind of signal or only weak signals.');
            if (evidence.every((e) => perRepoIsFork(outcomes, e.repository))) lim.push('All evidence comes from forked repositories.');
        }
        claims.push({ claim_type: 'skill', claim: s.name, status, confidence: null, resume_references: s.references, evidence: evidence.slice(0, 8), limitations: lim });
    }

    // 7. Project claims
    for (const p of projects) {
        claims.push(projectClaim(p, projectTarget.get(p.name), outcomes, perRepo, p.repositoryUrls.length > 0));
    }

    const summary = emptySummary();
    for (const c of claims) summary[c.status]++;

    const repositories: RepositorySummary[] = outcomes.map((o) => {
        const c = o.collected;
        const full = c?.meta.full_name ?? `${o.target.owner}/${o.target.name}`;
        return {
            full_name: full,
            url: c?.meta.html_url ?? `https://github.com/${full}`,
            resolution: o.target.resolution,
            status: c ? c.status : 'not_accessible',
            default_branch: c?.meta.default_branch ?? null,
            commit_sha: c?.facts.sha ?? null,
            is_fork: c?.meta.fork ?? o.target.meta?.fork ?? false,
            pushed_at: c?.meta.pushed_at ?? o.target.meta?.pushed_at ?? null,
            languages: c?.facts.languages ?? {},
            files_examined: c?.filesExamined ?? 0,
            notes: c ? c.notes : [o.skipped ? 'Not inspected: per-run limit reached.' : (o.failure ?? 'Not inspected.')],
        };
    });

    return {
        github_profile: { username: login, profile_url: profileUrl, access_mode: 'public', username_source: source, checked_at: now().toISOString() },
        repositories,
        claims,
        summary,
        limitations,
        assessment_score_changed: false,
    };
}

function perRepoIsFork(outcomes: Outcome[], fullNameStr: string) {
    return outcomes.find((o) => o.collected?.meta.full_name === fullNameStr)?.collected?.meta.fork ?? false;
}

function projectClaim(
    p: ProjectClaim,
    resolved: { target: Target; approximate: boolean } | undefined,
    outcomes: Outcome[],
    perRepo: Map<string, Map<string, Evidence[]>>,
    hadLink: boolean,
): Claim {
    const base = { claim_type: 'project' as const, claim: p.name, confidence: null, resume_references: [`Project: ${p.name}`] };
    if (!resolved) {
        return {
            ...base,
            status: 'insufficient_evidence',
            evidence: [],
            limitations: [hadLink ? 'The repository URL(s) on the resume are not valid GitHub repository links, and no public repository with a matching name was found.' : 'No repository link on the resume and no public repository with a matching name was found.'],
            repository: null,
            technologies: p.technologies.map((t) => ({ technology: t.name, status: 'not_checked' as const })),
        };
    }

    const { target, approximate } = resolved;
    const outcome = outcomes.find((o) => o.target === target)!;
    const repo = `${target.owner}/${target.name}`;
    if (outcome.skipped) {
        return { ...base, status: 'not_checked', evidence: [], limitations: ['Repository was not inspected because the per-run repository limit was reached.'], repository: repo, technologies: [] };
    }
    if (!outcome.collected) {
        return { ...base, status: 'not_accessible', evidence: [], limitations: [`Repository ${repo}: ${outcome.failure ?? 'could not be inspected.'} This does not show the project is not genuine.`], repository: repo, technologies: [] };
    }

    const c = outcome.collected;
    const byTech = perRepo.get(`${target.owner}/${target.name}`.toLowerCase())!;
    const technologies = p.technologies.map((t) => {
        if (!lookupRule(t.key)) return { technology: t.name, status: 'not_checked' as ClaimStatus, evidence: [] as Evidence[] };
        const evidence = (byTech.get(t.key) ?? []).sort(bestFirst);
        const a = assessEvidence(evidence);
        return { technology: t.name, status: (a === 'supported' ? 'supported' : a === 'partial' ? 'partially_supported' : 'insufficient_evidence') as ClaimStatus, evidence };
    });
    const checkable = technologies.filter((t) => t.status !== 'not_checked');
    const hits = checkable.filter((t) => t.status === 'supported' || t.status === 'partially_supported');

    const lim: string[] = [];
    if (p.featureCount) lim.push(`${p.featureCount} described feature(s) were not individually verified.`);
    if (target.resolution !== 'linked_url') lim.push(`Repository was matched by ${approximate ? 'an approximate' : 'its'} name, not a link on the resume.`);
    if (c.meta.fork) lim.push('Repository is a fork; ownership does not show the candidate wrote its code.');
    if (c.status === 'partially_examined') lim.push('Repository was only partially inspected.');
    const unsupported = checkable.filter((t) => t.status === 'insufficient_evidence').map((t) => t.technology);
    if (unsupported.length) lim.push(`No evidence found for: ${unsupported.join(', ')}.`);
    if (technologies.length > checkable.length) lim.push('Some listed technologies have no automated check.');

    // Feature-level verification is not implemented, so a project is at most partially supported.
    let status: ClaimStatus;
    if (checkable.length === 0) status = 'partially_supported';
    else if (hits.length === 0) {
        status = c.status === 'partially_examined' ? 'insufficient_evidence' : 'needs_review';
        lim.push('The repository was found but none of the claimed technologies were detected; it may be the wrong repository or not fully inspected.');
    } else status = approximate || c.meta.fork ? 'needs_review' : 'partially_supported';

    const metaEvidence: Evidence = {
        evidence_type: 'repository_metadata',
        repository: c.meta.full_name,
        path: null,
        url: c.meta.html_url,
        commit_sha: c.facts.sha,
        observation: `Public repository found${c.meta.pushed_at ? `; last pushed ${c.meta.pushed_at.slice(0, 10)}` : ''}`,
        strength: target.resolution === 'linked_url' ? 'moderate' : 'weak',
    };
    const techEvidence = technologies.flatMap((t) => t.evidence.slice(0, 1));
    return {
        ...base,
        status,
        evidence: [metaEvidence, ...techEvidence],
        limitations: lim,
        repository: c.meta.full_name,
        technologies: technologies.map(({ technology, status }) => ({ technology, status })),
    };
}
