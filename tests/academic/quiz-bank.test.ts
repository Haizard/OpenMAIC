import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureSourceSchema } from '@/lib/academic/source-schema';
import { ensureContentSchema } from '@/lib/academic/content-schema';
import { ensureQuizBankSchema } from '@/lib/academic/quiz-bank-schema';
import { registerStudentFirst, ValidationError } from '@/lib/academic/register';
import { ingestSourceDocument } from '@/lib/academic/source';
import { generateContentForTopic, publishContentItem } from '@/lib/academic/content-bank';
import {
  listBankQuizAttempts,
  listBankQuizzes,
  MIN_ITEMS_FOR_QUIZ,
  QUIZ_LENGTH,
  startBankQuiz,
  submitBankQuiz,
} from '@/lib/academic/quiz-bank';

/**
 * Phase G: a quiz is a topic with published quiz items in the bank. There is no author and no
 * teacher — the bank is the quiz — and the score is worked out on the server from the seed.
 */

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

let pool: PGlitePool;
let amina = '';
let juma = '';
let baraka = '';

const SUBJECT_ID = 'std5-math';
const TOPIC_ID = 'std5-math-1';
const SOURCE_TEXT = 'Fractions name equal parts of a whole and the denominator counts them. '.repeat(
  30,
);

const CORRECT_CHOICE = 'The parts';

function llmReturning(raw: string): (prompt: string) => Promise<string> {
  return async () => raw;
}

function validModelOutput(count: number): string {
  return JSON.stringify(
    Array.from({ length: count }, (_unused, index) => ({
      prompt: `Fractions question ${index}`,
      choices: [CORRECT_CHOICE, 'The whole', 'The sum', 'The remainder'],
      correctIndex: 0,
      explanation: 'It counts the equal parts.',
    })),
  );
}

async function register(suffix: string, formLevel = 'standard-5'): Promise<string> {
  await registerStudentFirst(pool, {
    studentEmail: `student-${suffix}@test.dev`,
    studentPassword: 'password12',
    studentDisplayName: `Student ${suffix}`,
    academicLevel: 'primary',
    formLevel,
    parentEmail: `parent-${suffix}@test.dev`,
    parentPassword: 'password12',
    parentDisplayName: `Parent ${suffix}`,
  });
  const row = await pool.query<{ id: string }>(
    `SELECT s.id FROM academic_students s JOIN academic_users u ON u.id = s.user_id
      WHERE u.email = $1`,
    [`student-${suffix}@test.dev`],
  );
  return row.rows[0]?.id ?? '';
}

/** Publish `count` quiz items on a topic. Ingesting the same book twice is a no-op. */
async function publishQuizItems(topicId: string, count: number): Promise<void> {
  await ingestSourceDocument(pool, {
    formId: 'std5',
    subjectId: SUBJECT_ID,
    title: 'Primary Mathematics 5',
    pages: [{ pageNumber: 1, text: `Chapter 1\n\n${SOURCE_TEXT}` }],
  });
  const generated = await generateContentForTopic(pool, {
    subjectId: SUBJECT_ID,
    topicId,
    kind: 'quiz',
    llm: llmReturning(validModelOutput(count)),
  });
  if (!generated.ok) throw new Error(`generation failed: ${generated.message}`);
  for (const item of generated.items) {
    await publishContentItem(pool, item.id);
  }
}

/** Every answer right, by finding the correct choice in the order this student was shown. */
async function allRight(studentId: string, topicId: string) {
  const questions = await startBankQuiz(pool, studentId, topicId);
  return questions.map((question) => ({
    itemId: question.itemId,
    choiceIndex: question.choices.indexOf(CORRECT_CHOICE),
  }));
}

beforeEach(async () => {
  pool = new PGlitePool(new PGlite());
  await ensureAcademicSchema(pool);
  await ensureCurriculumSchema(pool);
  await seedCurriculum(pool);
  await ensureSourceSchema(pool);
  await ensureContentSchema(pool);
  await ensureQuizBankSchema(pool);
  amina = await register('quiz-a');
  juma = await register('quiz-b');
  baraka = await register('quiz-c', 'standard-6');
});

afterEach(async () => {
  await pool.db.close();
});

describe('listBankQuizzes', () => {
  it('offers nothing before anything is published', async () => {
    expect(await listBankQuizzes(pool, amina)).toEqual([]);
  });

  it('offers a topic once it has enough published quiz items', async () => {
    await publishQuizItems(TOPIC_ID, MIN_ITEMS_FOR_QUIZ);

    const quizzes = await listBankQuizzes(pool, amina);
    expect(quizzes).toHaveLength(1);
    expect(quizzes[0]?.topicId).toBe(TOPIC_ID);
    expect(quizzes[0]?.questionCount).toBe(MIN_ITEMS_FOR_QUIZ);
    expect(quizzes[0]?.subjectName).toBeTruthy();
  });

  it('does not offer a topic with too few items to make a real quiz', async () => {
    await publishQuizItems(TOPIC_ID, MIN_ITEMS_FOR_QUIZ - 1);
    expect(await listBankQuizzes(pool, amina)).toEqual([]);
  });

  it('caps the quiz at its length even when the bank holds more', async () => {
    await publishQuizItems(TOPIC_ID, QUIZ_LENGTH + 4);

    const quizzes = await listBankQuizzes(pool, amina);
    expect(quizzes[0]?.questionCount).toBe(QUIZ_LENGTH);
  });

  it('never offers another form’s topics', async () => {
    await publishQuizItems(TOPIC_ID, MIN_ITEMS_FOR_QUIZ);

    // Baraka is in Standard 6; the Standard 5 topic is not his to sit.
    expect(await listBankQuizzes(pool, baraka)).toEqual([]);
  });

  it('reports how the student has done on each quiz', async () => {
    await publishQuizItems(TOPIC_ID, MIN_ITEMS_FOR_QUIZ);

    await submitBankQuiz(pool, amina, TOPIC_ID, await allRight(amina, TOPIC_ID));
    await submitBankQuiz(pool, amina, TOPIC_ID, []);

    const [quiz] = await listBankQuizzes(pool, amina);
    expect(quiz?.attemptCount).toBe(2);
    expect(quiz?.bestScore).toBe(MIN_ITEMS_FOR_QUIZ);
    expect(quiz?.lastScore).toBe(0);
  });
});

describe('startBankQuiz', () => {
  it('shows the questions without marking the answer', async () => {
    await publishQuizItems(TOPIC_ID, MIN_ITEMS_FOR_QUIZ);

    const questions = await startBankQuiz(pool, amina, TOPIC_ID);
    expect(questions).toHaveLength(MIN_ITEMS_FOR_QUIZ);
    expect(new Set(questions.map((question) => question.prompt)).size).toBe(MIN_ITEMS_FOR_QUIZ);
    for (const question of questions) {
      expect(question.choices).toHaveLength(4);
      expect(question.choices).toContain(CORRECT_CHOICE);
    }
  });

  it('gives two students in the same class different orders', async () => {
    await publishQuizItems(TOPIC_ID, MIN_ITEMS_FOR_QUIZ);

    const forAmina = await startBankQuiz(pool, amina, TOPIC_ID);
    const forJuma = await startBankQuiz(pool, juma, TOPIC_ID);

    const aminaOrder = forAmina.map((question) => question.choices.join('|')).join('//');
    const jumaOrder = forJuma.map((question) => question.choices.join('|')).join('//');
    expect(aminaOrder).not.toBe(jumaOrder);
  });

  it('is the same quiz when the same student reloads', async () => {
    await publishQuizItems(TOPIC_ID, MIN_ITEMS_FOR_QUIZ);

    const first = await startBankQuiz(pool, amina, TOPIC_ID);
    const second = await startBankQuiz(pool, amina, TOPIC_ID);
    expect(second.map((question) => question.itemId)).toEqual(
      first.map((question) => question.itemId),
    );
  });

  it('refuses a topic that is not in the student’s form', async () => {
    await publishQuizItems(TOPIC_ID, MIN_ITEMS_FOR_QUIZ);
    await expect(startBankQuiz(pool, baraka, TOPIC_ID)).rejects.toThrow(ValidationError);
  });

  it('refuses a topic with no published quiz yet', async () => {
    await expect(startBankQuiz(pool, amina, TOPIC_ID)).rejects.toThrow(
      /No quiz is ready/i,
    );
  });
});

describe('submitBankQuiz', () => {
  beforeEach(async () => {
    await publishQuizItems(TOPIC_ID, MIN_ITEMS_FOR_QUIZ);
  });

  it('grades the position clicked, not the position stored', async () => {
    const result = await submitBankQuiz(pool, amina, TOPIC_ID, await allRight(amina, TOPIC_ID));

    expect(result.score).toBe(MIN_ITEMS_FOR_QUIZ);
    expect(result.maxScore).toBe(MIN_ITEMS_FOR_QUIZ);
    expect(result.review.every((entry) => entry.correct)).toBe(true);
  });

  it('marks a wrong choice wrong and shows where the right one was', async () => {
    const questions = await startBankQuiz(pool, amina, TOPIC_ID);
    const answers = questions.map((question) => ({
      itemId: question.itemId,
      choiceIndex: question.choices.findIndex((choice) => choice !== CORRECT_CHOICE),
    }));

    const result = await submitBankQuiz(pool, amina, TOPIC_ID, answers);

    expect(result.score).toBe(0);
    for (const entry of result.review) {
      expect(entry.correct).toBe(false);
      expect(entry.choices[entry.correctIndex ?? -1]).toBe(CORRECT_CHOICE);
    }
  });

  it('counts questions left blank against the student', async () => {
    const questions = await startBankQuiz(pool, amina, TOPIC_ID);
    const only = [
      { itemId: questions[0]?.itemId as string, choiceIndex: 0 },
    ];

    const result = await submitBankQuiz(pool, amina, TOPIC_ID, only);

    // Out of the whole quiz, not out of what was answered: skipping is not the same as knowing.
    expect(result.maxScore).toBe(MIN_ITEMS_FOR_QUIZ);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('ignores an answer to a question that was not in this sitting', async () => {
    const result = await submitBankQuiz(pool, amina, TOPIC_ID, [
      { itemId: 'not-in-this-quiz', choiceIndex: 0 },
    ]);

    expect(result.score).toBe(0);
    expect(result.review).toHaveLength(MIN_ITEMS_FOR_QUIZ);
  });

  it('explains each answer in the review', async () => {
    const result = await submitBankQuiz(pool, amina, TOPIC_ID, await allRight(amina, TOPIC_ID));
    expect(result.review[0]?.explanation).toBe('It counts the equal parts.');
  });

  it('records the attempt, newest first', async () => {
    await submitBankQuiz(pool, amina, TOPIC_ID, await allRight(amina, TOPIC_ID));
    await submitBankQuiz(pool, amina, TOPIC_ID, []);

    const attempts = await listBankQuizAttempts(pool, amina);
    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.score).toBe(0);
    expect(attempts[1]?.score).toBe(MIN_ITEMS_FOR_QUIZ);
    expect(attempts.every((attempt) => attempt.topicId === TOPIC_ID)).toBe(true);
  });

  it('does not mix one student’s attempts into another’s', async () => {
    await submitBankQuiz(pool, amina, TOPIC_ID, await allRight(amina, TOPIC_ID));

    expect(await listBankQuizAttempts(pool, juma)).toEqual([]);
  });

  it('refuses to grade a topic outside the student’s form', async () => {
    await expect(submitBankQuiz(pool, baraka, TOPIC_ID, [])).rejects.toThrow(ValidationError);
  });
});
