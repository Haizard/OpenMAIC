import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registerStudentFirst } from '@/lib/academic/register';
import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureQuizSchema } from '@/lib/academic/quiz-schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureAssignmentSchema } from '@/lib/academic/assignment-schema';
import { ensureContentSchema } from '@/lib/academic/content-schema';
import { ensureReadingSchema } from '@/lib/academic/reading-schema';
import { seedReadings } from '@/lib/academic/reading-seed';
import { ensureHolidaySchema } from '@/lib/academic/holiday-schema';
import { ensurePracticeSchema } from '@/lib/academic/practice-schema';
import { seedPracticeItems } from '@/lib/academic/practice-seed';
import { createAssignment, submitAssignment } from '@/lib/academic/assignment';
import { materializeHomework } from '@/lib/academic/homework';
import { setReadingStatus } from '@/lib/academic/reading';
import { materializeHolidayPackages } from '@/lib/academic/holiday';
import {
  buildStudyPlan,
  listNudgesForParent,
  MAX_WEAK_TOPIC_STEPS,
  STALE_ACTIVITY_DAYS,
} from '@/lib/academic/guidance';
import { answerPracticeItem } from '@/lib/academic/practice';

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

const NOW = new Date('2026-06-15T09:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

interface Family {
  studentId: string;
  parentId: string;
}

async function makePool(): Promise<PGlitePool> {
  const pool = new PGlitePool(new PGlite());
  await ensureAcademicSchema(pool);
  await ensureQuizSchema(pool);
  await ensureCurriculumSchema(pool);
  await ensureAssignmentSchema(pool);
  // Homework and mastery both consult the shared content bank now.
  await ensureContentSchema(pool);
  await seedCurriculum(pool);
  await ensureReadingSchema(pool);
  await seedReadings(pool);
  await ensureHolidaySchema(pool);
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

/** Set the due date of one pending item directly, to control what is overdue. */
async function setDue(pool: PGlitePool, assignmentId: string, dueAt: Date): Promise<void> {
  await pool.query('UPDATE academic_assignments SET due_at = $2 WHERE id = $1', [
    assignmentId,
    dueAt,
  ]);
}

describe('guidance engine', () => {
  let pool: PGlitePool;

  beforeEach(async () => {
    pool = await makePool();
  });

  afterEach(async () => {
    await pool.db.close();
  });

  it('ranks overdue above due soon above untouched', async () => {
    const { studentId } = await createFamily(pool, 'rank');
    await materializeHomework(pool, studentId, NOW);

    const items = await pool.query<{ id: string }>(
      `SELECT id FROM academic_assignments WHERE student_id = $1 AND kind = 'homework' ORDER BY title`,
      [studentId],
    );
    const ids = items.rows.map((row) => row.id);

    // One past its deadline, one due inside the window, one far away.
    await setDue(pool, ids[0], new Date(NOW.getTime() - 2 * DAY_MS));
    await setDue(pool, ids[1], new Date(NOW.getTime() + 2 * DAY_MS));
    await setDue(pool, ids[2], new Date(NOW.getTime() + 60 * DAY_MS));

    const plan = await buildStudyPlan(pool, studentId, NOW);
    const reasons = plan.steps.map((step) => step.reason);

    expect(reasons[0]).toBe('overdue');
    expect(reasons).toContain('due_soon');
    expect(reasons.indexOf('overdue')).toBeLessThan(reasons.indexOf('due_soon'));
    expect(reasons.indexOf('due_soon')).toBeLessThan(reasons.indexOf('untouched'));
  });

  it('ranks a package item missing its recording above ordinary due-soon work', async () => {
    const { studentId } = await createFamily(pool, 'record');
    await materializeHolidayPackages(pool, studentId, NOW);

    // A plain assignment due sooner than the package, to prove the recording requirement
    // outranks proximity rather than the package simply being earlier.
    const created = await createAssignment(pool, {
      studentId,
      title: 'Plain work',
      dueAt: new Date(NOW.getTime() + DAY_MS),
    });
    await setDue(pool, created.id, new Date(NOW.getTime() + DAY_MS));

    const plan = await buildStudyPlan(pool, studentId, NOW);
    const reasons = plan.steps.map((step) => step.reason);

    expect(reasons).toContain('missing_recording');
    expect(reasons.indexOf('missing_recording')).toBeLessThan(reasons.indexOf('due_soon'));
  });

  it('calls an uncovered topic untouched, never weak', async () => {
    const { studentId } = await createFamily(pool, 'cover');
    await materializeHomework(pool, studentId, NOW);

    const plan = await buildStudyPlan(pool, studentId, NOW);
    const untouched = plan.steps.filter((step) => step.reason === 'untouched');

    expect(untouched.length).toBeGreaterThan(0);
    expect(plan.summary.untouchedTopics).toBeGreaterThan(0);

    // The wording is the contract: absence of work is not a measured weakness.
    const serialised = JSON.stringify(plan);
    expect(serialised).not.toMatch(/weak/i);
  });

  it('stops listing a topic as untouched once work on it is finished', async () => {
    const { studentId } = await createFamily(pool, 'covered');
    await materializeHomework(pool, studentId, NOW);

    const before = await buildStudyPlan(pool, studentId, NOW);
    const untouchedBefore = new Set(
      before.steps.filter((s) => s.reason === 'untouched').map((s) => s.topicId),
    );
    expect(untouchedBefore.size).toBeGreaterThan(0);

    // Finish every homework item: each topic then has a submitted assignment.
    const items = await pool.query<{ id: string }>(
      `SELECT id FROM academic_assignments WHERE student_id = $1 AND kind = 'homework'`,
      [studentId],
    );
    for (const item of items.rows) {
      await submitAssignment(pool, item.id, studentId, NOW);
    }

    const after = await buildStudyPlan(pool, studentId, NOW);
    const untouchedAfter = after.steps.filter((s) => s.reason === 'untouched');

    // Whatever remains untouched must not be a topic that now has submitted work on it.
    for (const step of untouchedAfter) {
      expect(untouchedBefore.has(step.topicId)).toBe(true);
    }
    expect(after.summary.untouchedTopics).toBeLessThan(before.summary.untouchedTopics);
  });

  it('counts a read reading as coverage for its topic', async () => {
    const { studentId } = await createFamily(pool, 'readcover');
    await materializeHomework(pool, studentId, NOW);

    const before = await buildStudyPlan(pool, studentId, NOW);

    const readings = await pool.query<{ id: string; topic_id: string }>(
      `SELECT r.id, r.topic_id FROM academic_readings r
       JOIN curriculum_topics t ON t.id = r.topic_id
       JOIN curriculum_subjects sub ON sub.id = t.subject_id
       JOIN academic_students a ON a.curriculum_form_id = sub.form_id
       WHERE a.id = $1
       LIMIT 1`,
      [studentId],
    );
    const reading = readings.rows[0];
    await setReadingStatus(pool, studentId, reading.id, 'read');

    const after = await buildStudyPlan(pool, studentId, NOW);
    const stillUntouched = after.steps.filter(
      (s) => s.reason === 'untouched' && s.topicId === reading.topic_id,
    );

    expect(after.summary.readingsRead).toBe(before.summary.readingsRead + 1);
    expect(stillUntouched).toEqual([]);
  });

  it('suggests practice only when there is nothing else to do', async () => {
    const { studentId } = await createFamily(pool, 'practice');
    await materializeHomework(pool, studentId, NOW);

    const busy = await buildStudyPlan(pool, studentId, NOW);
    expect(busy.steps.length).toBeGreaterThan(0);
    expect(busy.steps.some((s) => s.reason === 'no_recent_practice')).toBe(false);

    // Finish everything and clear the readings so the plan has nothing left to suggest.
    const items = await pool.query<{ id: string }>(
      'SELECT id FROM academic_assignments WHERE student_id = $1',
      [studentId],
    );
    for (const item of items.rows) {
      await submitAssignment(pool, item.id, studentId, NOW);
    }
    const readings = await pool.query<{ id: string }>(
      `SELECT r.id FROM academic_readings r
       JOIN curriculum_topics t ON t.id = r.topic_id
       JOIN curriculum_subjects sub ON sub.id = t.subject_id
       JOIN academic_students a ON a.curriculum_form_id = sub.form_id
       WHERE a.id = $1`,
      [studentId],
    );
    for (const reading of readings.rows) {
      await setReadingStatus(pool, studentId, reading.id, 'read');
    }

    const idle = await buildStudyPlan(pool, studentId, NOW);
    expect(idle.steps).toHaveLength(1);
    expect(idle.steps[0].reason).toBe('no_recent_practice');
  });

  it('reports days since the last finished thing', async () => {
    const { studentId } = await createFamily(pool, 'stale');
    await materializeHomework(pool, studentId, NOW);

    const items = await pool.query<{ id: string }>(
      'SELECT id FROM academic_assignments WHERE student_id = $1 LIMIT 1',
      [studentId],
    );
    await submitAssignment(pool, items.rows[0].id, studentId, NOW);

    const later = new Date(NOW.getTime() + (STALE_ACTIVITY_DAYS + 3) * DAY_MS);
    const plan = await buildStudyPlan(pool, studentId, later);

    expect(plan.summary.daysSinceActivity).toBe(STALE_ACTIVITY_DAYS + 3);
  });

  it('returns a pure read: two calls with no writes in between agree', async () => {
    const { studentId } = await createFamily(pool, 'pure');
    await materializeHomework(pool, studentId, NOW);

    const first = await buildStudyPlan(pool, studentId, NOW);
    const second = await buildStudyPlan(pool, studentId, NOW);

    expect(second.steps).toEqual(first.steps);
    expect(second.summary).toEqual(first.summary);
  });
});

describe('guidance isolation', () => {
  let pool: PGlitePool;

  beforeEach(async () => {
    pool = await makePool();
  });

  afterEach(async () => {
    await pool.db.close();
  });

  it('puts none of another student work in the plan', async () => {
    // Different forms, so the two students' topics are disjoint and a leak is detectable.
    const a = await createFamily(pool, 'isola', 'standard-5');
    const b = await createFamily(pool, 'isolb', 'standard-6');

    await materializeHomework(pool, a.studentId, NOW);
    await materializeHomework(pool, b.studentId, NOW);

    // Make B's work overdue: if the plan read across students, A would inherit it.
    const bItems = await pool.query<{ id: string }>(
      'SELECT id FROM academic_assignments WHERE student_id = $1',
      [b.studentId],
    );
    for (const item of bItems.rows) {
      await setDue(pool, item.id, new Date(NOW.getTime() - 10 * DAY_MS));
    }

    const bTopics = new Set(
      (
        await pool.query<{ topic_id: string }>(
          'SELECT DISTINCT topic_id FROM academic_assignments WHERE student_id = $1',
          [b.studentId],
        )
      ).rows.map((row) => row.topic_id),
    );

    const planA = await buildStudyPlan(pool, a.studentId, NOW);

    for (const step of planA.steps) {
      expect(bTopics.has(step.topicId ?? '')).toBe(false);
    }
    expect(planA.summary.overdue).toBe(0);
    expect(planA.reason).toBeNull();
  });

  it('gives a parent nudges for their own children only', async () => {
    const mine = await createFamily(pool, 'nudgemine');
    await createFamily(pool, 'nudgeother');

    await materializeHomework(pool, mine.studentId, NOW);

    const nudges = await listNudgesForParent(pool, mine.parentId, NOW);

    expect(nudges).toHaveLength(1);
    expect(nudges[0].studentId).toBe(mine.studentId);
    expect(nudges[0].studentName).toBe('Student nudgemine');
    expect(nudges[0].nudges.length).toBeGreaterThan(0);
  });

  it('never shows one parent another family child', async () => {
    const x = await createFamily(pool, 'nudgex');
    const z = await createFamily(pool, 'nudgez');

    // Only X's child has work, and it is overdue enough to be the loudest nudge.
    await materializeHomework(pool, x.studentId, NOW);
    const xItems = await pool.query<{ id: string }>(
      'SELECT id FROM academic_assignments WHERE student_id = $1',
      [x.studentId],
    );
    for (const item of xItems.rows) {
      await setDue(pool, item.id, new Date(NOW.getTime() - 5 * DAY_MS));
    }

    // Z's parent sees their own child and nobody else's.
    const nudges = await listNudgesForParent(pool, z.parentId, NOW);
    expect(nudges).toHaveLength(1);
    expect(nudges[0].studentId).toBe(z.studentId);
    expect(nudges[0].studentId).not.toBe(x.studentId);
    expect(nudges[0].overdue).toBe(0);
  });

  it('surfaces a genuinely weak topic once practice evidence exists', async () => {
    const { studentId } = await createFamily(pool, 'realweak');
    await materializeHomework(pool, studentId, NOW);

    // With no practice at all, nothing may be called weak.
    const before = await buildStudyPlan(pool, studentId, NOW);
    expect(before.steps.some((s) => s.reason === 'weak_topic')).toBe(false);

    const items = await pool.query<{ id: string }>(
      `SELECT id FROM academic_practice_items WHERE topic_id = 'std5-math-1' ORDER BY sort_order, id`,
    );
    for (let round = 0; round < 2; round += 1) {
      for (const item of items.rows) {
        const correct = await pool.query<{ correct_index: number }>(
          'SELECT correct_index FROM academic_practice_items WHERE id = $1',
          [item.id],
        );
        const right = correct.rows[0].correct_index;
        await answerPracticeItem(pool, studentId, item.id, right === 0 ? 1 : 0);
      }
    }

    const after = await buildStudyPlan(pool, studentId, NOW);
    const weak = after.steps.filter((s) => s.reason === 'weak_topic');

    expect(weak.length).toBeGreaterThan(0);
    expect(weak[0].topicId).toBe('std5-math-1');
    expect(weak[0].href).toContain('/learn/practice');

    // It must rank above untouched material and below deadlines.
    const reasons = after.steps.map((s) => s.reason);
    expect(reasons.indexOf('weak_topic')).toBeLessThan(reasons.indexOf('untouched'));
  });

  it('caps weak-topic steps so drills never bury homework', async () => {
    const { studentId } = await createFamily(pool, 'cap');
    await materializeHomework(pool, studentId, NOW);

    // Get every banked topic in this form wrong enough to be weak.
    const items = await pool.query<{ id: string }>(
      `SELECT i.id FROM academic_practice_items i
       JOIN curriculum_topics t ON t.id = i.topic_id
       JOIN curriculum_subjects sub ON sub.id = t.subject_id
       JOIN academic_students a ON a.curriculum_form_id = sub.form_id
       WHERE a.id = $1`,
      [studentId],
    );
    for (let round = 0; round < 2; round += 1) {
      for (const item of items.rows) {
        const correct = await pool.query<{ correct_index: number }>(
          'SELECT correct_index FROM academic_practice_items WHERE id = $1',
          [item.id],
        );
        const right = correct.rows[0].correct_index;
        await answerPracticeItem(pool, studentId, item.id, right === 0 ? 1 : 0);
      }
    }

    const plan = await buildStudyPlan(pool, studentId, NOW);
    const weak = plan.steps.filter((s) => s.reason === 'weak_topic');

    expect(weak.length).toBeLessThanOrEqual(MAX_WEAK_TOPIC_STEPS);
  });

  it('reports no_form for a student with no grade', async () => {
    const result = await registerStudentFirst(pool, {
      studentEmail: 'noform2@test.dev',
      studentPassword: 'password12',
      studentDisplayName: 'No Form',
      academicLevel: 'primary',
      parentEmail: 'noform2p@test.dev',
      parentPassword: 'password12',
      parentDisplayName: 'No Form Parent',
    });
    const student = await pool.query<{ id: string }>(
      'SELECT id FROM academic_students WHERE user_id = $1',
      [result.studentUserId],
    );

    const plan = await buildStudyPlan(pool, student.rows[0].id, NOW);
    expect(plan.steps).toEqual([]);
    expect(plan.reason).toBe('no_form');
  });
});
