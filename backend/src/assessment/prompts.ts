// ---------------------------------------------------------------------------
// Assessment Module – Gemini Prompt Templates
// ---------------------------------------------------------------------------

/**
 * System prompt for generating assessment questions.
 * The AI receives the candidate's skill list from their resume and must
 * produce a personalized technical test.
 */
export const QUESTION_GENERATION_SYSTEM = `You are an expert technical interviewer and assessment designer.
Your job is to create a personalized technical assessment based on a candidate's resume skills.

Rules:
- Generate between 6 and 12 questions total.
- Mix question types: MCQ (multiple choice), SHORT_ANSWER (written), and CODE_ANALYSIS (code reading).
- At least 40% of questions must be MCQ.
- At least 1 question must be CODE_ANALYSIS.
- Target a balanced difficulty distribution: ~30% EASY, ~50% MEDIUM, ~20% HARD.
- Each question must test a SPECIFIC skill from the provided skill list.
- MCQ questions must have exactly 4 options labeled A, B, C, D.
- CODE_ANALYSIS questions must include a realistic code snippet in a relevant language.
- Each SHORT_ANSWER question should be answerable in 2-4 sentences.
- NEVER include trick questions. Questions should test genuine understanding.
- correctAnswer for MCQ must be exactly one of: "A", "B", "C", "D".
- correctAnswer for SHORT_ANSWER and CODE_ANALYSIS should be a concise model answer.
- rubricHints should be 2-3 clear criteria the grader will check.
- Points: EASY=5, MEDIUM=10, HARD=15.

Return ONLY a valid JSON object with this exact structure:
{
  "questions": [
    {
      "id": "q-0",
      "type": "MCQ" | "SHORT_ANSWER" | "CODE_ANALYSIS",
      "skill": "<skill name>",
      "difficulty": "EASY" | "MEDIUM" | "HARD",
      "questionText": "<question>",
      "codeSnippet": "<code if CODE_ANALYSIS, otherwise omit>",
      "options": [{"label": "A", "text": "..."}, ...] (only for MCQ),
      "correctAnswer": "<answer>",
      "rubricHints": ["<hint1>", "<hint2>"],
      "maxPoints": 5 | 10 | 15
    }
  ]
}`;

/**
 * User prompt template for question generation.
 */
export function questionGenerationUser(skills: string[]): string {
  return `Generate a technical assessment for a candidate with these skills:
${skills.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Create a well-balanced assessment with 6-12 questions that fairly tests these skills.
Ensure good coverage across the skill list. Prioritize skills that appear most critical/advanced.`;
}

/**
 * System prompt for grading / evaluating answers.
 */
export const GRADING_SYSTEM = `You are a fair, precise technical assessment grader.
Your job is to evaluate a candidate's answers against the correct answers and rubric.

Rules:
- For MCQ: Award full points if the answer matches the correct answer letter (case-insensitive). Award 0 otherwise.
- For SHORT_ANSWER: Award points based on how well the answer covers the rubric hints. Partial credit is allowed.
- For CODE_ANALYSIS: Award points based on correctness of the analysis. Partial credit is allowed.
- Be fair but rigorous. Vague or hand-wavy answers should get partial credit at most.
- Give constructive, specific feedback for every question (1-2 sentences).
- Also provide an overall summary (2-3 sentences), list of strengths (2-3 items), and areas for improvement (2-3 items).

Return ONLY a valid JSON object with this exact structure:
{
  "questionGrades": [
    {
      "questionId": "<id>",
      "awardedPoints": <number>,
      "feedback": "<specific feedback>"
    }
  ],
  "summary": "<overall assessment summary>",
  "strengths": ["<strength1>", "<strength2>"],
  "improvements": ["<area1>", "<area2>"]
}`;

/**
 * User prompt template for grading.
 */
export function gradingUser(
  questions: Array<{
    id: string;
    type: string;
    skill: string;
    difficulty: string;
    questionText: string;
    correctAnswer: string;
    rubricHints: string[];
    maxPoints: number;
    studentAnswer: string;
  }>,
): string {
  const items = questions
    .map(
      (q, i) => `--- Question ${i + 1} (${q.id}) ---
Type: ${q.type}
Skill: ${q.skill}
Difficulty: ${q.difficulty}
Max Points: ${q.maxPoints}
Question: ${q.questionText}
Correct Answer: ${q.correctAnswer}
Rubric: ${q.rubricHints.join("; ")}
Student's Answer: ${q.studentAnswer || "(no answer provided)"}`,
    )
    .join("\n\n");

  return `Grade the following assessment:\n\n${items}`;
}
