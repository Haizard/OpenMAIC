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
import type { SourcePage } from '@/lib/academic/source-chunk';
import {
  generateContentForTopic,
  listContentCoverage,
  publishContentItem,
  type ContentItem,
} from '@/lib/academic/content-bank';
import {
  FLAG_AUTO_UNPUBLISH_THRESHOLD,
  flagContentItem,
  listFlaggedItems,
  listFlagsForItem,
} from '@/lib/academic/content-flags';

/**
 * Phase E: a student can take a bad question out of circulation, and the operator can see why.
 */

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

let pool: PGlitePool;
let studentIds: string[] = [];

const SOURCE_TEXT = 'Fractions name equal parts of a whole and the denominator counts them. '.repeat(
  30,
);

function llmReturning(raw: string): (prompt: string) => Promise<string> {
  return async () => raw;
}

function oneItem(index = 0): string {
  return JSON.stringify([
    {
      prompt: `What does the denominator count? (${index})`,
      choices: ['The parts', 'The whole', 'The sum', 'The remainder'],
      correctIndex: 0,
      explanation: 'The source says the denominator counts the equal parts.',
    },
  ]);
}

async function registerStudent(suffix: string, formLevel: string): Promise<string> {
  await registerStudentFirst(pool, {
    studentEmail: `student-${suffix}@test.dev`,
    studentPassword: 'password12',
    studentDisplayName: `Student ${suffix}`,
    academicLevel: formLevel.startsWith('standard') ? 'primary' : 'secondary',
    formLevel,
    parentEmail: `parent-${suffix}@test.dev`,
    parentPassword: 'password12',
    parentDisplayName: `Parent ${suffix}`,
  });
  const row = await pool.query<{ id: string }>(
    `SELECT s.id FROM academic_students s
      JOIN academic_users u ON u.id = s.user_id
      WHERE u.email = $1`,
    [`student-${suffix}@test.dev`],
  );
  return row.rows[0]!.id;
}

async function makeItem(subjectId: string, formId: string): Promise<ContentItem> {
  await ingestSourceDocument(pool, {
    formId,
    subjectId,
    title: `Book for ${subjectId}`,
    pages: [{ pageNumber: 1, text: `Chapter 1\n\n${SOURCE_TEXT}` }] as SourcePage[],
  });
  const result = await generateContentForTopic(pool, {
    subjectId,
    kind: 'homework',
    llm: llmReturning(oneItem(subjectId.length)),
  });
  if (!result.ok) throw new Error('expected generation to succeed');
  return result.items[0]!;
}

beforeEach(async () => {
  pool = new PGlitePool(new PGlite());
  await ensureAcademicSchema(pool);
  await ensureCurriculumSchema(pool);
  await ensureAssignmentSchema(pool);
  await seedCurriculum(pool);
  await ensureSourceSchema(pool);
  await ensureContentSchema(pool);
  studentIds = [
    await registerStudent('flags-a', 'standard-5'),
    await registerStudent('flags-b', 'standard-5'),
  ];
});

afterEach(async () => {
  await pool.db.close();
});

describe('flagContentItem', () => {
  it('records the flag and the reason', async () => {
    const item = await makeItem('std5-math', 'std5');
    const result = await flagContentItem(pool, {
      itemId: item.id,
      studentId: studentIds[0]!,
      reason: 'Two answers are correct',
    });

    expect(result.flag.reason).toBe('Two answers are correct');
    expect(result.flag.itemId).toBe(item.id);
    expect(result.autoUnpublished).toBe(false);

    const stored = await listFlagsForItem(pool, item.id);
    expect(stored).toHaveLength(1);
  });

  it('leaves a published item live until enough students agree', async () => {
    const item = await makeItem('std5-math', 'std5');
    await publishContentItem(pool, item.id);

    const first = await flagContentItem(pool, { itemId: item.id, studentId: studentIds[0]! });
    expect(first.item.status).toBe('published');
    expect(first.autoUnpublished).toBe(false);

    const second = await flagContentItem(pool, { itemId: item.id, studentId: studentIds[1]! });
    expect(FLAG_AUTO_UNPUBLISH_THRESHOLD).toBe(2);
    expect(second.item.status).toBe('flagged');
    expect(second.autoUnpublished).toBe(true);
  });

  it('counts one student only once, however many times they flag', async () => {
    const item = await makeItem('std5-math', 'std5');
    await publishContentItem(pool, item.id);

    await flagContentItem(pool, { itemId: item.id, studentId: studentIds[0]! });
    await flagContentItem(pool, { itemId: item.id, studentId: studentIds[0]!, reason: 'again' });

    expect(await listFlagsForItem(pool, item.id)).toHaveLength(1);

    // The second real student is still only the second flag, so it now crosses the threshold.
    const second = await flagContentItem(pool, { itemId: item.id, studentId: studentIds[1]! });
    expect(second.autoUnpublished).toBe(true);
  });

  it('does not take an unpublished draft out of circulation — it was never live', async () => {
    const item = await makeItem('std5-math', 'std5');
    const result = await flagContentItem(pool, { itemId: item.id, studentId: studentIds[0]! });
    expect(result.item.status).toBe('draft');
    expect(result.item.flagCount).toBe(1);
  });

  it('refuses to flag an item from another level', async () => {
    const otherLevel = await makeItem('f1-math', 'form1');
    await expect(
      flagContentItem(pool, { itemId: otherLevel.id, studentId: studentIds[0]! }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses to flag an item that does not exist', async () => {
    await expect(
      flagContentItem(pool, { itemId: 'not-an-item', studentId: studentIds[0]! }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('surfaces flagged items for the operator', async () => {
    const item = await makeItem('std5-math', 'std5');
    await publishContentItem(pool, item.id);
    await flagContentItem(pool, { itemId: item.id, studentId: studentIds[0]! });
    await flagContentItem(pool, { itemId: item.id, studentId: studentIds[1]! });

    const flagged = await listFlaggedItems(pool);
    expect(flagged.map((entry) => entry.id)).toEqual([item.id]);
    expect(flagged[0]?.flagCount).toBe(2);
  });
});

describe('listContentCoverage', () => {
  it('counts drafts, published and flagged separately per subject', async () => {
    const first = await makeItem('std5-math', 'std5');
    await publishContentItem(pool, first.id);
    const second = await makeItem('std5-math', 'std5');

    const coverage = await listContentCoverage(pool);
    const row = coverage.find((entry) => entry.subjectId === 'std5-math');
    expect(row?.draft).toBe(1);
    expect(row?.published).toBe(1);
    expect(row?.flagged).toBe(0);
    expect(row?.total).toBe(2);
    expect(second.status).toBe('draft');
  });

  it('moves an item from published to flagged in the counts', async () => {
    const item = await makeItem('std5-math', 'std5');
    await publishContentItem(pool, item.id);
    await flagContentItem(pool, { itemId: item.id, studentId: studentIds[0]! });
    await flagContentItem(pool, { itemId: item.id, studentId: studentIds[1]! });

    const row = (await listContentCoverage(pool)).find(
      (entry) => entry.subjectId === 'std5-math',
    );
    expect(row?.published).toBe(0);
    expect(row?.flagged).toBe(1);
  });

  it('lists subjects with no items at all, so gaps stay visible', async () => {
    const coverage = await listContentCoverage(pool);
    const empty = coverage.find((entry) => entry.subjectId === 'std7-science');
    expect(empty?.total).toBe(0);
  });
});
