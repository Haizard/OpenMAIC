import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DuplicateEmailError,
  ValidationError,
  addChild,
  registerParentFirst,
  registerSchool,
  registerStudentFirst,
} from '@/lib/academic/register';
import { ensureAcademicSchema } from '@/lib/academic/schema';
import { verifyPassword } from '@/lib/academic/password';

class PGlitePool {
  constructor(readonly db: PGlite) {}

  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }

  async end() {
    await this.db.close();
  }
}

const studentFirst = {
  studentEmail: 'ada@school.test',
  studentPassword: 'password12',
  studentDisplayName: 'Ada',
  academicLevel: 'undergraduate' as const,
  parentEmail: 'parent@home.test',
  parentPassword: 'password34',
  parentDisplayName: 'Ada Parent',
};

describe('academic registration', () => {
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

  it('student-first links the student to the created parent', async () => {
    const result = await registerStudentFirst(pool, studentFirst);
    const student = await db.query<{ parent_id: string; user_id: string }>(
      'SELECT parent_id, user_id FROM academic_students WHERE user_id = $1',
      [result.studentUserId],
    );
    const parent = await db.query<{ id: string }>(
      'SELECT id FROM academic_parents WHERE user_id = $1',
      [result.parentUserId],
    );
    expect(student.rows[0]?.parent_id).toBe(parent.rows[0]?.id);
    const stored = await db.query<{ password_hash: string }>(
      'SELECT password_hash FROM academic_users WHERE id = $1',
      [result.studentUserId],
    );
    await expect(verifyPassword('password12', stored.rows[0]!.password_hash)).resolves.toBe(true);
  });

  it('parent-first creates the same family link', async () => {
    const result = await registerParentFirst(pool, {
      parentEmail: 'pat@home.test',
      parentPassword: 'password34',
      parentDisplayName: 'Pat',
      studentEmail: 'kid@school.test',
      studentPassword: 'password12',
      studentDisplayName: 'Kid',
      academicLevel: 'primary',
    });
    const student = await db.query<{ parent_id: string }>(
      'SELECT parent_id FROM academic_students WHERE user_id = $1',
      [result.studentUserId],
    );
    const parent = await db.query<{ id: string }>(
      'SELECT id FROM academic_parents WHERE user_id = $1',
      [result.parentUserId],
    );
    expect(student.rows[0]?.parent_id).toBe(parent.rows[0]?.id);
  });

  it('rolls back when a duplicate email is used', async () => {
    await registerStudentFirst(pool, studentFirst);
    await expect(registerStudentFirst(pool, studentFirst)).rejects.toBeInstanceOf(DuplicateEmailError);
    const users = await db.query<{ count: string }>('SELECT count(*)::text AS count FROM academic_users');
    expect(users.rows[0]?.count).toBe('2');
  });

  it('rejects an invalid academic level', async () => {
    await expect(
      registerStudentFirst(pool, { ...studentFirst, academicLevel: 'phd' as never }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('adds a second child under the same parent', async () => {
    const first = await registerParentFirst(pool, {
      parentEmail: 'pat@home.test',
      parentPassword: 'password34',
      parentDisplayName: 'Pat',
      studentEmail: 'kid1@school.test',
      studentPassword: 'password12',
      studentDisplayName: 'Kid One',
      academicLevel: 'primary',
    });
    const parent = await db.query<{ id: string }>(
      'SELECT id FROM academic_parents WHERE user_id = $1',
      [first.parentUserId],
    );
    const second = await addChild(pool, {
      parentId: parent.rows[0]!.id,
      studentEmail: 'kid2@school.test',
      studentPassword: 'password56',
      studentDisplayName: 'Kid Two',
      academicLevel: 'junior_secondary',
    });
    const kids = await db.query<{ user_id: string }>(
      'SELECT user_id FROM academic_students WHERE parent_id = $1 ORDER BY display_name',
      [parent.rows[0]!.id],
    );
    expect(kids.rows.map((row) => row.user_id)).toEqual([first.studentUserId, second.studentUserId]);
  });

  it('school registration creates no student or parent rows', async () => {
    await registerSchool(pool, {
      email: 'office@school.test',
      password: 'password12',
      name: 'North High',
      contact: 'principal@school.test',
    });
    const counts = await db.query<{ students: string; parents: string; schools: string }>(
      `SELECT
         (SELECT count(*)::text FROM academic_students) AS students,
         (SELECT count(*)::text FROM academic_parents) AS parents,
         (SELECT count(*)::text FROM academic_schools) AS schools`,
    );
    expect(counts.rows[0]).toEqual({ students: '0', parents: '0', schools: '1' });
  });
});
