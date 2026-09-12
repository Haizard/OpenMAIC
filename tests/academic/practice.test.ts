import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registerStudentFirst } from '@/lib/academic/register';
import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureAssignmentSchema } from '@/lib/academic/assignment-schema';
import { ensurePracticeSchema } from '@/lib/academic/practice-schema';
import { seedPracticeItems } from '@/lib/academic/practice-seed';
import {
  answerPracticeItem,
  labelForAccuracy,
  listPracticeForParent,
  listTopicMastery,
  listWeakTopics,
  MIN_ATTEMPTS_FOR_MASTERY,
} from '@/lib/academic/practice';

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

interface Family {
  studentId: string;
  parentId: string;
}

async function makePool(): Promise<PGlitePool> {
  const pool = new PGlitePool(new PGlite());
  await ensureAcademicSchema(pool);
  await ensureCurriculumSchema(pool);
  await ensureAssignmentSchema(pool);
  await seedCurriculum(pool);
  await ensurePracticeSchema(pool);
  await seedPracticeItems(pool);
  return pool;
}

async function createFamily(
  pool: PGlitePool,
  suffix: string,
  formLevel = 'standard-5',
): Promise<Family> {
  const result = await registerStudentFirst(pool, {
    studentEmail: `student-${suffix}@test.dev`,
    studentPassword: 'password12',
    studentDisplayName: `Student ${suffix}`,
    academicLevel: 'primary',
    formLevel,
    parentEmail: `parent-${suffix}@test.dev`,
    parentPassword: 'password12',
    parentDisplayName: `Parent ${suffix}`,
  });

  const student = await pool.query<{ id: string }>(
    'SELECT id FROM academic_students WHERE user_id = $1',
    [result.studentUserId],
  );
  const parent = await pool.query<{ id: string }>(
    'SELECT id FROM academic_parents WHERE user_id = $1',
    [result.parentUserId],
  );

  return { studentId: student.rows[0].id, parentId: parent.rows[0].id };
}

/** The bank items for a topic, in bank order. */
async function itemIds(pool: PGlitePool, topicId: string): Promise<string[]> {
  const rows = await pool.query<{ id: string }>(
    'SELECT id FROM academic_practice_items WHERE topic_id = $1 ORDER BY sort_order, id',
    [topicId],
  );
  return rows.rows.map((row) => row.id);
}

function correctIndexFor(pool: PGlitePool, itemId: string): Promise<number> {
  return pool
    .query<{ correct_index: number }>(
      'SELECT correct_index FROM academic_practice_items WHERE id = $1',
      [itemId],
    )
    .then((result) => result.rows[0].correct_index);
}

describe('practice drills', () => {
  let pool: PGlitePool;
  let studentId: string;

  beforeEach(async () => {
    pool = await makePool();
    ({ studentId } = await createFamily(pool, 'drill'));
  });

  afterEach(async () => {
    await pool.db.close();
  });

  it('records a correct answer and explains it', async () => {
    const ids = await itemIds(pool, 'std5-math-1');
    const index = await correctIndexFor(pool, ids[0]);

    const result = await answerPracticeItem(pool, studentId, ids[0], index);

    expect(result.correct).toBe(true);
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it('records a wrong answer without revealing the answer as correct', async () => {
    const ids = await itemIds(pool, 'std5-math-1');
    const index = await correctIndexFor(pool, ids[0]);
    const wrong = index === 0 ? 1 : 0;

    const result = await answerPracticeItem(pool, studentId, ids[0], wrong);

    expect(result.correct).toBe(false);
    expect(result.correctIndex).toBe(index);
  });

  it('refuses an answer to a topic outside the student class', async () => {
    // Form 1 Mathematics belongs to another level entirely.
    const ids = await itemIds(pool, 'f1-math-1');

    await expect(answerPracticeItem(pool, studentId, ids[0], 0)).rejects.toThrow(
      /not in your class/i,
    );
  });

  it('refuses an out-of-range choice instead of scoring it', async () => {
    const ids = await itemIds(pool, 'std5-math-1');
    await expect(answerPracticeItem(pool, studentId, ids[0], 99)).rejects.toThrow(
      /choose one/i,
    );
  });

  it('appends attempts rather than overwriting, so a re-drill adds evidence', async () => {
    const ids = await itemIds(pool, 'std5-math-1');
    const index = await correctIndexFor(pool, ids[0]);

    await answerPracticeItem(pool, studentId, ids[0], index === 0 ? 1 : 0);
    await answerPracticeItem(pool, studentId, ids[0], index);

    const rows = await pool.query<{ cnt: string | number }>(
      'SELECT COUNT(*) AS cnt FROM academic_practice_attempts WHERE student_id = $1',
      [studentId],
    );
    expect(Number(rows.rows[0].cnt)).toBe(2);
  });

  it('only lists topics that have bank items', async () => {
    const mastery = await listTopicMastery(pool, studentId);
    const ids = mastery.map((topic) => topic.topicId);

    expect(ids).toContain('std5-math-1');
    expect(ids).toContain('std5-math-2');
    // Geography has no bank coverage in v1, so it must not be offered as if it had.
    expect(ids).not.toContain('std5-geo-1');
  });
});

describe('topic mastery', () => {
  let pool: PGlitePool;
  let studentId: string;

  beforeEach(async () => {
    pool = await makePool();
    ({ studentId } = await createFamily(pool, 'mastery'));
  });

  afterEach(async () => {
    await pool.db.close();
  });

  it('labels a topic unknown rather than weak when there is little evidence', () => {
    expect(labelForAccuracy(MIN_ATTEMPTS_FOR_MASTERY - 1, 0)).toBe('unknown');
    expect(labelForAccuracy(1, 0)).toBe('unknown');
    expect(labelForAccuracy(0, 0)).toBe('unknown');
  });

  it('labels below the threshold weak and above it strong', () => {
    expect(labelForAccuracy(10, 0.4)).toBe('weak');
    expect(labelForAccuracy(10, 0.7)).toBe('developing');
    expect(labelForAccuracy(10, 0.9)).toBe('strong');
  });

  it('calls a topic weak once enough answers are wrong', async () => {
    const ids = await itemIds(pool, 'std5-math-1');
    const correctIndex = await correctIndexFor(pool, ids[0]);
    const wrong = correctIndex === 0 ? 1 : 0;

    // The bank has two items per topic, so answer both repeatedly to build evidence.
    for (let round = 0; round < 2; round += 1) {
      for (const id of ids) {
        await answerPracticeItem(pool, studentId, id, wrong);
      }
    }

    const mastery = await listTopicMastery(pool, studentId);
    const topic = mastery.find((entry) => entry.topicId === 'std5-math-1');

    expect(topic?.attempts).toBeGreaterThanOrEqual(MIN_ATTEMPTS_FOR_MASTERY);
    expect(topic?.accuracy).toBe(0);
    expect(topic?.label).toBe('weak');

    const weak = await listWeakTopics(pool, studentId);
    expect(weak.map((entry) => entry.topicId)).toContain('std5-math-1');
  });

  it('recovers once the recent answers improve', async () => {
    const ids = await itemIds(pool, 'std5-math-1');
    const correctIndex = await correctIndexFor(pool, ids[0]);
    const wrong = correctIndex === 0 ? 1 : 0;

    for (let round = 0; round < 2; round += 1) {
      for (const id of ids) {
        await answerPracticeItem(pool, studentId, id, wrong);
      }
    }
    expect((await listTopicMastery(pool, studentId)).find((t) => t.topicId === 'std5-math-1')?.label).toBe(
      'weak',
    );

    // Now get everything right; the window should slide and the label should improve.
    for (let round = 0; round < 3; round += 1) {
      for (const id of ids) {
        await answerPracticeItem(pool, studentId, id, await correctIndexFor(pool, id));
      }
    }

    const topic = (await listTopicMastery(pool, studentId)).find(
      (entry) => entry.topicId === 'std5-math-1',
    );
    expect(topic?.label).not.toBe('weak');
  });

  it('never marks a topic weak with no attempts at all', async () => {
    const weak = await listWeakTopics(pool, studentId);
    expect(weak).toEqual([]);
  });
});

describe('practice isolation', () => {
  let pool: PGlitePool;

  beforeEach(async () => {
    pool = await makePool();
  });

  afterEach(async () => {
    await pool.db.close();
  });

  it('keeps one student mastery independent of another', async () => {
    const a = await createFamily(pool, 'pa');
    const b = await createFamily(pool, 'pb');

    const ids = await itemIds(pool, 'std5-math-1');
    const correctIndex = await correctIndexFor(pool, ids[0]);
    const wrong = correctIndex === 0 ? 1 : 0;

    // A gets everything wrong, B gets everything right.
    for (let round = 0; round < 2; round += 1) {
      for (const id of ids) {
        await answerPracticeItem(pool, a.studentId, id, wrong);
        await answerPracticeItem(pool, b.studentId, id, await correctIndexFor(pool, id));
      }
    }

    const masteryA = (await listTopicMastery(pool, a.studentId)).find(
      (entry) => entry.topicId === 'std5-math-1',
    );
    const masteryB = (await listTopicMastery(pool, b.studentId)).find(
      (entry) => entry.topicId === 'std5-math-1',
    );

    expect(masteryA?.label).toBe('weak');
    expect(masteryB?.label).toBe('strong');
    expect(masteryA?.accuracy).toBe(0);
    expect(masteryB?.accuracy).toBe(1);
  });

  it('shows a parent only their own children practice', async () => {
    const mine = await createFamily(pool, 'pmin');
    await createFamily(pool, 'pother');

    const ids = await itemIds(pool, 'std5-math-1');
    await answerPracticeItem(pool, mine.studentId, ids[0], 0);

    const view = await listPracticeForParent(pool, mine.parentId);

    expect(view).toHaveLength(1);
    expect(view[0].studentId).toBe(mine.studentId);
    expect(view[0].attempts).toBe(1);
  });

  it('shows another parent nothing about a child that is not theirs', async () => {
    const mine = await createFamily(pool, 'pmin2');
    const other = await createFamily(pool, 'pother2');

    const ids = await itemIds(pool, 'std5-math-1');
    await answerPracticeItem(pool, mine.studentId, ids[0], 0);

    const view = await listPracticeForParent(pool, other.parentId);

    expect(view).toHaveLength(1);
    expect(view[0].studentId).toBe(other.studentId);
    expect(view[0].attempts).toBe(0);
  });
});
