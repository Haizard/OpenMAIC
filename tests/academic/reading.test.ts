import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addChild, registerStudentFirst } from '@/lib/academic/register';
import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureReadingSchema } from '@/lib/academic/reading-schema';
import { seedReadings } from '@/lib/academic/reading-seed';
import {
  canStudentAccessReading,
  createReading,
  deleteReading,
  getReading,
  getReadingForStudent,
  getReadingSummary,
  listReadingProgressForParent,
  listReadingsForStudent,
  listReadingsForTopic,
  resolveCurriculumLevelId,
  setReadingStatus,
  updateReading,
} from '@/lib/academic/reading';
import type { AcademicLevel } from '@/lib/academic/types';

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

/** Readings seeded against A-level (Form 5/6) topics. */
const A_LEVEL_READING = 'read-f5-math-1-calculus';
/** Readings seeded against primary (Standard 1) topics. */
const PRIMARY_READING = 'read-std1-math-1-counting';

async function createFamily(
  pool: PGlitePool,
  suffix: string,
  level: AcademicLevel,
): Promise<{ studentId: string; parentId: string; parentUserId: string }> {
  const result = await registerStudentFirst(pool, {
    studentEmail: `student-${suffix}@test.dev`,
    studentPassword: 'password12',
    studentDisplayName: `Student ${suffix}`,
    academicLevel: level,
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

  return {
    studentId: student.rows[0].id,
    parentId: parent.rows[0].id,
    parentUserId: result.parentUserId,
  };
}

describe('academic reading library (Slice 2)', () => {
  let db: PGlite;
  let pool: PGlitePool;

  beforeEach(async () => {
    db = new PGlite();
    pool = new PGlitePool(db);
    await ensureAcademicSchema(pool);
    await ensureCurriculumSchema(pool);
    await seedCurriculum(pool);
    await ensureReadingSchema(pool);
    await seedReadings(pool);
  });

  afterEach(async () => {
    await db.close();
  });

  // ─── Schema and seeding ────────────────────────────────────────────

  describe('schema and seeding', () => {
    it('seeds readings attached to real curriculum topics', async () => {
      const seeded = await pool.query<{ cnt: string | number }>(
        'SELECT COUNT(*) AS cnt FROM academic_readings',
      );
      expect(Number(seeded.rows[0].cnt)).toBeGreaterThan(0);

      // Every reading must point at a topic that actually exists.
      const orphans = await pool.query<{ cnt: string | number }>(
        `SELECT COUNT(*) AS cnt
         FROM academic_readings r
         LEFT JOIN curriculum_topics t ON t.id = r.topic_id
         WHERE t.id IS NULL`,
      );
      expect(Number(orphans.rows[0].cnt)).toBe(0);
    });

    it('is idempotent — re-seeding does not duplicate readings', async () => {
      const before = await pool.query<{ cnt: string | number }>(
        'SELECT COUNT(*) AS cnt FROM academic_readings',
      );
      await seedReadings(pool);
      const after = await pool.query<{ cnt: string | number }>(
        'SELECT COUNT(*) AS cnt FROM academic_readings',
      );
      expect(Number(after.rows[0].cnt)).toBe(Number(before.rows[0].cnt));
    });

    it('covers every curriculum level so no student sees an empty library', async () => {
      for (const level of ['primary', 'secondary', 'a_level'] as const) {
        const result = await pool.query<{ cnt: string | number }>(
          `SELECT COUNT(*) AS cnt
           FROM academic_readings r
           JOIN curriculum_topics t ON t.id = r.topic_id
           JOIN curriculum_subjects sub ON sub.id = t.subject_id
           JOIN curriculum_forms f ON f.id = sub.form_id
           WHERE f.level_id = $1`,
          [level],
        );
        expect(Number(result.rows[0].cnt)).toBeGreaterThan(0);
      }
    });
  });

  // ─── CRUD ──────────────────────────────────────────────────────────

  describe('reading CRUD', () => {
    it('creates and retrieves a reading', async () => {
      const { id } = await createReading(pool, {
        topicId: 'std1-math-1',
        title: 'Test note',
        summary: 'A summary',
        body: '# Body',
        kind: 'explainer',
        readingMinutes: 4,
      });

      const reading = await getReading(pool, id);
      expect(reading).not.toBeNull();
      expect(reading!.title).toBe('Test note');
      expect(reading!.kind).toBe('explainer');
      expect(reading!.readingMinutes).toBe(4);
      expect(reading!.published).toBe(true);
    });

    it('updates only the fields provided', async () => {
      const { id } = await createReading(pool, {
        topicId: 'std1-math-1',
        title: 'Original',
        summary: 'Keep me',
      });

      const updated = await updateReading(pool, id, { title: 'Renamed' });
      expect(updated!.title).toBe('Renamed');
      expect(updated!.summary).toBe('Keep me');
    });

    it('deletes a reading', async () => {
      const { id } = await createReading(pool, { topicId: 'std1-math-1', title: 'Doomed' });
      expect(await deleteReading(pool, id)).toBe(true);
      expect(await getReading(pool, id)).toBeNull();
      expect(await deleteReading(pool, id)).toBe(false);
    });

    it('lists published readings for a topic', async () => {
      await createReading(pool, { topicId: 'std1-math-1', title: 'Hidden', published: false });
      const published = await listReadingsForTopic(pool, 'std1-math-1');
      expect(published.some((r) => r.title === 'Hidden')).toBe(false);
      expect(published.length).toBeGreaterThan(0);
    });
  });

  // ─── Curriculum-level scoping (locked rule 8) ──────────────────────

  describe('curriculum-level scoping', () => {
    it('maps legacy and unknown levels onto real curriculum levels', () => {
      expect(resolveCurriculumLevelId('primary')).toBe('primary');
      expect(resolveCurriculumLevelId('secondary')).toBe('secondary');
      expect(resolveCurriculumLevelId('a_level')).toBe('a_level');
      expect(resolveCurriculumLevelId('junior_secondary')).toBe('secondary');
      expect(resolveCurriculumLevelId('senior_secondary')).toBe('a_level');
      // No curriculum exists above A-level, so university levels park there.
      expect(resolveCurriculumLevelId('undergraduate')).toBe('a_level');
      expect(resolveCurriculumLevelId('postgraduate')).toBe('a_level');
      expect(resolveCurriculumLevelId('other')).toBe('a_level');
    });

    it('shows a primary student primary material only', async () => {
      const primary = await createFamily(pool, 'primary-scope', 'primary');
      const readings = await listReadingsForStudent(pool, primary.studentId);

      expect(readings.length).toBeGreaterThan(0);
      const levelIds = await pool.query<{ id: string }>(
        `SELECT DISTINCT f.level_id AS id
         FROM academic_readings r
         JOIN curriculum_topics t ON t.id = r.topic_id
         JOIN curriculum_subjects sub ON sub.id = t.subject_id
         JOIN curriculum_forms f ON f.id = sub.form_id
         WHERE r.id = ANY($1::text[])`,
        [readings.map((r) => r.id)],
      );
      expect(levelIds.rows.map((r) => r.id)).toEqual(['primary']);
    });

    it('hides A-level material from a primary student', async () => {
      const primary = await createFamily(pool, 'primary-hide', 'primary');

      expect(await canStudentAccessReading(pool, primary.studentId, A_LEVEL_READING)).toBe(false);
      expect(await getReadingForStudent(pool, primary.studentId, A_LEVEL_READING)).toBeNull();

      const readings = await listReadingsForStudent(pool, primary.studentId);
      expect(readings.some((r) => r.id === A_LEVEL_READING)).toBe(false);
    });

    it('lets an A-level student open A-level material', async () => {
      const advanced = await createFamily(pool, 'a-level', 'a_level');

      expect(await canStudentAccessReading(pool, advanced.studentId, A_LEVEL_READING)).toBe(true);
      const reading = await getReadingForStudent(pool, advanced.studentId, A_LEVEL_READING);
      expect(reading).not.toBeNull();
      expect(reading!.body.length).toBeGreaterThan(0);
    });

    it('refuses to write progress for a reading outside the student level', async () => {
      const primary = await createFamily(pool, 'primary-write', 'primary');
      const result = await setReadingStatus(pool, primary.studentId, A_LEVEL_READING, 'read');
      expect(result).toBeNull();

      const rows = await pool.query<{ cnt: string | number }>(
        'SELECT COUNT(*) AS cnt FROM academic_reading_progress WHERE student_id = $1',
        [primary.studentId],
      );
      expect(Number(rows.rows[0].cnt)).toBe(0);
    });

    it('hides unpublished readings from students', async () => {
      const primary = await createFamily(pool, 'primary-unpub', 'primary');
      const { id } = await createReading(pool, {
        topicId: 'std1-math-1',
        title: 'Draft note',
        published: false,
      });
      const readings = await listReadingsForStudent(pool, primary.studentId);
      expect(readings.some((r) => r.id === id)).toBe(false);
    });

    it('filters the library by topic when asked', async () => {
      const primary = await createFamily(pool, 'primary-topic', 'primary');
      const all = await listReadingsForStudent(pool, primary.studentId);
      const filtered = await listReadingsForStudent(pool, primary.studentId, {
        topicId: 'std1-math-1',
      });

      expect(filtered.length).toBeLessThan(all.length);
      expect(filtered.every((r) => r.topicId === 'std1-math-1')).toBe(true);
    });
  });

  // ─── Progress ──────────────────────────────────────────────────────

  describe('reading progress', () => {
    it('moves unread to reading to read, stamping the right timestamps', async () => {
      const student = await createFamily(pool, 'progress', 'primary');

      const fresh = await getReadingForStudent(pool, student.studentId, PRIMARY_READING);
      expect(fresh!.status).toBe('unread');
      expect(fresh!.lastReadAt).toBeNull();
      expect(fresh!.completedAt).toBeNull();

      const startedAt = new Date('2026-09-12T10:00:00Z');
      expect(await setReadingStatus(pool, student.studentId, PRIMARY_READING, 'reading', startedAt))
        .toBe('reading');

      const inProgress = await getReadingForStudent(pool, student.studentId, PRIMARY_READING);
      expect(inProgress!.status).toBe('reading');
      expect(inProgress!.lastReadAt?.toISOString()).toBe(startedAt.toISOString());
      expect(inProgress!.completedAt).toBeNull();

      const finishedAt = new Date('2026-09-12T11:00:00Z');
      expect(await setReadingStatus(pool, student.studentId, PRIMARY_READING, 'read', finishedAt))
        .toBe('read');

      const done = await getReadingForStudent(pool, student.studentId, PRIMARY_READING);
      expect(done!.status).toBe('read');
      expect(done!.completedAt?.toISOString()).toBe(finishedAt.toISOString());
    });

    it('clears the stamps when a reading goes back to unread', async () => {
      const student = await createFamily(pool, 'reset', 'primary');
      await setReadingStatus(pool, student.studentId, PRIMARY_READING, 'read');
      await setReadingStatus(pool, student.studentId, PRIMARY_READING, 'unread');

      const reading = await getReadingForStudent(pool, student.studentId, PRIMARY_READING);
      expect(reading!.status).toBe('unread');
      expect(reading!.lastReadAt).toBeNull();
      expect(reading!.completedAt).toBeNull();
    });

    it('keeps one progress row per student per reading', async () => {
      const student = await createFamily(pool, 'upsert', 'primary');
      await setReadingStatus(pool, student.studentId, PRIMARY_READING, 'reading');
      await setReadingStatus(pool, student.studentId, PRIMARY_READING, 'read');
      await setReadingStatus(pool, student.studentId, PRIMARY_READING, 'read');

      const rows = await pool.query<{ cnt: string | number }>(
        'SELECT COUNT(*) AS cnt FROM academic_reading_progress WHERE student_id = $1 AND reading_id = $2',
        [student.studentId, PRIMARY_READING],
      );
      expect(Number(rows.rows[0].cnt)).toBe(1);
    });

    it('counts unread readings that have no progress row at all', async () => {
      const student = await createFamily(pool, 'summary', 'primary');

      const before = await getReadingSummary(pool, student.studentId);
      expect(before.total).toBeGreaterThan(0);
      expect(before.unread).toBe(before.total);
      expect(before.read).toBe(0);

      await setReadingStatus(pool, student.studentId, PRIMARY_READING, 'read');

      const after = await getReadingSummary(pool, student.studentId);
      expect(after.total).toBe(before.total);
      expect(after.read).toBe(1);
      expect(after.unread).toBe(before.total - 1);
    });

    it('summarises only the student own level', async () => {
      const primary = await createFamily(pool, 'sum-primary', 'primary');
      const advanced = await createFamily(pool, 'sum-advanced', 'a_level');

      const primarySummary = await getReadingSummary(pool, primary.studentId);
      const advancedSummary = await getReadingSummary(pool, advanced.studentId);

      expect(primarySummary.total).toBeGreaterThan(0);
      expect(advancedSummary.total).toBeGreaterThan(0);
      // The two levels must not be counting the same content.
      const primaryList = await listReadingsForStudent(pool, primary.studentId);
      expect(primaryList.some((r) => r.id === A_LEVEL_READING)).toBe(false);
    });
  });

  // ─── Cross-student and cross-family isolation ──────────────────────

  describe('isolation', () => {
    it('does not leak one student progress to another student', async () => {
      const alice = await createFamily(pool, 'alice', 'primary');
      const bob = await createFamily(pool, 'bob', 'primary');

      await setReadingStatus(pool, alice.studentId, PRIMARY_READING, 'read');

      const aliceReading = await getReadingForStudent(pool, alice.studentId, PRIMARY_READING);
      const bobReading = await getReadingForStudent(pool, bob.studentId, PRIMARY_READING);

      expect(aliceReading!.status).toBe('read');
      expect(bobReading!.status).toBe('unread');

      const bobSummary = await getReadingSummary(pool, bob.studentId);
      expect(bobSummary.read).toBe(0);
    });

    it('keeps siblings in the same family separate', async () => {
      const parent = await createFamily(pool, 'sibling-parent', 'primary');
      const child = await addChild(pool, {
        parentId: parent.parentId,
        studentEmail: 'second-child@test.dev',
        studentPassword: 'password12',
        studentDisplayName: 'Second Child',
        academicLevel: 'primary',
      });
      const second = await pool.query<{ id: string }>(
        'SELECT id FROM academic_students WHERE user_id = $1',
        [child.studentUserId],
      );
      const siblingId = second.rows[0].id;

      await setReadingStatus(pool, parent.studentId, PRIMARY_READING, 'read');

      const siblingReading = await getReadingForStudent(pool, siblingId, PRIMARY_READING);
      expect(siblingReading!.status).toBe('unread');
    });

    it('shows a parent only their own children reading activity', async () => {
      const familyOne = await createFamily(pool, 'fam-one', 'primary');
      const familyTwo = await createFamily(pool, 'fam-two', 'primary');

      await setReadingStatus(pool, familyOne.studentId, PRIMARY_READING, 'read');

      const one = await listReadingProgressForParent(pool, familyOne.parentId);
      const two = await listReadingProgressForParent(pool, familyTwo.parentId);

      expect(one.length).toBe(1);
      expect(one[0].studentId).toBe(familyOne.studentId);
      expect(one[0].status).toBe('read');
      expect(two.length).toBe(0);
    });

    it('does not show unstarted readings in the parent mentor view', async () => {
      const family = await createFamily(pool, 'mentor', 'primary');
      const progress = await listReadingProgressForParent(pool, family.parentId);
      expect(progress.length).toBe(0);
    });
  });

  // ─── Cascade behaviour ─────────────────────────────────────────────

  describe('cascades', () => {
    it('removes progress rows when the reading is deleted', async () => {
      const student = await createFamily(pool, 'cascade', 'primary');
      await setReadingStatus(pool, student.studentId, PRIMARY_READING, 'read');

      await deleteReading(pool, PRIMARY_READING);

      const rows = await pool.query<{ cnt: string | number }>(
        'SELECT COUNT(*) AS cnt FROM academic_reading_progress WHERE reading_id = $1',
        [PRIMARY_READING],
      );
      expect(Number(rows.rows[0].cnt)).toBe(0);
    });

    it('removes readings when their curriculum topic is deleted', async () => {
      await createReading(pool, { topicId: 'std2-math-1', title: 'Temporary note' });

      await pool.query('DELETE FROM curriculum_topics WHERE id = $1', ['std2-math-1']);

      const rows = await pool.query<{ cnt: string | number }>(
        'SELECT COUNT(*) AS cnt FROM academic_readings WHERE topic_id = $1',
        ['std2-math-1'],
      );
      expect(Number(rows.rows[0].cnt)).toBe(0);
    });
  });
});
