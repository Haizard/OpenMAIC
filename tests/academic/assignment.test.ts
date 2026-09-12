import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addChild, registerStudentFirst } from '@/lib/academic/register';
import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureAssignmentSchema } from '@/lib/academic/assignment-schema';
import {
  createAssignment,
  deleteAssignment,
  getAssignment,
  getAssignmentSummary,
  listAssignmentsForParent,
  listAssignmentsForStudent,
  submitAssignment,
} from '@/lib/academic/assignment';

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

async function createFamily(
  pool: PGlitePool,
  suffix: string,
): Promise<{ studentId: string; parentId: string }> {
  const result = await registerStudentFirst(pool, {
    studentEmail: `student-${suffix}@test.dev`,
    studentPassword: 'password12',
    studentDisplayName: `Student ${suffix}`,
    academicLevel: 'primary',
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

const PAST = new Date('2026-09-01T09:00:00Z');
const FUTURE = new Date('2026-12-01T09:00:00Z');
const NOW = new Date('2026-09-12T09:00:00Z');

describe('academic assignments (Slice 1)', () => {
  let db: PGlite;
  let pool: PGlitePool;
  let studentId: string;
  let parentId: string;

  beforeEach(async () => {
    db = new PGlite();
    pool = new PGlitePool(db);
    await ensureAcademicSchema(pool);
    await ensureCurriculumSchema(pool);
    await seedCurriculum(pool);
    await ensureAssignmentSchema(pool);

    const family = await createFamily(pool, 'main');
    studentId = family.studentId;
    parentId = family.parentId;
  });

  afterEach(async () => {
    await db.close();
  });

  // ─── CRUD ──────────────────────────────────────────────────────────

  describe('create and read', () => {
    it('creates an assignment and reads it back', async () => {
      const { id } = await createAssignment(pool, {
        studentId,
        title: 'Fractions worksheet',
        description: 'Questions 1 to 10',
        dueAt: FUTURE,
      });

      const assignment = await getAssignment(pool, id, studentId);
      expect(assignment).not.toBeNull();
      expect(assignment!.title).toBe('Fractions worksheet');
      expect(assignment!.description).toBe('Questions 1 to 10');
      expect(assignment!.status).toBe('pending');
      expect(assignment!.submittedAt).toBeNull();
      expect(assignment!.dueAt?.toISOString()).toBe(FUTURE.toISOString());
    });

    it('links an assignment to a curriculum topic', async () => {
      const { id } = await createAssignment(pool, {
        studentId,
        topicId: 'std1-math-2',
        title: 'Addition practice',
      });

      const assignment = await getAssignment(pool, id, studentId);
      expect(assignment!.topicId).toBe('std1-math-2');
    });

    it('clears the topic link instead of deleting the assignment when the topic goes away', async () => {
      const { id } = await createAssignment(pool, {
        studentId,
        topicId: 'std1-math-3',
        title: 'Shapes practice',
      });

      await pool.query('DELETE FROM curriculum_topics WHERE id = $1', ['std1-math-3']);

      const assignment = await getAssignment(pool, id, studentId);
      expect(assignment).not.toBeNull();
      expect(assignment!.topicId).toBeNull();
    });

    it('orders by due date, with undated work last', async () => {
      await createAssignment(pool, { studentId, title: 'No deadline' });
      await createAssignment(pool, { studentId, title: 'Later', dueAt: FUTURE });
      await createAssignment(pool, { studentId, title: 'Overdue', dueAt: PAST });

      const list = await listAssignmentsForStudent(pool, studentId);
      expect(list.map((a) => a.title)).toEqual(['Overdue', 'Later', 'No deadline']);
    });

    it('keeps each student list separate', async () => {
      const other = await createFamily(pool, 'other');
      await createAssignment(pool, { studentId, title: 'Mine' });
      await createAssignment(pool, { studentId: other.studentId, title: 'Theirs' });

      const mine = await listAssignmentsForStudent(pool, studentId);
      expect(mine.map((a) => a.title)).toEqual(['Mine']);
    });
  });

  // ─── Scoping ───────────────────────────────────────────────────────

  describe('scoping', () => {
    it('will not read another student assignment', async () => {
      const other = await createFamily(pool, 'peek');
      const { id } = await createAssignment(pool, { studentId: other.studentId, title: 'Private' });

      expect(await getAssignment(pool, id, studentId)).toBeNull();
    });

    it('will not delete another student assignment', async () => {
      const other = await createFamily(pool, 'del');
      const { id } = await createAssignment(pool, { studentId: other.studentId, title: 'Private' });

      expect(await deleteAssignment(pool, id, studentId)).toBe(false);
      expect(await getAssignment(pool, id, other.studentId)).not.toBeNull();
    });

    it('will not submit another student assignment', async () => {
      const other = await createFamily(pool, 'submit');
      const { id } = await createAssignment(pool, { studentId: other.studentId, title: 'Private' });

      expect(await submitAssignment(pool, id, studentId, NOW)).toBeNull();
      const stillPending = await getAssignment(pool, id, other.studentId);
      expect(stillPending!.status).toBe('pending');
    });

    it('deletes an assignment the student owns', async () => {
      const { id } = await createAssignment(pool, { studentId, title: 'Doomed' });
      expect(await deleteAssignment(pool, id, studentId)).toBe(true);
      expect(await getAssignment(pool, id, studentId)).toBeNull();
    });
  });

  // ─── Submission and late derivation ────────────────────────────────

  describe('submission', () => {
    it('marks an on-time submission as submitted', async () => {
      const { id } = await createAssignment(pool, { studentId, title: 'On time', dueAt: FUTURE });

      const result = await submitAssignment(pool, id, studentId, NOW);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('submitted');
      expect(result!.submittedAt?.toISOString()).toBe(NOW.toISOString());
    });

    it('marks a submission after the due date as late', async () => {
      const { id } = await createAssignment(pool, { studentId, title: 'Overdue', dueAt: PAST });

      const result = await submitAssignment(pool, id, studentId, NOW);
      expect(result!.status).toBe('late');
    });

    it('treats a submission exactly at the due moment as on time', async () => {
      const { id } = await createAssignment(pool, { studentId, title: 'Just in time', dueAt: NOW });

      const result = await submitAssignment(pool, id, studentId, NOW);
      expect(result!.status).toBe('submitted');
    });

    it('treats work with no due date as submitted', async () => {
      const { id } = await createAssignment(pool, { studentId, title: 'No deadline' });

      const result = await submitAssignment(pool, id, studentId, NOW);
      expect(result!.status).toBe('submitted');
    });

    it('refuses a second submission', async () => {
      const { id } = await createAssignment(pool, { studentId, title: 'Twice', dueAt: FUTURE });
      await submitAssignment(pool, id, studentId, NOW);

      expect(await submitAssignment(pool, id, studentId, NOW)).toBeNull();
    });

    it('does not overwrite the original submission time', async () => {
      const { id } = await createAssignment(pool, { studentId, title: 'Stamped', dueAt: FUTURE });
      const first = await submitAssignment(pool, id, studentId, NOW);
      const later = new Date('2026-09-20T09:00:00Z');
      await submitAssignment(pool, id, studentId, later);

      const assignment = await getAssignment(pool, id, studentId);
      expect(assignment!.submittedAt?.toISOString()).toBe(first!.submittedAt!.toISOString());
    });
  });

  // ─── Parent mentor view ────────────────────────────────────────────

  describe('parent visibility', () => {
    it('shows a parent their own children work only', async () => {
      const other = await createFamily(pool, 'stranger');
      await createAssignment(pool, { studentId, title: 'My child work', dueAt: FUTURE });
      await createAssignment(pool, { studentId: other.studentId, title: 'Not my child' });

      const visible = await listAssignmentsForParent(pool, parentId);
      expect(visible.map((a) => a.title)).toEqual(['My child work']);
      expect(visible[0].studentName).toBe('Student main');
    });

    it('includes every child in the family', async () => {
      const second = await addChild(pool, {
        parentId,
        studentEmail: 'second-child@test.dev',
        studentPassword: 'password12',
        studentDisplayName: 'Second Child',
        academicLevel: 'primary',
      });
      const secondRow = await pool.query<{ id: string }>(
        'SELECT id FROM academic_students WHERE user_id = $1',
        [second.studentUserId],
      );

      await createAssignment(pool, { studentId, title: 'First child work' });
      await createAssignment(pool, { studentId: secondRow.rows[0].id, title: 'Second child work' });

      const visible = await listAssignmentsForParent(pool, parentId);
      expect(visible.map((a) => a.title).sort()).toEqual(['First child work', 'Second child work']);
    });

    it('reports submission status to the parent', async () => {
      const { id } = await createAssignment(pool, { studentId, title: 'Overdue', dueAt: PAST });
      await submitAssignment(pool, id, studentId, NOW);

      const visible = await listAssignmentsForParent(pool, parentId);
      expect(visible[0].status).toBe('late');
    });

    it('shows nothing to a parent with no children work', async () => {
      const stranger = await createFamily(pool, 'no-kids');
      expect(await listAssignmentsForParent(pool, stranger.parentId)).toEqual([]);
    });
  });

  // ─── Summary ───────────────────────────────────────────────────────

  describe('summary', () => {
    it('counts each status', async () => {
      const pending = await createAssignment(pool, { studentId, title: 'Pending' });
      const onTime = await createAssignment(pool, { studentId, title: 'On time', dueAt: FUTURE });
      const overdue = await createAssignment(pool, { studentId, title: 'Overdue', dueAt: PAST });
      expect(pending.id).toBeTruthy();

      await submitAssignment(pool, onTime.id, studentId, NOW);
      await submitAssignment(pool, overdue.id, studentId, NOW);

      const summary = await getAssignmentSummary(pool, studentId);
      expect(summary).toEqual({ pending: 1, submitted: 1, late: 1, total: 3 });
    });

    it('returns zeros for a student with no assignments', async () => {
      const empty = await createFamily(pool, 'empty');
      expect(await getAssignmentSummary(pool, empty.studentId)).toEqual({
        pending: 0,
        submitted: 0,
        late: 0,
        total: 0,
      });
    });

    it('does not count another student assignments', async () => {
      const other = await createFamily(pool, 'count');
      await createAssignment(pool, { studentId: other.studentId, title: 'Theirs' });

      const summary = await getAssignmentSummary(pool, studentId);
      expect(summary.total).toBe(0);
    });
  });
});
