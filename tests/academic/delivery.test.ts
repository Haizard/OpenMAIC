import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureAssignmentSchema } from '@/lib/academic/assignment-schema';
import { ensureSourceSchema } from '@/lib/academic/source-schema';
import { ensureContentSchema } from '@/lib/academic/content-schema';
import { registerStudentFirst } from '@/lib/academic/register';
import { ingestSourceDocument } from '@/lib/academic/source';
import {
  generateContentForTopic,
  publishContentItem,
  type ContentItem,
} from '@/lib/academic/content-bank';
import {
  attachContentToHomework,
  choiceOrderFor,
  deterministicShuffle,
  displayChoices,
  seedFor,
  selectContentSet,
  trueIndexFor,
} from '@/lib/academic/delivery';
import { listHomeworkForStudent, materializeHomework } from '@/lib/academic/homework';

/**
 * Phase D: the same bank, a different set for every student, and the same set again on reload.
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

/** Publish `count` homework items for a topic, and return them. */
async function publishItems(
  subjectId: string,
  formId: string,
  topicId: string,
  count: number,
): Promise<readonly ContentItem[]> {
  await ingestSourceDocument(pool, {
    formId,
    subjectId,
    title: `Book for ${subjectId}`,
    pages: [{ pageNumber: 1, text: `Chapter 1\n\n${SOURCE_TEXT}` }],
  });
  const generated = await generateContentForTopic(pool, {
    subjectId,
    topicId,
    kind: 'homework',
    llm: llmReturning(items(count)),
  });
  if (!generated.ok) throw new Error('expected generation to succeed');

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
  amina = await register('deliv-a');
  juma = await register('deliv-b');
});

afterEach(async () => {
  await pool.db.close();
});

describe('seeded shuffling', () => {
  it('is stable for the same seed', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(deterministicShuffle(input, seedFor('s1', 'k'))).toEqual(
      deterministicShuffle(input, seedFor('s1', 'k')),
    );
  });

  it('differs between students', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(deterministicShuffle(input, seedFor('amina', 'k'))).not.toEqual(
      deterministicShuffle(input, seedFor('juma', 'k')),
    );
  });

  it('never drops or duplicates an element', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect([...deterministicShuffle(input, 99)].sort((a, b) => a - b)).toEqual(input);
  });

  it('leaves the input alone', () => {
    const input = [1, 2, 3, 4];
    deterministicShuffle(input, 5);
    expect(input).toEqual([1, 2, 3, 4]);
  });
});

describe('choice ordering', () => {
  it('produces a permutation of every index', () => {
    const order = choiceOrderFor(4, seedFor(amina, 'item-1'));
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });

  it('maps the displayed answer back to the stored one', async () => {
    const item = (await publishItems('std5-math', 'std5', 'std5-math-1', 1))[0]!;
    const shown = displayChoices(item, amina);
    expect(shown.correctDisplayIndex).not.toBeNull();
    const recovered = trueIndexFor(shown.order, shown.correctDisplayIndex!);
    expect(recovered).toBe(item.correctIndex);
  });

  it('shows the same choices to two students in a different order', async () => {
    const item = (await publishItems('std5-math', 'std5', 'std5-math-1', 1))[0]!;
    const forAmina = displayChoices(item, amina);
    const forJuma = displayChoices(item, juma);
    expect([...forAmina.choices].sort()).toEqual([...forJuma.choices].sort());

    // Any two students can land on the same permutation by chance — with four choices that is
    // 1 in 24, which is a test that fails every few runs. What has to hold is that the order
    // varies across students at all, so assert that instead.
    const orders = new Set(
      [amina, juma, 'student-c', 'student-d', 'student-e', 'student-f'].map((id) =>
        choiceOrderFor(4, seedFor(id, item.id)).join(','),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('grades the clicked answer, not the position it was shown in', async () => {
    const item = (await publishItems('std5-math', 'std5', 'std5-math-1', 1))[0]!;
    const shown = displayChoices(item, amina);
    // Click whatever sits at position 0; grading must resolve it through the permutation.
    const clicked = trueIndexFor(shown.order, 0);
    expect(clicked).toBe(shown.order[0]);
    expect(clicked === item.correctIndex).toBe(shown.correctDisplayIndex === 0);
  });

  it('returns nothing for an item with no choices', async () => {
    await ingestSourceDocument(pool, {
      formId: 'std5',
      subjectId: 'std5-math',
      title: 'Book',
      pages: [{ pageNumber: 1, text: `Chapter 1\n\n${SOURCE_TEXT}` }],
    });
    const generated = await generateContentForTopic(pool, {
      subjectId: 'std5-math',
      kind: 'homework',
      llm: llmReturning(
        JSON.stringify([{ prompt: 'Explain it.', explanation: 'Because the source says so.' }]),
      ),
    });
    if (!generated.ok) throw new Error('expected generation to succeed');
    expect(displayChoices(generated.items[0]!, amina).choices).toEqual([]);
  });
});

describe('selectContentSet', () => {
  it('hands two students different sets from the same pool', async () => {
    await publishItems('std5-math', 'std5', 'std5-math-1', 6);

    const forAmina = await selectContentSet(pool, {
      studentId: amina,
      kind: 'homework',
      setKey: 'std5-math-1',
      topicId: 'std5-math-1',
      count: 3,
    });
    const forJuma = await selectContentSet(pool, {
      studentId: juma,
      kind: 'homework',
      setKey: 'std5-math-1',
      topicId: 'std5-math-1',
      count: 3,
    });

    expect(forAmina).toHaveLength(3);
    expect(forAmina.map((item) => item.id)).not.toEqual(forJuma.map((item) => item.id));
  });

  it('gives one student the same set on reload', async () => {
    await publishItems('std5-math', 'std5', 'std5-math-1', 6);
    const options = {
      studentId: amina,
      kind: 'homework' as const,
      setKey: 'std5-math-1',
      topicId: 'std5-math-1',
      count: 3,
    };

    const first = await selectContentSet(pool, options);
    const second = await selectContentSet(pool, options);
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
  });

  it('skips items the student has already answered', async () => {
    const published = await publishItems('std5-math', 'std5', 'std5-math-1', 3);
    const excluded = published[0]!.id;

    const set = await selectContentSet(pool, {
      studentId: amina,
      kind: 'homework',
      setKey: 'std5-math-1',
      topicId: 'std5-math-1',
      count: 3,
      excludeItemIds: [excluded],
    });

    expect(set.map((item) => item.id)).not.toContain(excluded);
    expect(set).toHaveLength(2);
  });

  it('returns nothing before anything is published', async () => {
    const set = await selectContentSet(pool, {
      studentId: amina,
      kind: 'homework',
      setKey: 'std5-math-1',
      topicId: 'std5-math-1',
      count: 3,
    });
    expect(set).toEqual([]);
  });
});

function pickTopic(list: Awaited<ReturnType<typeof listHomeworkForStudent>>, topicId: string) {
  return [...list.overdue, ...list.dueSoon, ...list.later].find(
    (entry) => entry.topicId === topicId,
  );
}

describe('attachContentToHomework', () => {
  it('replaces the topic blurb with the chosen question', async () => {
    const published = await publishItems('std5-math', 'std5', 'std5-math-1', 3);
    await materializeHomework(pool, amina);

    expect(await attachContentToHomework(pool, amina)).toBeGreaterThan(0);

    const item = pickTopic(await listHomeworkForStudent(pool, amina), 'std5-math-1');
    expect(item?.contentItemId).not.toBeNull();
    expect(published.map((entry) => entry.id)).toContain(item?.contentItemId);
    expect(item?.description).toMatch(/^Denominator question \d$/);
  });

  it('spreads students across the pool rather than handing everyone the same question', async () => {
    await publishItems('std5-math', 'std5', 'std5-math-1', 8);

    const picks: (string | null | undefined)[] = [];
    for (const [index, studentId] of [amina, juma].entries()) {
      const extra = index < 2 ? studentId : studentId;
      await materializeHomework(pool, extra);
      await attachContentToHomework(pool, extra);
      picks.push(pickTopic(await listHomeworkForStudent(pool, extra), 'std5-math-1')?.contentItemId);
    }
    for (const suffix of ['deliv-c', 'deliv-d', 'deliv-e']) {
      const studentId = await register(suffix);
      await materializeHomework(pool, studentId);
      await attachContentToHomework(pool, studentId);
      picks.push(
        pickTopic(await listHomeworkForStudent(pool, studentId), 'std5-math-1')?.contentItemId,
      );
    }

    expect(picks.every((pick) => typeof pick === 'string')).toBe(true);
    expect(new Set(picks).size).toBeGreaterThan(1);
  });

  it('does not rewrite a question once it has been given', async () => {
    await publishItems('std5-math', 'std5', 'std5-math-1', 6);
    await materializeHomework(pool, amina);

    expect(await attachContentToHomework(pool, amina)).toBeGreaterThan(0);
    const firstId = pickTopic(await listHomeworkForStudent(pool, amina), 'std5-math-1')
      ?.contentItemId;

    // Nothing left to attach: every homework row already points at a question.
    expect(await attachContentToHomework(pool, amina)).toBe(0);

    const secondId = pickTopic(await listHomeworkForStudent(pool, amina), 'std5-math-1')
      ?.contentItemId;
    expect(secondId).toBe(firstId);
  });

  it('leaves homework for an unpublished topic exactly as it was', async () => {
    await publishItems('std5-math', 'std5', 'std5-math-1', 3);
    await materializeHomework(pool, amina);
    await attachContentToHomework(pool, amina);

    const untouched = pickTopic(await listHomeworkForStudent(pool, amina), 'std5-math-2');
    expect(untouched?.contentItemId).toBeNull();
    expect(untouched?.description).not.toMatch(/^Denominator question/);
  });
});
