import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addChild, registerStudentFirst, ValidationError } from '@/lib/academic/register';
import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureReadingSchema } from '@/lib/academic/reading-schema';
import { seedReadings } from '@/lib/academic/reading-seed';
import {
  getReadingSummary,
  listReadingsForStudent,
} from '@/lib/academic/reading';

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

const STANDARD_1_READING = 'read-std1-math-1-counting';
const STANDARD_5_READING = 'read-std5-math-1-percentages';

async function registerStudent(
  pool: PGlitePool,
  suffix: string,
  level: string,
  formLevel?: string,
): Promise<{ studentId: string; parentId: string }> {
  const result = await registerStudentFirst(pool, {
    studentEmail: `student-${suffix}@test.dev`,
    studentPassword: 'password12',
    studentDisplayName: `Student ${suffix}`,
    academicLevel: level as never,
    formLevel,
    parentEmail: `parent-${suffix}@test.dev`,
    parentPassword: 'password12',
    parentDisplayName: `Parent ${suffix}`,
  });

  const student = await pool.query<{ id: string; curriculum_form_id: string | null }>(
    'SELECT id, curriculum_form_id FROM academic_students WHERE user_id = $1',
    [result.studentUserId],
  );
  const parent = await pool.query<{ id: string }>(
    'SELECT id FROM academic_parents WHERE user_id = $1',
    [result.parentUserId],
  );

  return {
    studentId: student.rows[0].id,
    parentId: parent.rows[0].id,
  };
}

describe('student curriculum form (grade)', () => {
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

  // ─── Storing the form ──────────────────────────────────────────────

  describe('registration', () => {
    it('stores the form the student selected', async () => {
      const { studentId } = await registerStudent(pool, 'std5', 'primary', 'standard-5');

      const row = await pool.query<{ curriculum_form_id: string | null }>(
        'SELECT curriculum_form_id FROM academic_students WHERE id = $1',
        [studentId],
      );
      expect(row.rows[0].curriculum_form_id).toBe('std5');
    });

    it('stores nothing when no form is supplied, and does not fail', async () => {
      const { studentId } = await registerStudent(pool, 'nolevel', 'primary');

      const row = await pool.query<{ curriculum_form_id: string | null }>(
        'SELECT curriculum_form_id FROM academic_students WHERE id = $1',
        [studentId],
      );
      expect(row.rows[0].curriculum_form_id).toBeNull();
    });

    it('treats an empty form string as no form', async () => {
      const { studentId } = await registerStudent(pool, 'empty', 'primary', '');

      const row = await pool.query<{ curriculum_form_id: string | null }>(
        'SELECT curriculum_form_id FROM academic_students WHERE id = $1',
        [studentId],
      );
      expect(row.rows[0].curriculum_form_id).toBeNull();
    });

    it('rejects a form that does not belong to the chosen level', async () => {
      await expect(registerStudent(pool, 'mismatch', 'primary', 'form-5')).rejects.toThrow(
        ValidationError,
      );
    });

    it('rejects an unknown form', async () => {
      await expect(registerStudent(pool, 'unknown', 'primary', 'standard-99')).rejects.toThrow(
        ValidationError,
      );
    });

    it('leaves no partial rows behind when the form is rejected', async () => {
      await expect(registerStudent(pool, 'norows', 'primary', 'form-5')).rejects.toThrow();

      const users = await pool.query<{ cnt: string | number }>(
        'SELECT COUNT(*) AS cnt FROM academic_users',
      );
      expect(Number(users.rows[0].cnt)).toBe(0);
    });

    it('accepts a legacy level with its matching form', async () => {
      const { studentId } = await registerStudent(pool, 'legacy', 'junior_secondary', 'form-2');

      const row = await pool.query<{ curriculum_form_id: string | null }>(
        'SELECT curriculum_form_id FROM academic_students WHERE id = $1',
        [studentId],
      );
      expect(row.rows[0].curriculum_form_id).toBe('form2');
    });

    it('stores the form for a child added later', async () => {
      const { parentId } = await registerStudent(pool, 'parent', 'primary', 'standard-1');

      const child = await addChild(pool, {
        parentId,
        studentEmail: 'child@test.dev',
        studentPassword: 'password12',
        studentDisplayName: 'Child',
        academicLevel: 'primary',
        formLevel: 'standard-6',
      });

      const row = await pool.query<{ curriculum_form_id: string | null }>(
        'SELECT curriculum_form_id FROM academic_students WHERE user_id = $1',
        [child.studentUserId],
      );
      expect(row.rows[0].curriculum_form_id).toBe('std6');
    });

    it('rejects a mismatched form when adding a child', async () => {
      const { parentId } = await registerStudent(pool, 'parent2', 'primary', 'standard-1');

      await expect(
        addChild(pool, {
          parentId,
          studentEmail: 'bad-child@test.dev',
          studentPassword: 'password12',
          studentDisplayName: 'Bad Child',
          academicLevel: 'primary',
          formLevel: 'form-5',
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ─── Content scoping by form ───────────────────────────────────────

  describe('content scoping', () => {
    it('shows a Standard 1 student only Standard 1 material', async () => {
      const { studentId } = await registerStudent(pool, 'scope1', 'primary', 'standard-1');
      const readings = await listReadingsForStudent(pool, studentId);

      expect(readings.length).toBeGreaterThan(0);
      expect(readings.map((r) => r.formName)).toEqual(['Standard 1']);
      expect(readings.some((r) => r.id === STANDARD_1_READING)).toBe(true);
      expect(readings.some((r) => r.id === STANDARD_5_READING)).toBe(false);
    });

    it('shows a Standard 5 student Standard 5 material, not Standard 1', async () => {
      const { studentId } = await registerStudent(pool, 'scope5', 'primary', 'standard-5');
      const readings = await listReadingsForStudent(pool, studentId);

      expect(readings.some((r) => r.id === STANDARD_5_READING)).toBe(true);
      expect(readings.some((r) => r.id === STANDARD_1_READING)).toBe(false);
      expect(readings.every((r) => r.formName === 'Standard 5')).toBe(true);
    });

    it('keeps a form-scoped library smaller than a level-wide one', async () => {
      const scoped = await registerStudent(pool, 'scoped', 'primary', 'standard-5');
      const unscoped = await registerStudent(pool, 'unscoped', 'primary');

      const scopedList = await listReadingsForStudent(pool, scoped.studentId);
      const unscopedList = await listReadingsForStudent(pool, unscoped.studentId);

      expect(scopedList.length).toBeLessThan(unscopedList.length);
      expect(unscopedList.length).toBeGreaterThan(0);
    });

    it('falls back to level scoping for students with no stored form', async () => {
      const { studentId } = await registerStudent(pool, 'fallback', 'primary');
      const readings = await listReadingsForStudent(pool, studentId);

      // No form means the whole primary level, which spans several standards.
      const forms = new Set(readings.map((r) => r.formName));
      expect(forms.size).toBeGreaterThan(1);
    });

    it('counts only the form-scoped material in the summary', async () => {
      const scoped = await registerStudent(pool, 'sum-scoped', 'primary', 'standard-1');
      const unscoped = await registerStudent(pool, 'sum-unscoped', 'primary');

      const scopedSummary = await getReadingSummary(pool, scoped.studentId);
      const unscopedSummary = await getReadingSummary(pool, unscoped.studentId);

      expect(scopedSummary.total).toBeGreaterThan(0);
      expect(scopedSummary.total).toBeLessThan(unscopedSummary.total);
    });

    it('does not let a form-scoped student reach another form material', async () => {
      const { studentId } = await registerStudent(pool, 'reach', 'primary', 'standard-1');
      const readings = await listReadingsForStudent(pool, studentId);

      expect(readings.some((r) => r.id === STANDARD_5_READING)).toBe(false);
      expect(readings.some((r) => r.id === 'read-std6-math-1-algebra-basics')).toBe(false);
    });
  });
});
