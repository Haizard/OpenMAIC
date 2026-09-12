import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registerStudentFirst } from '@/lib/academic/register';
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
import {
  bucketFor,
  listHomeworkForStudent,
  listPendingHomeworkForParent,
  materializeHomework,
} from '@/lib/academic/homework';

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

const NOW = new Date('2026-09-12T09:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

async function createFamily(
  pool: PGlitePool,
  suffix: string,
  formLevel?: string,
): Promise<{ studentId: string; parentId: string }> {
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

/** How many topics the student's own form contains — the expected homework count. */
async function topicCountForStudent(pool: PGlitePool, studentId: string): Promise<number> {
  const result = await pool.query<{ cnt: string | number }>(
    `SELECT COUNT(*) AS cnt
     FROM academic_students a
     JOIN curriculum_subjects sub ON sub.form_id = a.curriculum_form_id
     JOIN curriculum_topics t ON t.subject_id = sub.id
     WHERE a.id = $1`,
    [studentId],
  );
  return Number(result.rows[0].cnt);
}

async function setDueDate(
  pool: PGlitePool,
  homeworkId: string,
  dueAt: Date,
): Promise<void> {
  await pool.query('UPDATE academic_assignments SET due_at = $2 WHERE id = $1', [
    homeworkId,
    dueAt,
  ]);
}

describe('homework (Slice 3)', () => {
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

    const family = await createFamily(pool, 'main', 'standard-5');
    studentId = family.studentId;
    parentId = family.parentId;
  });

  afterEach(async () => {
    await db.close();
  });

  // ─── Bucketing ─────────────────────────────────────────────────────

  describe('bucketFor', () => {
    it('puts past due dates in overdue', () => {
      expect(bucketFor(new Date(NOW.getTime() - 1000), NOW)).toBe('overdue');
    });

    it('puts work due within a week in due_soon', () => {
      expect(bucketFor(new Date(NOW.getTime() + DAY_MS), NOW)).toBe('due_soon');
      expect(bucketFor(new Date(NOW.getTime() + 7 * DAY_MS), NOW)).toBe('due_soon');
    });

    it('puts work due further out in later', () => {
      expect(bucketFor(new Date(NOW.getTime() + 8 * DAY_MS), NOW)).toBe('later');
    });

    it('treats a missing due date as later', () => {
      expect(bucketFor(null, NOW)).toBe('later');
    });
  });

  // ─── Materialisation ───────────────────────────────────────────────

  describe('materialisation', () => {
    it('creates one homework item per topic in the student own form', async () => {
      const expected = await topicCountForStudent(pool, studentId);
      expect(expected).toBeGreaterThan(0);

      const inserted = await materializeHomework(pool, studentId, NOW);
      expect(inserted).toBe(expected);

      const homework = await listHomeworkForStudent(pool, studentId, NOW);
      expect(homework.total).toBe(expected);
    });

    it('is idempotent — a second pass adds nothing', async () => {
      const first = await materializeHomework(pool, studentId, NOW);
      const second = await materializeHomework(pool, studentId, NOW);
      const third = await materializeHomework(pool, studentId, NOW);

      expect(second).toBe(0);
      expect(third).toBe(0);

      const homework = await listHomeworkForStudent(pool, studentId, NOW);
      expect(homework.total).toBe(first);
    });

    it('marks everything as platform-assigned homework, pending, with a due date', async () => {
      const homework = await listHomeworkForStudent(pool, studentId, NOW);
      const ids = [...homework.overdue, ...homework.dueSoon, ...homework.later].map((h) => h.id);

      const rows = await pool.query<{
        kind: string;
        assigned_by: string;
        status: string;
        due_at: Date | null;
      }>(
        'SELECT kind, assigned_by, status, due_at FROM academic_assignments WHERE id = ANY($1::text[])',
        [ids],
      );

      expect(rows.rows.length).toBe(ids.length);
      for (const row of rows.rows) {
        expect(row.kind).toBe('homework');
        expect(row.assigned_by).toBe('platform');
        expect(row.status).toBe('pending');
        expect(row.due_at).not.toBeNull();
      }
    });

    it('gives a student with no stored form no homework and a reason, not an error', async () => {
      const formless = await createFamily(pool, 'formless');

      const homework = await listHomeworkForStudent(pool, formless.studentId, NOW);
      expect(homework.total).toBe(0);
      expect(homework.reason).toBe('no_form');

      const rows = await pool.query<{ cnt: string | number }>(
        'SELECT COUNT(*) AS cnt FROM academic_assignments WHERE student_id = $1',
        [formless.studentId],
      );
      expect(Number(rows.rows[0].cnt)).toBe(0);
    });

    it('draws homework only from the student own form', async () => {
      const homework = await listHomeworkForStudent(pool, studentId, NOW);
      const items = [...homework.overdue, ...homework.dueSoon, ...homework.later];

      const forms = await pool.query<{ form_id: string }>(
        `SELECT DISTINCT sub.form_id AS form_id
         FROM curriculum_topics t
         JOIN curriculum_subjects sub ON sub.id = t.subject_id
         WHERE t.id = ANY($1::text[])`,
        [items.map((i) => i.topicId)],
      );

      expect(forms.rows.map((r) => r.form_id)).toEqual(['std5']);
    });

    it('attaches the topic and subject name to each item', async () => {
      const homework = await listHomeworkForStudent(pool, studentId, NOW);
      const items = [...homework.overdue, ...homework.dueSoon, ...homework.later];

      expect(items.every((i) => i.topicName !== null)).toBe(true);
      expect(items.every((i) => i.subjectName !== null)).toBe(true);
    });

    it('buckets freshly materialised homework as due soon', async () => {
      const homework = await listHomeworkForStudent(pool, studentId, NOW);
      expect(homework.counts.dueSoon).toBe(homework.total);
      expect(homework.counts.overdue).toBe(0);
    });
  });

  // ─── Student view ──────────────────────────────────────────────────

  describe('student view', () => {
    it('buckets items by how urgent they are', async () => {
      const homework = await listHomeworkForStudent(pool, studentId, NOW);
      const all = [...homework.overdue, ...homework.dueSoon, ...homework.later];
      expect(all.length).toBeGreaterThanOrEqual(3);

      // Pin every item so the bucket counts are exact rather than dependent on the default.
      await setDueDate(pool, all[0].id, new Date(NOW.getTime() - DAY_MS));
      await setDueDate(pool, all[1].id, new Date(NOW.getTime() + 2 * DAY_MS));
      for (const rest of all.slice(2)) {
        await setDueDate(pool, rest.id, new Date(NOW.getTime() + 30 * DAY_MS));
      }

      const updated = await listHomeworkForStudent(pool, studentId, NOW);
      expect(updated.overdue.map((i) => i.id)).toEqual([all[0].id]);
      expect(updated.dueSoon.map((i) => i.id)).toEqual([all[1].id]);
      expect(updated.later.length).toBe(all.length - 2);
      expect(updated.counts).toEqual({
        overdue: 1,
        dueSoon: 1,
        later: all.length - 2,
      });
      expect(updated.total).toBe(all.length);
    });

    it('keeps submitted homework in the list but out of pending', async () => {
      const homework = await listHomeworkForStudent(pool, studentId, NOW);
      const target = [...homework.overdue, ...homework.dueSoon, ...homework.later][0];

      await submitAssignment(pool, target.id, studentId, NOW);

      const after = await listHomeworkForStudent(pool, studentId, NOW);
      expect(after.total).toBe(homework.total);

      const parentView = await listPendingHomeworkForParent(pool, parentId, NOW);
      const pendingIds = parentView.flatMap((c) => [
        ...c.overdue,
        ...c.dueSoon,
        ...c.later,
      ]).map((i) => i.id);
      expect(pendingIds).not.toContain(target.id);
    });

    it('marks homework submitted after its due date as late', async () => {
      const homework = await listHomeworkForStudent(pool, studentId, NOW);
      const target = [...homework.overdue, ...homework.dueSoon, ...homework.later][0];
      await setDueDate(pool, target.id, new Date(NOW.getTime() - 5 * DAY_MS));

      const submitted = await submitAssignment(pool, target.id, studentId, NOW);
      expect(submitted!.status).toBe('late');
      expect(submitted!.kind).toBe('homework');
    });
  });

  // ─── Homework cannot be removed by the student ─────────────────────

  describe('delete refusal', () => {
    it('refuses to delete homework through the assignment delete path', async () => {
      const homework = await listHomeworkForStudent(pool, studentId, NOW);
      const target = [...homework.overdue, ...homework.dueSoon, ...homework.later][0];

      expect(await deleteAssignment(pool, target.id, studentId)).toBe(false);
      expect(await getAssignment(pool, target.id, studentId)).not.toBeNull();
    });

    it('still deletes a self-started assignment', async () => {
      const { id } = await createAssignment(pool, { studentId, title: 'Mine to remove' });
      expect(await deleteAssignment(pool, id, studentId)).toBe(true);
    });
  });

  // ─── Separation from assignments ───────────────────────────────────

  describe('separation from assignments', () => {
    it('keeps homework out of the assignment list', async () => {
      await listHomeworkForStudent(pool, studentId, NOW);
      const assignments = await listAssignmentsForStudent(pool, studentId);
      expect(assignments).toEqual([]);
    });

    it('keeps homework out of the assignment summary', async () => {
      await listHomeworkForStudent(pool, studentId, NOW);
      expect(await getAssignmentSummary(pool, studentId)).toEqual({
        pending: 0,
        submitted: 0,
        late: 0,
        total: 0,
      });
    });

    it('keeps homework out of the parent assignment list', async () => {
      await listHomeworkForStudent(pool, studentId, NOW);
      expect(await listAssignmentsForParent(pool, parentId)).toEqual([]);
    });

    it('keeps assignments out of the homework list', async () => {
      await createAssignment(pool, { studentId, title: 'Self-started', dueAt: NOW });
      const homework = await listHomeworkForStudent(pool, studentId, NOW);
      const titles = [...homework.overdue, ...homework.dueSoon, ...homework.later].map(
        (i) => i.title,
      );
      expect(titles).not.toContain('Self-started');
    });
  });

  // ─── Isolation ─────────────────────────────────────────────────────

  describe('isolation', () => {
    it('does not show one student homework to another', async () => {
      await listHomeworkForStudent(pool, studentId, NOW);
      const other = await createFamily(pool, 'other', 'standard-5');

      const otherHomework = await listHomeworkForStudent(pool, other.studentId, NOW);
      const ids = new Set(
        [...otherHomework.overdue, ...otherHomework.dueSoon, ...otherHomework.later].map(
          (i) => i.id,
        ),
      );

      const mine = await listHomeworkForStudent(pool, studentId, NOW);
      const mineIds = [...mine.overdue, ...mine.dueSoon, ...mine.later].map((i) => i.id);

      expect(mineIds.some((id) => ids.has(id))).toBe(false);
      expect(mine.total).toBe(otherHomework.total);
    });

    it('will not let a student submit another student homework', async () => {
      const other = await createFamily(pool, 'victim', 'standard-5');
      const otherHomework = await listHomeworkForStudent(pool, other.studentId, NOW);
      const target = [...otherHomework.overdue, ...otherHomework.dueSoon, ...otherHomework.later][0];

      expect(await submitAssignment(pool, target.id, studentId, NOW)).toBeNull();

      const untouched = await getAssignment(pool, target.id, other.studentId);
      expect(untouched!.status).toBe('pending');
    });

    it('shows a parent their own children only', async () => {
      await listHomeworkForStudent(pool, studentId, NOW);
      const stranger = await createFamily(pool, 'stranger', 'standard-5');
      await listHomeworkForStudent(pool, stranger.studentId, NOW);

      const mine = await listPendingHomeworkForParent(pool, parentId, NOW);
      expect(mine.length).toBe(1);
      expect(mine[0].studentId).toBe(studentId);
      expect(mine[0].total).toBeGreaterThan(0);
    });

    it('separates siblings into their own groups', async () => {
      await listHomeworkForStudent(pool, studentId, NOW);

      const sibling = await pool.query<{ id: string }>(
        `INSERT INTO academic_users (id, email, password_hash, role)
         VALUES ('u-sib', 'sibling@test.dev', 'x', 'student') RETURNING id`,
      );
      expect(sibling.rows.length).toBe(1);
      await pool.query(
        `INSERT INTO academic_students
           (id, user_id, parent_id, academic_level, display_name, curriculum_form_id)
         VALUES ('s-sib', 'u-sib', $1, 'primary', 'Sibling', 'std3')`,
        [parentId],
      );
      await listHomeworkForStudent(pool, 's-sib', NOW);

      const children = await listPendingHomeworkForParent(pool, parentId, NOW);
      expect(children.length).toBe(2);
      expect(children.map((c) => c.studentName).sort()).toEqual(['Sibling', 'Student main']);
      expect(children[0].studentId).not.toBe(children[1].studentId);
    });

    it('shows nothing to a parent with no children homework', async () => {
      const stranger = await createFamily(pool, 'nokids', 'standard-5');
      expect(await listPendingHomeworkForParent(pool, stranger.parentId, NOW)).toEqual([]);
    });
  });
});
