import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureAssignmentSchema } from '@/lib/academic/assignment-schema';
import { ensureSourceSchema } from '@/lib/academic/source-schema';
import { ensureContentSchema } from '@/lib/academic/content-schema';
import { ensurePracticeSchema } from '@/lib/academic/practice-schema';
import { seedPracticeItems } from '@/lib/academic/practice-seed';
import { registerStudentFirst } from '@/lib/academic/register';
import { ingestSourceDocument } from '@/lib/academic/source';
import {
  generateContentForTopic,
  publishContentItem,
  type ContentItem,
} from '@/lib/academic/content-bank';
import { choiceOrderFor, seedFor } from '@/lib/academic/delivery';
import {
  answerPracticeItem,
  listPracticeItems,
  listTopicMastery,
  MIN_ATTEMPTS_FOR_MASTERY,
} from '@/lib/academic/practice';

/**
 * Phase D for practice: the drill comes from the shared bank when it has published items, and
 * from the hand-authored bank when it does not.
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

function items(count: number): string {
  return JSON.stringify(
    Array.from({ length: count }, (_unused, index) => ({
      prompt: `Denominator question ${index}`,
      choices: ['The parts', 'The whole', 'The sum', 'The remainder'],
      correctIndex: 0,
      explanation: 'The source says the denominator counts the equal parts.',
    })),
  );
}

function llmReturning(raw: string): (prompt: string) => Promise<string> {
  return async () => raw;
}

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

/** Generate `count` practice items for a topic. Publishes them only when asked. */
async function generate(topicId: string, count: number, publish: boolean): Promise<ContentItem[]> {
  await ingestSourceDocument(pool, {
    formId: 'std5',
    subjectId: 'std5-math',
    title: 'Primary Mathematics 5',
    pages: [{ pageNumber: 1, text: `Chapter 1\n\n${SOURCE_TEXT}` }],
  });
  const generated = await generateContentForTopic(pool, {
    subjectId: 'std5-math',
    topicId,
    kind: 'practice',
    llm: llmReturning(items(count)),
  });
  if (!generated.ok) throw new Error('expected generation to succeed');
  if (!publish) return [...generated.items];

  const published: ContentItem[] = [];
  for (const item of generated.items) {
    published.push(await publishContentItem(pool, item.id));
  }
  return published;
}

beforeEach(async () => {
  pool = new PGlitePool(new PGlite());
  await ensureAcademicSchema(pool);
  await ensureCurriculumSchema(pool);
  await ensureAssignmentSchema(pool);
  await seedCurriculum(pool);
  await ensureSourceSchema(pool);
  await ensureContentSchema(pool);
  await ensurePracticeSchema(pool);
  await seedPracticeItems(pool);
  amina = await register('pbank-a');
  juma = await register('pbank-b');
});

afterEach(async () => {
  await pool.db.close();
});

describe('practice from the shared bank', () => {
  it('serves published bank items instead of the hand-authored ones', async () => {
    await generate('std5-math-1', 3, true);

    const served = await listPracticeItems(pool, amina, 'std5-math-1');
    expect(served.every((item) => /^Denominator question \d$/.test(item.prompt))).toBe(true);
    expect(served.map((item) => item.id).some((id) => id.startsWith('pi-'))).toBe(false);
  });

  it('falls back to the hand-authored bank when nothing is published', async () => {
    const served = await listPracticeItems(pool, amina, 'std5-math-1');
    expect(served.length).toBeGreaterThan(0);
    expect(served.every((item) => item.id.startsWith('pi-'))).toBe(true);
  });

  it('does not serve drafts', async () => {
    await generate('std5-math-1', 3, false);
    const served = await listPracticeItems(pool, amina, 'std5-math-1');
    expect(served.every((item) => item.id.startsWith('pi-'))).toBe(true);
  });

  it('shows the same item with a different choice order to each student', async () => {
    const published = await generate('std5-math-1', 1, true);
    const itemId = published[0]!.id;

    const forAmina = await listPracticeItems(pool, amina, 'std5-math-1');
    const forJuma = await listPracticeItems(pool, juma, 'std5-math-1');

    expect(forAmina[0]?.id).toBe(itemId);
    expect(forJuma[0]?.id).toBe(itemId);
    expect(forAmina[0]?.choices).not.toEqual(forJuma[0]?.choices);
    expect([...(forAmina[0]?.choices ?? [])].sort()).toEqual(
      [...(forJuma[0]?.choices ?? [])].sort(),
    );
  });

  it('grades the position the student clicked, not where the answer is stored', async () => {
    const published = await generate('std5-math-1', 1, true);
    const item = published[0]!;

    const served = await listPracticeItems(pool, amina, 'std5-math-1');
    const shownIndex = served[0]!.choices.indexOf('The parts');
    // Whatever position the correct answer landed in, clicking it must be graded correct.
    const result = await answerPracticeItem(pool, amina, item.id, shownIndex);
    expect(result.correct).toBe(true);

    const wrongIndex = served[0]!.choices.findIndex((choice) => choice !== 'The parts');
    expect(
      (await answerPracticeItem(pool, amina, item.id, wrongIndex)).correct,
    ).toBe(false);
  });

  it('agrees with the seed the drill was shuffled with', async () => {
    const published = await generate('std5-math-1', 1, true);
    const item = published[0]!;
    const order = choiceOrderFor(4, seedFor(amina, item.id));

    const served = await listPracticeItems(pool, amina, 'std5-math-1');
    expect(served[0]?.choices).toEqual(order.map((index) => ['The parts', 'The whole', 'The sum', 'The remainder'][index]));
  });

  it('counts bank answers towards topic mastery', async () => {
    const published = await generate('std5-math-1', 1, true);
    const item = published[0]!;
    const served = await listPracticeItems(pool, amina, 'std5-math-1');
    const shownIndex = served[0]!.choices.indexOf('The parts');

    for (let attempt = 0; attempt < MIN_ATTEMPTS_FOR_MASTERY; attempt += 1) {
      await answerPracticeItem(pool, amina, item.id, shownIndex);
    }

    const mastery = await listTopicMastery(pool, amina);
    const topic = mastery.find((entry) => entry.topicId === 'std5-math-1');
    expect(topic?.attempts).toBe(MIN_ATTEMPTS_FOR_MASTERY);
    expect(topic?.accuracy).toBe(1);
    expect(topic?.label).toBe('strong');
  });

  it('keeps one student’s mastery out of another’s', async () => {
    const published = await generate('std5-math-1', 1, true);
    const item = published[0]!;
    const served = await listPracticeItems(pool, amina, 'std5-math-1');
    const shownIndex = served[0]!.choices.indexOf('The parts');

    await answerPracticeItem(pool, amina, item.id, shownIndex);

    const forJuma = await listTopicMastery(pool, juma);
    expect(forJuma.find((entry) => entry.topicId === 'std5-math-1')?.attempts).toBe(0);
  });
});
