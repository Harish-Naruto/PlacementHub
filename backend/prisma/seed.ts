/**
 * Demo data for PlacementHub. SYNTHETIC: every student, repository link and score below is invented.
 *
 *   bun run prisma/seed.ts
 *
 * Idempotent: running it twice does not duplicate users, skills or jobs.
 * Writes to the database in backend/.env (DATABASE_URL), so point that at a database you can fill with demo data.
 */

import { hash } from "@node-rs/argon2";
import prisma from "../src/config/prisma.ts";
import { TAXONOMY } from "../src/skills/taxonomy.ts";
import { FIXED_INSTITUTIONS } from "../src/services/student.service.ts";
import { resolveOrCreateSkill } from "../src/services/skill.service.ts";
import { ingestFromApi, ingestJob } from "../src/services/ingest.service.ts";
import * as recruiterPortal from "../src/services/recruiterPortal.service.ts";
import { applyForJob } from "../src/services/job.service.ts";
import { changeApplicationStatus } from "../src/services/pipeline.service.ts";

// Deterministic, no network: the seed never calls Gemini or a job API.
process.env.JOB_PARSE_LLM = "false";
process.env.INGEST_USE_FIXTURES = "true";

const PASSWORD = "Demo@12345";
const DOMAIN = "demo.placementhub.test";

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

async function seedSkills() {
  for (const s of TAXONOMY) {
    const skill = await prisma.skill.upsert({ where: { name: s.name }, update: { category: s.category }, create: { name: s.name, category: s.category } });
    const aliases = [...(s.aliases ?? []), ...(s.lookupOnly ?? [])].filter((a) => a.toLowerCase() !== s.name.toLowerCase());
    if (aliases.length) {
      await prisma.skillAlias.createMany({ data: aliases.map((alias) => ({ alias, skillId: skill.id })), skipDuplicates: true });
    }
  }
  console.log(`skills: ${TAXONOMY.length} in the taxonomy`);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

async function ensureUser(name: string, email: string, role: "STUDENT" | "RECRUITER" | "PLACEMENT") {
  const found = await prisma.user.findUnique({ where: { email } });
  if (found) return found;
  const passwordHash = await hash(PASSWORD, { algorithm: 2, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  return prisma.user.create({ data: { name, email, role, passwordHash } });
}

// ---------------------------------------------------------------------------
// Students: varied evidence so every verdict and every gap type shows up in the demo
// ---------------------------------------------------------------------------

interface SeedSkill {
    skill: string;
    /** Assessment percentage, or null if never assessed. */
    a: number | null;
    /** True when public GitHub code shows the skill. */
    gh?: boolean;
}

interface SeedStudent {
  name: string;
  slug: string;
  institution: number; // index into FIXED_INSTITUTIONS
  branch: string;
  degree: string;
  cgpa: number;
  year: number;
  note: string;
  skills: SeedSkill[];
  claimed?: string[]; // self-declared, no evidence
  projects?: { title: string; description: string; contribution?: string; repo?: string; skills: string[] }[];
}

const STUDENTS: SeedStudent[] = [
  {
    name: "Asha Rao", slug: "asha", institution: 2, branch: "Computer Science", degree: "B.Tech", cgpa: 8.6, year: 2026, note: "strong full-stack, well evidenced",
    skills: [{ skill: "React", a: 88, gh: true }, { skill: "Node.js", a: 82, gh: true }, { skill: "JavaScript", a: 90, gh: true }, { skill: "SQL", a: 70 }, { skill: "Git", a: 85, gh: true }, { skill: "Docker", a: 62 }, { skill: "REST API", a: 80, gh: true }],
    claimed: ["Kubernetes"],
    projects: [{ title: "ShopFront", description: "E-commerce storefront with search and a cart", contribution: "Built the product search and the checkout flow", repo: "https://github.com/demo-asha/shopfront", skills: ["React", "Node.js", "REST API"] }],
  },
  {
    name: "Rohan Mehta", slug: "rohan", institution: 2, branch: "Information Technology", degree: "B.Tech", cgpa: 8.2, year: 2026, note: "backend and cloud",
    skills: [{ skill: "Node.js", a: 90, gh: true }, { skill: "Express.js", a: 85, gh: true }, { skill: "PostgreSQL", a: 78, gh: true }, { skill: "Docker", a: 74, gh: true }, { skill: "AWS", a: 65 }, { skill: "REST API", a: 88, gh: true }, { skill: "SQL", a: 80 }],
    projects: [{ title: "LogiTrack API", description: "Shipment tracking API", contribution: "Designed the schema and the REST endpoints", repo: "https://github.com/demo-rohan/logitrack", skills: ["Node.js", "Express.js", "PostgreSQL"] }],
  },
  {
    name: "Priya Nair", slug: "priya", institution: 3, branch: "Computer Science", degree: "B.Tech", cgpa: 9.0, year: 2026, note: "data and analytics",
    skills: [{ skill: "Python", a: 92, gh: true }, { skill: "Pandas", a: 85, gh: true }, { skill: "SQL", a: 88 }, { skill: "Machine Learning", a: 70, gh: true }, { skill: "Excel", a: 80 }, { skill: "Power BI", a: 60 }],
    projects: [{ title: "Churn Predictor", description: "Customer churn model with a dashboard", contribution: "Cleaned the data and trained the model", repo: "https://github.com/demo-priya/churn", skills: ["Python", "Pandas", "Machine Learning"] }],
  },
  {
    name: "Karan Singh", slug: "karan", institution: 0, branch: "Computer Science", degree: "B.Tech", cgpa: 7.9, year: 2026, note: "padded resume: many claims, almost no evidence",
    skills: [{ skill: "JavaScript", a: 45 }],
    claimed: ["React", "Node.js", "Docker", "Kubernetes", "AWS", "Python", "Machine Learning", "TypeScript", "MongoDB", "GraphQL", "Redis", "Microservices"],
    projects: [{ title: "SuperApp", description: "A full platform with everything", contribution: "Built the whole thing and improved performance by 70%", skills: ["React", "Kubernetes", "Microservices"] }],
  },
  {
    name: "Sneha Kulkarni", slug: "sneha", institution: 3, branch: "Information Technology", degree: "B.Tech", cgpa: 8.0, year: 2026, note: "repository evidence only, never assessed",
    skills: [{ skill: "React", a: null, gh: true }, { skill: "TypeScript", a: null, gh: true }, { skill: "Next.js", a: null, gh: true }],
    claimed: ["Tailwind CSS"],
    projects: [{ title: "Portfolio Site", description: "Personal portfolio built with Next.js", repo: "https://github.com/demo-sneha/portfolio", skills: ["React", "Next.js", "TypeScript"] }],
  },
  {
    name: "Vikram Joshi", slug: "vikram", institution: 1, branch: "Computer Science", degree: "B.Tech", cgpa: 8.4, year: 2026, note: "devops",
    skills: [{ skill: "Docker", a: 85, gh: true }, { skill: "Kubernetes", a: 70, gh: true }, { skill: "AWS", a: 78 }, { skill: "Linux", a: 80 }, { skill: "Bash", a: 72, gh: true }, { skill: "CI/CD", a: 66, gh: true }],
  },
  {
    name: "Ananya Iyer", slug: "ananya", institution: 1, branch: "Computer Science", degree: "B.Tech", cgpa: 9.1, year: 2026, note: "frontend specialist",
    skills: [{ skill: "React", a: 92, gh: true }, { skill: "TypeScript", a: 85, gh: true }, { skill: "Tailwind CSS", a: 80, gh: true }, { skill: "HTML", a: 90 }, { skill: "CSS", a: 88 }, { skill: "JavaScript", a: 91, gh: true }, { skill: "Git", a: 80 }],
    projects: [{ title: "Design System Kit", description: "Reusable component library", contribution: "Built the component library and its documentation site", repo: "https://github.com/demo-ananya/kit", skills: ["React", "TypeScript", "Tailwind CSS"] }],
  },
  {
    name: "Aditya Verma", slug: "aditya", institution: 0, branch: "Computer Science", degree: "B.Tech", cgpa: 7.8, year: 2026, note: "java and data structures",
    skills: [{ skill: "Java", a: 80, gh: true }, { skill: "Spring Boot", a: 60 }, { skill: "SQL", a: 75 }, { skill: "Data Structures", a: 85 }, { skill: "OOP", a: 82 }],
  },
  {
    name: "Neha Deshmukh", slug: "neha", institution: 2, branch: "Computer Science", degree: "B.Tech", cgpa: 6.2, year: 2026, note: "strong skills but CGPA below most cut-offs",
    skills: [{ skill: "React", a: 86, gh: true }, { skill: "Node.js", a: 80, gh: true }, { skill: "JavaScript", a: 88, gh: true }, { skill: "MongoDB", a: 74 }, { skill: "Git", a: 78 }],
  },
  {
    name: "Rahul Sharma", slug: "rahul", institution: 3, branch: "Mechanical", degree: "B.Tech", cgpa: 8.0, year: 2026, note: "different branch",
    skills: [{ skill: "Python", a: 70, gh: true }, { skill: "Excel", a: 82 }, { skill: "Data Analysis", a: 68 }],
  },
  {
    name: "Meera Pillai", slug: "meera", institution: 2, branch: "Electronics & Communication", degree: "B.Tech", cgpa: 8.3, year: 2026, note: "embedded",
    skills: [{ skill: "C", a: 80 }, { skill: "C++", a: 75, gh: true }, { skill: "Embedded Systems", a: 70 }, { skill: "Python", a: 60 }],
  },
  {
    name: "Imran Shaikh", slug: "imran", institution: 0, branch: "Computer Science", degree: "B.Tech", cgpa: 8.5, year: 2027, note: "strong, but the 2027 batch",
    skills: [{ skill: "React", a: 80, gh: true }, { skill: "Node.js", a: 78, gh: true }, { skill: "JavaScript", a: 85, gh: true }, { skill: "MongoDB", a: 70 }],
  },
];

const statusFor = (a: number | null, gh: boolean) => {
  if (a === null) return gh ? "REPOSITORY_OBSERVED" : "SELF_DECLARED";
  if (a >= 60) return "EVALUATED";
  return "NEEDS_REVIEW";
};

async function seedStudent(s: SeedStudent) {
  const user = await ensureUser(s.name, `${s.slug}@${DOMAIN}`, "STUDENT");
  const institution = FIXED_INSTITUTIONS[s.institution]!;
  await prisma.institution.upsert({ where: { id: institution.id }, update: {}, create: { id: institution.id, name: institution.name, slug: institution.slug, city: institution.city, state: institution.state } });
  const profile = await prisma.studentProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, institutionId: institution.id, branch: s.branch, degree: s.degree, cgpa: s.cgpa, graduationYear: s.year, githubUsername: `demo-${s.slug}`, bio: `Demo student: ${s.note}` },
  });

  for (const k of s.skills) {
    const skill = await resolveOrCreateSkill(k.skill);
    const gh = k.gh === true;
    const combinedScore = k.a === null ? null : gh ? Math.round(0.8 * k.a + 0.2 * 100) : k.a;
    const studentSkill = await prisma.studentSkill.upsert({
      where: { studentProfileId_skillId: { studentProfileId: profile.id, skillId: skill.id } },
      update: {},
      create: {
        studentProfileId: profile.id,
        skillId: skill.id,
        declaredLevel: "INTERMEDIATE",
        verificationStatus: statusFor(k.a, gh),
        assessmentScore: k.a,
        githubScore: gh ? 100 : null,
        combinedScore,
        evidenceStrength: gh ? "high" : "unknown",
        scoredAt: new Date(),
      },
    });
    const exists = await prisma.skillEvidence.count({ where: { studentSkillId: studentSkill.id } });
    if (exists === 0) {
      if (k.a !== null) {
        await prisma.skillEvidence.create({
          data: { studentSkillId: studentSkill.id, sourceType: "ASSESSMENT", sourceUrl: `assessment:seed-${s.slug}`, description: `AI assessment score ${k.a}% (demo data)`, status: k.a >= 60 ? "EVALUATED" : k.a >= 40 ? "OBSERVED" : "REJECTED", reviewedAt: new Date() },
        });
      }
      if (gh) {
        const file = /react|next/i.test(k.skill) ? "package.json" : /node|express/i.test(k.skill) ? "server.js" : /python|pandas|machine/i.test(k.skill) ? "requirements.txt" : "README.md";
        await prisma.skillEvidence.create({
          data: { studentSkillId: studentSkill.id, sourceType: "GITHUB_REPOSITORY", sourceUrl: `https://github.com/demo-${s.slug}/app/blob/0000000/${file}`, description: `Dependency declared in demo-${s.slug}/app (demo data)`, status: "OBSERVED" },
        });
      }
    }
  }

  for (const name of s.claimed ?? []) {
    const skill = await resolveOrCreateSkill(name);
    await prisma.studentSkill.upsert({
      where: { studentProfileId_skillId: { studentProfileId: profile.id, skillId: skill.id } },
      update: {},
      create: { studentProfileId: profile.id, skillId: skill.id, declaredLevel: "INTERMEDIATE", verificationStatus: "SELF_DECLARED" },
    });
  }

  for (const p of s.projects ?? []) {
    const have = await prisma.project.findFirst({ where: { studentProfileId: profile.id, title: p.title } });
    if (have) continue;
    const skillIds = await Promise.all(p.skills.map(async (n) => (await resolveOrCreateSkill(n)).id));
    await prisma.project.create({
      data: {
        studentProfileId: profile.id,
        title: p.title,
        description: p.description,
        personalContribution: p.contribution ?? null,
        repositoryUrl: p.repo ?? null,
        status: "SUBMITTED",
        skills: { create: [...new Set(skillIds)].map((skillId) => ({ skillId })) },
      },
    });
  }
  return user;
}

// ---------------------------------------------------------------------------
// Openings: one opening arrives from four places and must end up as ONE job
// ---------------------------------------------------------------------------

const ACME_RECRUITER_POST = `ReactJS Developer
Company: Acme Pvt Ltd
Location: Pune (Hybrid)
Batch: 2026 freshers
Eligibility: CSE, IT branches, minimum 7.5 CGPA

Requirements:
- Strong React.js and JavaScript
- Node.js and REST APIs
- Git

Nice to have: Docker, TypeScript
Apply by 31 Dec 2027`;

const ACME_PARTNER_PASTE = `*Hiring: React.js developer at ACME*
Location: Pune
Freshers 2026 batch, CSE/IT, 7.5+ CGPA

Must have: React, JavaScript, Node, REST API
Good to have: Docker, AWS

Partner HR contact: hr@acme.example`;

const ACME_ALUMNI = `Referral from alumni: Acme is hiring a ReactJS Developer in Pune (hybrid).
Company: Acme Technologies
Requirements:
React, JavaScript, Git
Bonus: TypeScript, Next.js`;

const GLOBEX_RECRUITER_POST = `Backend Engineer (Node.js)
Company: Globex Software
Location: Remote
Batch: 2025, 2026
Eligibility: CSE, IT, ECE, minimum 7.0 CGPA

Requirements:
- Node.js and Express.js
- PostgreSQL and SQL
- REST API design

Preferred: Redis, AWS, Docker
Apply by 31 Dec 2027`;

const STARTUP_PASTE = `Software Intern - Web
Company: Pixel Labs
Location: Mumbai
Internship for 2026 and 2027 batch, any branch, 6.5 CGPA

Requirements: JavaScript, HTML, CSS, Git
Nice to have: React`;

async function seedJobs(placementUserId: string, recruiters: { acme: string; globex: string }) {
  // Recruiters post first (they own these openings), then everyone else sends the same jobs.
  await recruiterPortal.upsertProfile(recruiters.acme, { companyName: "Acme Technologies Pvt Ltd", website: "https://acme.example", city: "Pune", country: "India", description: "Customer dashboards for logistics teams.", jobTitle: "Campus Hiring Lead" });
  await recruiterPortal.upsertProfile(recruiters.globex, { companyName: "Globex Software", website: "https://globex.example", city: "Bengaluru", country: "India", description: "APIs for global supply chains.", jobTitle: "Engineering Manager" });

  const existing = await prisma.jobPosting.count({ where: { origin: "RECRUITER_POSTED" } });
  if (existing === 0) {
    const acme = await recruiterPortal.createJob(recruiters.acme, { jobDescription: ACME_RECRUITER_POST });
    await recruiterPortal.changeJobStatus(recruiters.acme, acme.job.id, "PUBLISHED");
    const globex = await recruiterPortal.createJob(recruiters.globex, { jobDescription: GLOBEX_RECRUITER_POST });
    await recruiterPortal.changeJobStatus(recruiters.globex, globex.job.id, "PUBLISHED");
  }

  const src = (sourceType: "PARTNER_POSTING" | "ALUMNI_REFERRAL", sourceLabel: string) => ({ sourceType, sourceLabel });
  const results = [
    await ingestJob({ text: ACME_PARTNER_PASTE, userId: placementUserId, source: src("PARTNER_POSTING", "Partner: Acme HR") }),
    await ingestJob({ text: ACME_ALUMNI, userId: placementUserId, source: src("ALUMNI_REFERRAL", "Alumni: Ravi Kulkarni (COEP 2021)") }),
    await ingestJob({ text: STARTUP_PASTE, userId: placementUserId, source: src("PARTNER_POSTING", "Partner: Pixel Labs founder") }),
  ];
  const api = await ingestFromApi("remotive", placementUserId);
  console.log(`jobs: paste/alumni ${results.map((r) => (r.created ? "new" : r.duplicate?.kind)).join(", ")}; api fixtures created ${api.created}, merged ${api.merged}, skipped ${api.skipped}`);
}

// ---------------------------------------------------------------------------
// Applications at different stages
// ---------------------------------------------------------------------------

async function seedApplications(users: Map<string, string>, recruiterUsers: { acme: string; globex: string }) {
  const acmeJob = await prisma.jobPosting.findFirst({ where: { title: { contains: "ReactJS", mode: "insensitive" }, company: { name: { contains: "Acme" } } } });
  const globexJob = await prisma.jobPosting.findFirst({ where: { title: { contains: "Backend", mode: "insensitive" }, company: { name: { contains: "Globex" } } } });
  if (!acmeJob || !globexJob) return console.log("applications: demo jobs not found, skipped");

  const apply = async (slug: string, jobId: string) => {
    try {
      return await applyForJob(jobId, users.get(slug)!, {});
    } catch (err) {
      console.log(`  ${slug}: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  };
  const move = async (appId: string | undefined, actor: string, steps: ("IN_REVIEW" | "SHORTLISTED" | "INTERVIEW_SCHEDULED" | "INTERVIEWING" | "OFFERED" | "REJECTED")[]) => {
    if (!appId) return;
    for (const to of steps) {
      try {
        await changeApplicationStatus({ applicationId: appId, actorUserId: actor, to, note: `Moved to ${to} (demo)` });
      } catch {
        // already there from an earlier run
      }
    }
  };

  const asha = await apply("asha", acmeJob.id);
  const ananya = await apply("ananya", acmeJob.id);
  const karan = await apply("karan", acmeJob.id);
  await apply("neha", acmeJob.id); // CGPA 6.2 < 7.5: refused with a clear reason
  const sneha = await apply("sneha", acmeJob.id);
  const rohan = await apply("rohan", globexJob.id);
  const priya = await apply("priya", globexJob.id);
  await apply("rahul", globexJob.id); // Mechanical: refused

  await move(asha?.id, recruiterUsers.acme, ["IN_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED"]);
  await move(ananya?.id, recruiterUsers.acme, ["IN_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED", "INTERVIEWING", "OFFERED"]);
  await move(karan?.id, recruiterUsers.acme, ["IN_REVIEW", "REJECTED"]);
  await move(sneha?.id, recruiterUsers.acme, ["IN_REVIEW"]);
  await move(rohan?.id, recruiterUsers.globex, ["IN_REVIEW", "SHORTLISTED"]);
  await move(priya?.id, recruiterUsers.globex, ["IN_REVIEW"]);
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding demo data (synthetic)...");
  await seedSkills();

  const placement = await ensureUser("Placement Cell", `placement@${DOMAIN}`, "PLACEMENT");
  const acmeRec = await ensureUser("Meera Kapoor (Acme)", `recruiter.acme@${DOMAIN}`, "RECRUITER");
  const globexRec = await ensureUser("Dev Malhotra (Globex)", `recruiter.globex@${DOMAIN}`, "RECRUITER");

  const users = new Map<string, string>();
  for (const s of STUDENTS) users.set(s.slug, (await seedStudent(s)).id);
  console.log(`students: ${STUDENTS.length}`);

  await seedJobs(placement.id, { acme: acmeRec.id, globex: globexRec.id });
  await seedApplications(users, { acme: acmeRec.id, globex: globexRec.id });

  console.log("\nDemo logins (password for all: " + PASSWORD + ")");
  console.log(`  placement  placement@${DOMAIN}`);
  console.log(`  recruiter  recruiter.acme@${DOMAIN}   recruiter.globex@${DOMAIN}`);
  console.log(`  students   ${STUDENTS.map((s) => `${s.slug}@${DOMAIN}`).join("  ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
