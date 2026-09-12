import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureAssignmentSchema } from '@/lib/academic/assignment-schema';
import { ensureSourceSchema } from '@/lib/academic/source-schema';
import { ensureContentSchema } from '@/lib/academic/content-schema';
import { registerStudentFirst, ValidationError } from '@/lib/academic/register';
import { ingestSourceDocument } from '@/lib/academic/source';
import {
  generateContentForTopic,
  publishContentItem,
  type ContentItem,
} from '@/lib/academic/content-bank';
import { choiceOrderFor, seedFor } from '@/lib/academic/delivery';
import { answerHomework, listHomeworkForStudent, materializeHomework } from '@/lib/academic/homework';

/**
 * Answering a bank-backed homework question: the student can see and answer the question, and
 * the answer key is not handed out before they do.
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

const SOURCE_TEXT = 'Fractions name equal parts of a whole and the denominator counts them. '.repeat(
  30,
);

function llmReturning(raw: string): (prompt: string) => Promise<string> {
  return async () => raw;
}

const CORRECT_CHOICE = 'The parts';

async function register(suffix: string): Promise<string> {
  await registerStudentFirst(pool, {
    studentEmail: `student-${suffix}@test.dev`,
    studentPassword: 'password12',
    studentDisplayName: `Student ${suffix}`,
    academicLevel: 'primary',
    formLevel: 'standard-5',
    parentEmail: `parent-${suffix}@test.dev`,
    parentPassword: 'password12',
    parentDisplayName: `Parent ${suffix}`,
  });
  const row = await pool.query<{ id: string }>(
    `SELECT s.id FROM academic_students s JOIN academic_users u ON u.id = s.user_id
      WHERE u.email = $1`,
    [`student-${suffix}@test.dev`],
  );
  return row.rows[0]!.id;
}

async function publishOne(topicId: string): Promise<ContentItem> {
  await ingestSourceDocument(pool, {
    formId: 'std5',
    subjectId: 'std5-math',
    title: 'Primary Mathematics 5',
    pages: [{ pageNumber: 1, text: `Chapter 1\n\n${SOURCE_TEXT}` }],
  });
  const generated = await generateContentForTopic(pool, {
    subjectId: 'std5-math',
    topicId,
    kind: 'homework',
    llm: llmReturning(
      JSON.stringify([
        {
          prompt: 'What does the denominator count?',
          choices: [CORRECT_CHOICE, 'The whole', 'The sum', 'The remainder'],
          correctIndex: 0,
          explanation: 'It counts the equal parts.',
        },
      ]),
    ),
  });
  if (!generated.ok) throw new Error('expected generation to succeed');
  return publishContentItem(pool, generated.items[0]!.id);
}

/** The homework row for a topic, after the bank has been consulted. */
async function homeworkIdFor(studentId: string, topicId: string): Promise<string> {
  const homework = await listHomeworkForStudent(pool, studentId);
  const item = [...homework.overdue, ...homework.dueSoon, ...homework.later].find(
    (entry) => entry.topicId === topicId,
  );
  if (!item) throw new Error(`no homework for ${topicId}`);
  return item.id;
}

beforeEach(async () => {
  pool = new PGlitePool(new PGlite());
  await ensureAcademicSchema(pool);
  await ensureCurriculumSchema(pool);
  await ensureAssignmentSchema(pool);
  await seedCurriculum(pool);
  await ensureSourceSchema(pool);
  await ensureContentSchema(pool);
  amina = await register('hwans-a');
  juma = await register('hwans-b');
});

afterEach(async () => {
  await pool.db.close();
});

describe('the question a student sees', () => {
  it('shows the prompt and the choices', async () => {
    await publishOne('std5-math-1');
    const homework = await listHomeworkForStudent(pool, amina);
    const item = [...homework.overdue, ...homework.dueSoon, ...homework.later].find(
      (entry) => entry.topicId === 'std5-math-1',
    );

    expect(item?.content?.prompt).toBe('What does the denominator count?');
    expect(item?.content?.choices).toHaveLength(4);
    expect(new Set(item?.content?.choices ?? []).size).toBe(4);
  });

  it('withholds the answer until the student has answered', async () => {
    await publishOne('std5-math-1');
    const homework = await listHomeworkForStudent(pool, amina);
    const item = [...homework.overdue, ...homework.dueSoon, ...homework.later].find(
      (entry) => entry.topicId === 'std5-math-1',
    );

    expect(item?.content?.correctIndex).toBeNull();
    expect(item?.content?.explanation).toBe('');
    expect(item?.content?.answeredIndex).toBeNull();
  });

  it('reveals the explanation only afterwards', async () => {
    const item = await publishOne('std5-math-1');
    const homeworkId = await homeworkIdFor(amina, 'std5-math-1');
    const order = choiceOrderFor(4, seedFor(amina, item.id));
    const shown = order.indexOf(0);

    await answerHomework(pool, amina, homeworkId, shown);

    const after = await listHomeworkForStudent(pool, amina);
    const answered = [...after.overdue, ...after.dueSoon, ...after.later].find(
      (entry) => entry.topicId === 'std5-math-1',
    );
    expect(answered?.content?.correctIndex).toBe(shown);
    expect(answered?.content?.explanation).toBe('It counts the equal parts.');
    expect(answered?.content?.wasCorrect).toBe(true);
  });

  it('shows the choices in each student’s own order', async () => {
    const item = await publishOne('std5-math-1');
    const forAmina = await listHomeworkForStudent(pool, amina);
    const forJuma = await listHomeworkForStudent(pool, juma);
    const choicesOf = (list: typeof forAmina) =>
      [...list.overdue, ...list.dueSoon, ...list.later].find(
        (entry) => entry.topicId === 'std5-math-1',
      )?.content?.choices;

    expect(choicesOf(forAmina)).toEqual(
      choiceOrderFor(4, seedFor(amina, item.id)).map(
        (index) => [CORRECT_CHOICE, 'The whole', 'The sum', 'The remainder'][index],
      ),
    );
    expect(choicesOf(forJuma)).toEqual(
      choiceOrderFor(4, seedFor(juma, item.id)).map(
        (index) => [CORRECT_CHOICE, 'The whole', 'The sum', 'The remainder'][index],
      ),
    );
    expect(choicesOf(forAmina)).not.toEqual(choicesOf(forJuma));
  });

  it('leaves homework with no published question without one', async () => {
    await publishOne('std5-math-1');
    const homework = await listHomeworkForStudent(pool, amina);
    const untouched = [...homework.overdue, ...homework.dueSoon, ...homework.later].find(
      (entry) => entry.topicId === 'std5-math-2',
    );
    expect(untouched?.content).toBeNull();
  });
});

describe('answerHomework', () => {
  it('grades the position clicked, not the stored position', async () => {
    const item = await publishOne('std5-math-1');
    const homeworkId = await homeworkIdFor(amina, 'std5-math-1');
    const order = choiceOrderFor(4, seedFor(amina, item.id));
    const shownCorrect = order.indexOf(0);

    const right = await answerHomework(pool, amina, homeworkId, shownCorrect);
    expect(right.correct).toBe(true);
    expect(right.correctIndex).toBe(shownCorrect);
  });

  it('marks a wrong choice wrong and still shows the right one', async () => {
    const item = await publishOne('std5-math-1');
    const homeworkId = await homeworkIdFor(amina, 'std5-math-1');
    const order = choiceOrderFor(4, seedFor(amina, item.id));
    const shownCorrect = order.indexOf(0);
    const shownWrong = [0, 1, 2, 3].find((index) => index !== shownCorrect)!;

    const wrong = await answerHomework(pool, amina, homeworkId, shownWrong);
    expect(wrong.correct).toBe(false);
    expect(wrong.correctIndex).toBe(shownCorrect);
  });

  it('remembers which position the student clicked', async () => {
    const item = await publishOne('std5-math-1');
    const homeworkId = await homeworkIdFor(amina, 'std5-math-1');
    const order = choiceOrderFor(4, seedFor(amina, item.id));
    const shown = order.indexOf(0);

    await answerHomework(pool, amina, homeworkId, shown);

    const homework = await listHomeworkForStudent(pool, amina);
    const answered = [...homework.overdue, ...homework.dueSoon, ...homework.later].find(
      (entry) => entry.topicId === 'std5-math-1',
    );
    expect(answered?.content?.answeredIndex).toBe(shown);
  });

  it('does not submit the homework — that stays the student’s own action', async () => {
    const item = await publishOne('std5-math-1');
    const homeworkId = await homeworkIdFor(amina, 'std5-math-1');
    const order = choiceOrderFor(4, seedFor(amina, item.id));

    await answerHomework(pool, amina, homeworkId, order.indexOf(0));

    const homework = await listHomeworkForStudent(pool, amina);
    const answered = [...homework.overdue, ...homework.dueSoon, ...homework.later].find(
      (entry) => entry.topicId === 'std5-math-1',
    );
    expect(answered?.status).toBe('pending');
    expect(answered?.submittedAt).toBeNull();
  });

  it('refuses an answer to someone else’s homework', async () => {
    const item = await publishOne('std5-math-1');
    const homeworkId = await homeworkIdFor(amina, 'std5-math-1');
    const order = choiceOrderFor(4, seedFor(juma, item.id));

    await expect(answerHomework(pool, juma, homeworkId, order.indexOf(0))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('refuses an out-of-range choice instead of scoring it', async () => {
    await publishOne('std5-math-1');
    const homeworkId = await homeworkIdFor(amina, 'std5-math-1');
    await expect(answerHomework(pool, amina, homeworkId, 9)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('refuses to answer homework that has no question', async () => {
    await materializeHomework(pool, amina);
    const homework = await listHomeworkForStudent(pool, amina);
    const plain = [...homework.overdue, ...homework.dueSoon, ...homework.later].find(
      (entry) => entry.topicId === 'std5-math-2',
    );
    await expect(answerHomework(pool, amina, plain!.id, 0)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
