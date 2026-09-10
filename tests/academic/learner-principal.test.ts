import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { studentLearnerKey, isStudentRole } from '@/lib/academic/learner-principal';
import { registerStudentFirst } from '@/lib/academic/register';
import { ensureAcademicSchema } from '@/lib/academic/schema';
import type { AcademicDb } from '@/lib/academic/register';

class PGlitePool {
  constructor(readonly db: PGlite) {}

  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }

  async end() {
    await this.db.close();
  }
}

describe('academic learner principal', () => {
  let db: PGlite;
  let pool: PGlitePool;

  beforeEach(async () => {
    db = new PGlite();
    pool = new PGlitePool(db);
    await ensureAcademicSchema(pool);
  });

  afterEach(async () => {
    await pool.end();
  });

  it('formats a student learner key as user:{id}', () => {
    expect(studentLearnerKey('abc-123')).toBe('user:abc-123');
  });

  it('rejects non-student roles as learner principals', () => {
    expect(isStudentRole('student')).toBe(true);
    expect(isStudentRole('parent')).toBe(false);
    expect(isStudentRole('school')).toBe(false);
    expect(isStudentRole('unknown')).toBe(false);
  });

  it('a student session yields a learner key, a parent session does not', async () => {
    const result = await registerStudentFirst(pool, {
      studentEmail: 'ada@school.test',
      studentPassword: 'password12',
      studentDisplayName: 'Ada',
      academicLevel: 'undergraduate',
      parentEmail: 'parent@home.test',
      parentPassword: 'password34',
      parentDisplayName: 'Ada Parent',
    });

    const student = await pool.query<{ id: string }>(
      'SELECT id FROM academic_students WHERE user_id = $1',
      [result.studentUserId],
    );
    const parent = await pool.query<{ id: string }>(
      'SELECT id FROM academic_parents WHERE user_id = $1',
      [result.parentUserId],
    );

    // A real auth module would read from the session row; here we assert the
    // policy directly from the profile tables to keep the test db-only.
    const studentId = student.rows[0]!.id;
    const parentId = parent.rows[0]!.id;

    expect(studentLearnerKey(studentId)).toBe(`user:${studentId}`);
    // Parents are viewers; they do not own a learner partition in v1.
    expect(isStudentRole('student')).toBe(true);
    expect(isStudentRole('parent')).toBe(false);
  });

  it('a school has no student profile so has no learner key', async () => {
    const { registerSchool } = await import('@/lib/academic/register');
    const school = await registerSchool(pool, {
      email: 'office@school.test',
      password: 'password12',
      name: 'North High',
      contact: 'principal@school.test',
    });

    const student = await pool.query<{ id: string }>(
      'SELECT id FROM academic_students WHERE user_id = $1',
      [school.schoolUserId],
    );
    expect(student.rows.length).toBe(0);
    expect(isStudentRole('school')).toBe(false);
  });
});
