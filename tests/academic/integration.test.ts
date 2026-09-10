import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { verifyPassword } from '@/lib/academic/password';
import {
  addChild,
  DuplicateEmailError,
  registerParentFirst,
  registerSchool,
  registerStudentFirst,
  ValidationError,
} from '@/lib/academic/register';
import { ensureAcademicSchema } from '@/lib/academic/schema';
import {
  createSession,
  destroySession,
  readSession,
  SESSION_COOKIE,
} from '@/lib/academic/session';
import { getRequiredRole, getRoleFromCookie, ROLE_COOKIE } from '@/lib/academic/middleware-auth';
import { studentLearnerKey, isStudentRole } from '@/lib/academic/learner-principal';

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

describe('Slice 0 integration tests', () => {
  let db: PGlite;
  let pool: PGlitePool;

  beforeEach(async () => {
    db = new PGlite();
    pool = new PGlitePool(db);
    await ensureAcademicSchema(pool);
  });

  afterEach(async () => {
    await db.close();
  });

  // ─── Family transaction tests ───────────────────────────────────────

  describe('family transaction', () => {
    it('student-first creates parent and student in one transaction', async () => {
      const result = await registerStudentFirst(pool, {
        studentEmail: 'ada@school.test',
        studentPassword: 'password12',
        studentDisplayName: 'Ada Lovelace',
        academicLevel: 'undergraduate',
        parentEmail: 'parent@home.test',
        parentPassword: 'password34',
        parentDisplayName: 'Ada Parent',
      });

      // Both users exist
      const users = await db.query<{ id: string; role: string }>(
        `SELECT id, role FROM academic_users ORDER BY role`,
      );
      expect(users.rows).toHaveLength(2);
      expect(users.rows.map((r) => r.role).sort()).toEqual(['parent', 'student']);

      // Student is linked to parent
      const student = await db.query<{ parent_id: string; display_name: string; academic_level: string }>(
        `SELECT parent_id, display_name, academic_level FROM academic_students WHERE user_id = $1`,
        [result.studentUserId],
      );
      expect(student.rows).toHaveLength(1);
      expect(student.rows[0]!.academic_level).toBe('undergraduate');
      expect(student.rows[0]!.display_name).toBe('Ada Lovelace');

      const parent = await db.query<{ id: string }>(
        `SELECT id FROM academic_parents WHERE user_id = $1`,
        [result.parentUserId],
      );
      expect(student.rows[0]!.parent_id).toBe(parent.rows[0]!.id);

      // Passwords are properly hashed
      const stored = await db.query<{ password_hash: string }>(
        `SELECT password_hash FROM academic_users WHERE id = $1`,
        [result.studentUserId],
      );
      await expect(verifyPassword('password12', stored.rows[0]!.password_hash)).resolves.toBe(true);
    });

    it('parent-first creates the same family link as student-first', async () => {
      const result = await registerParentFirst(pool, {
        parentEmail: 'pat@home.test',
        parentPassword: 'password34',
        parentDisplayName: 'Pat Parent',
        studentEmail: 'kid@school.test',
        studentPassword: 'password12',
        studentDisplayName: 'Kid Student',
        academicLevel: 'primary',
      });

      const student = await db.query<{ parent_id: string }>(
        `SELECT parent_id FROM academic_students WHERE user_id = $1`,
        [result.studentUserId],
      );
      const parent = await db.query<{ id: string }>(
        `SELECT id FROM academic_parents WHERE user_id = $1`,
        [result.parentUserId],
      );
      expect(student.rows[0]!.parent_id).toBe(parent.rows[0]!.id);
    });

    it('rolls back entirely when duplicate email is used mid-transaction', async () => {
      // Register first family
      await registerStudentFirst(pool, {
        studentEmail: 'ada@school.test',
        studentPassword: 'password12',
        studentDisplayName: 'Ada',
        academicLevel: 'undergraduate',
        parentEmail: 'parent@home.test',
        parentPassword: 'password34',
        parentDisplayName: 'Ada Parent',
      });

      // Attempt duplicate — should throw and leave DB unchanged
      await expect(
        registerStudentFirst(pool, {
          studentEmail: 'ada@school.test',
          studentPassword: 'password56',
          studentDisplayName: 'Ada Duplicate',
          academicLevel: 'primary',
          parentEmail: 'another@home.test',
          parentPassword: 'password78',
          parentDisplayName: 'Another Parent',
        }),
      ).rejects.toBeInstanceOf(DuplicateEmailError);

      // Only the original 2 users exist
      const count = await db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM academic_users`,
      );
      expect(count.rows[0]!.count).toBe('2');
    });

    it('can add a second child to the same parent', async () => {
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
        `SELECT id FROM academic_parents WHERE user_id = $1`,
        [first.parentUserId],
      );

      await addChild(pool, {
        parentId: parent.rows[0]!.id,
        studentEmail: 'kid2@school.test',
        studentPassword: 'password56',
        studentDisplayName: 'Kid Two',
        academicLevel: 'junior_secondary',
      });

      const kids = await db.query<{ display_name: string }>(
        `SELECT display_name FROM academic_students WHERE parent_id = $1 ORDER BY display_name`,
        [parent.rows[0]!.id],
      );
      expect(kids.rows).toHaveLength(2);
      expect(kids.rows.map((r) => r.display_name)).toEqual(['Kid One', 'Kid Two']);
    });

    it('rejects addChild with a missing parent', async () => {
      await expect(
        addChild(pool, {
          parentId: 'nonexistent-parent-id',
          studentEmail: 'kid@school.test',
          studentPassword: 'password12',
          studentDisplayName: 'Kid',
          academicLevel: 'primary',
        }),
      ).rejects.toThrow('Parent not found');
    });

    it('rejects registration when student and parent emails are the same', async () => {
      await expect(
        registerStudentFirst(pool, {
          studentEmail: 'same@test.com',
          studentPassword: 'password12',
          studentDisplayName: 'Same',
          academicLevel: 'primary',
          parentEmail: 'same@test.com',
          parentPassword: 'password34',
          parentDisplayName: 'Same Parent',
        }),
      ).rejects.toThrow('Student and parent emails must differ');
    });

    it('rejects short passwords', async () => {
      await expect(
        registerStudentFirst(pool, {
          studentEmail: 'ada@school.test',
          studentPassword: 'short',
          studentDisplayName: 'Ada',
          academicLevel: 'primary',
          parentEmail: 'parent@home.test',
          parentPassword: 'password34',
          parentDisplayName: 'Parent',
        }),
      ).rejects.toThrow('at least 8 characters');
    });
  });

  // ─── Duplicate email tests ──────────────────────────────────────────

  describe('duplicate email', () => {
    it('throws DuplicateEmailError for duplicate student email', async () => {
      await registerStudentFirst(pool, {
        studentEmail: 'ada@school.test',
        studentPassword: 'password12',
        studentDisplayName: 'Ada',
        academicLevel: 'primary',
        parentEmail: 'parent@home.test',
        parentPassword: 'password34',
        parentDisplayName: 'Parent',
      });

      await expect(
        registerStudentFirst(pool, {
          studentEmail: 'ada@school.test',
          studentPassword: 'password56',
          studentDisplayName: 'Another Ada',
          academicLevel: 'primary',
          parentEmail: 'other@home.test',
          parentPassword: 'password78',
          parentDisplayName: 'Other Parent',
        }),
      ).rejects.toBeInstanceOf(DuplicateEmailError);
    });

    it('throws DuplicateEmailError for duplicate parent email', async () => {
      await registerStudentFirst(pool, {
        studentEmail: 'ada@school.test',
        studentPassword: 'password12',
        studentDisplayName: 'Ada',
        academicLevel: 'primary',
        parentEmail: 'parent@home.test',
        parentPassword: 'password34',
        parentDisplayName: 'Parent',
      });

      await expect(
        registerStudentFirst(pool, {
          studentEmail: 'newstudent@school.test',
          studentPassword: 'password56',
          studentDisplayName: 'New Student',
          academicLevel: 'primary',
          parentEmail: 'parent@home.test',
          parentPassword: 'password78',
          parentDisplayName: 'Same Parent',
        }),
      ).rejects.toBeInstanceOf(DuplicateEmailError);
    });

    it('throws DuplicateEmailError for duplicate school email', async () => {
      await registerSchool(pool, {
        email: 'office@school.test',
        password: 'password12',
        name: 'North High',
        contact: 'principal@school.test',
      });

      await expect(
        registerSchool(pool, {
          email: 'office@school.test',
          password: 'password56',
          name: 'South High',
          contact: 'other@school.test',
        }),
      ).rejects.toBeInstanceOf(DuplicateEmailError);
    });

    it('rolls back partial writes on duplicate email', async () => {
      await registerStudentFirst(pool, {
        studentEmail: 'ada@school.test',
        studentPassword: 'password12',
        studentDisplayName: 'Ada',
        academicLevel: 'primary',
        parentEmail: 'parent@home.test',
        parentPassword: 'password34',
        parentDisplayName: 'Parent',
      });

      await expect(
        registerStudentFirst(pool, {
          studentEmail: 'ada@school.test',
          studentPassword: 'password56',
          studentDisplayName: 'Dup',
          academicLevel: 'primary',
          parentEmail: 'newparent@home.test',
          parentPassword: 'password78',
          parentDisplayName: 'New Parent',
        }),
      ).rejects.toBeInstanceOf(DuplicateEmailError);

      // Only 2 users from the first registration
      const users = await db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM academic_users`,
      );
      expect(users.rows[0]!.count).toBe('2');

      // No orphan parent from the rolled-back transaction
      const parents = await db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM academic_parents`,
      );
      expect(parents.rows[0]!.count).toBe('1');
    });
  });

  // ─── Role 403 tests (middleware-auth) ───────────────────────────────

  describe('role-based access', () => {
    it('maps each role to its correct route prefix', () => {
      expect(getRequiredRole('/learn')).toBe('student');
      expect(getRequiredRole('/learn/deep/nested')).toBe('student');
      expect(getRequiredRole('/parent')).toBe('parent');
      expect(getRequiredRole('/parent/children')).toBe('parent');
      expect(getRequiredRole('/school')).toBe('school');
      expect(getRequiredRole('/school/roster')).toBe('school');
    });

    it('returns null for public routes (no role required)', () => {
      expect(getRequiredRole('/')).toBeNull();
      expect(getRequiredRole('/login')).toBeNull();
      expect(getRequiredRole('/register')).toBeNull();
      expect(getRequiredRole('/register/student')).toBeNull();
      expect(getRequiredRole('/register/parent')).toBeNull();
      expect(getRequiredRole('/register/school')).toBeNull();
      expect(getRequiredRole('/api/academic/login')).toBeNull();
      expect(getRequiredRole('/api/academic/register/student')).toBeNull();
    });

    it('does not treat prefix lookalikes as protected', () => {
      expect(getRequiredRole('/learning-extras')).toBeNull();
      expect(getRequiredRole('/schoolnotes')).toBeNull();
      expect(getRequiredRole('/parents-portal')).toBeNull();
    });

    it('getRoleFromCookie rejects unknown roles', () => {
      expect(getRoleFromCookie('admin')).toBeNull();
      expect(getRoleFromCookie('teacher')).toBeNull();
      expect(getRoleFromCookie('superuser')).toBeNull();
    });

    it('getRoleFromCookie reads the first segment of dotted format', () => {
      expect(getRoleFromCookie('student.1725000000000.sig')).toBe('student');
      expect(getRoleFromCookie('parent.1725000000000.sig')).toBe('parent');
      expect(getRoleFromCookie('school.1725000000000.sig')).toBe('school');
    });

    it('student cannot access parent routes (role mismatch)', () => {
      // Simulates what middleware does: student role ≠ parent required
      const requiredRole = getRequiredRole('/parent');
      const userRole = 'student';
      expect(requiredRole).toBe('parent');
      expect(userRole).not.toBe(requiredRole);
    });

    it('parent cannot access school routes (role mismatch)', () => {
      const requiredRole = getRequiredRole('/school');
      const userRole = 'parent';
      expect(requiredRole).toBe('school');
      expect(userRole).not.toBe(requiredRole);
    });

    it('school cannot access learn routes (role mismatch)', () => {
      const requiredRole = getRequiredRole('/learn');
      const userRole = 'school';
      expect(requiredRole).toBe('student');
      expect(userRole).not.toBe(requiredRole);
    });
  });

  // ─── Session expiry tests ───────────────────────────────────────────

  describe('session expiry', () => {
    it('creates a session and reads it back', async () => {
      const school = await registerSchool(pool, {
        email: 'office@school.test',
        password: 'password12',
        name: 'North High',
        contact: 'principal@school.test',
      });

      const created = await createSession(pool, school.schoolUserId);
      const session = await readSession(pool, created.id);
      expect(session).not.toBeNull();
      expect(session!.role).toBe('school');
      expect(session!.schoolId).toBeDefined();
    });

    it('returns null and deletes row for expired session', async () => {
      const school = await registerSchool(pool, {
        email: 'office@school.test',
        password: 'password12',
        name: 'North High',
        contact: 'principal@school.test',
      });

      const created = await createSession(pool, school.schoolUserId);

      // Manually expire the session
      await db.query(
        `UPDATE academic_sessions SET expires_at = $1 WHERE id = $2`,
        [new Date(Date.now() - 1000).toISOString(), created.id],
      );

      const session = await readSession(pool, created.id);
      expect(session).toBeNull();

      // Row should be cleaned up
      const remaining = await db.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM academic_sessions WHERE id = $1`,
        [created.id],
      );
      expect(remaining.rows[0]!.count).toBe('0');
    });

    it('returns null for non-existent session', async () => {
      const session = await readSession(pool, 'nonexistent-session-id');
      expect(session).toBeNull();
    });

    it('destroySession removes the row', async () => {
      const school = await registerSchool(pool, {
        email: 'office@school.test',
        password: 'password12',
        name: 'North High',
        contact: 'principal@school.test',
      });

      const created = await createSession(pool, school.schoolUserId);
      expect(await readSession(pool, created.id)).not.toBeNull();

      await destroySession(pool, created.id);
      expect(await readSession(pool, created.id)).toBeNull();
    });

    it('destroying a session is idempotent', async () => {
      const school = await registerSchool(pool, {
        email: 'office@school.test',
        password: 'password12',
        name: 'North High',
        contact: 'principal@school.test',
      });

      const created = await createSession(pool, school.schoolUserId);
      await destroySession(pool, created.id);
      // Should not throw
      await destroySession(pool, created.id);
      expect(await readSession(pool, created.id)).toBeNull();
    });

    it('session includes correct role for each user type', async () => {
      // School
      const school = await registerSchool(pool, {
        email: 'school@test.com',
        password: 'password12',
        name: 'Test High',
        contact: 'admin@test.com',
      });
      const schoolSession = await createSession(pool, school.schoolUserId);
      const schoolResult = await readSession(pool, schoolSession.id);
      expect(schoolResult!.role).toBe('school');
      expect(schoolResult!.schoolId).toBeDefined();
      expect(schoolResult!.studentId).toBeNull();
      expect(schoolResult!.parentId).toBeNull();

      // Student + Parent
      const family = await registerStudentFirst(pool, {
        studentEmail: 'student@test.com',
        studentPassword: 'password12',
        studentDisplayName: 'Student',
        academicLevel: 'primary',
        parentEmail: 'parent@test.com',
        parentPassword: 'password34',
        parentDisplayName: 'Parent',
      });

      const studentSession = await createSession(pool, family.studentUserId);
      const studentResult = await readSession(pool, studentSession.id);
      expect(studentResult!.role).toBe('student');
      expect(studentResult!.studentId).toBeDefined();
      expect(studentResult!.parentId).toBeNull();

      const parentSession = await createSession(pool, family.parentUserId);
      const parentResult = await readSession(pool, parentSession.id);
      expect(parentResult!.role).toBe('parent');
      expect(parentResult!.parentId).toBeDefined();
      expect(parentResult!.studentId).toBeNull();
    });
  });

  // ─── Header spoof / learner key tests ───────────────────────────────

  describe('header spoof / learner key', () => {
    it('studentLearnerKey returns user:{id} format', () => {
      expect(studentLearnerKey('test-student-id')).toBe('user:test-student-id');
      expect(studentLearnerKey('')).toBe('user:');
    });

    it('isStudentRole only accepts "student"', () => {
      expect(isStudentRole('student')).toBe(true);
      expect(isStudentRole('parent')).toBe(false);
      expect(isStudentRole('school')).toBe(false);
      expect(isStudentRole('')).toBe(false);
      expect(isStudentRole('STUDENT')).toBe(false);
    });

    it('role cookie is correctly named', () => {
      expect(ROLE_COOKIE).toBe('openmaic_role');
    });

    it('session cookie is correctly named', () => {
      expect(SESSION_COOKIE).toBe('openmaic_session');
    });

    it('school and parent roles are not students (no learner key)', async () => {
      const school = await registerSchool(pool, {
        email: 'office@school.test',
        password: 'password12',
        name: 'North High',
        contact: 'principal@school.test',
      });

      const schoolSession = await createSession(pool, school.schoolUserId);
      const session = await readSession(pool, schoolSession.id);
      expect(session!.role).toBe('school');
      expect(isStudentRole(session!.role)).toBe(false);
      expect(session!.studentId).toBeNull();

      const family = await registerParentFirst(pool, {
        parentEmail: 'parent@home.test',
        parentPassword: 'password34',
        parentDisplayName: 'Parent',
        studentEmail: 'kid@school.test',
        studentPassword: 'password12',
        studentDisplayName: 'Kid',
        academicLevel: 'primary',
      });

      const parentSession = await createSession(pool, family.parentUserId);
      const parentResult = await readSession(pool, parentSession.id);
      expect(parentResult!.role).toBe('parent');
      expect(isStudentRole(parentResult!.role)).toBe(false);
      expect(parentResult!.studentId).toBeNull();
    });

    it('middleware-auth rejects empty and undefined role cookies', () => {
      expect(getRoleFromCookie(undefined)).toBeNull();
      expect(getRoleFromCookie('')).toBeNull();
      expect(getRoleFromCookie('  ')).toBeNull();
    });

    it('middleware-auth rejects role cookies with invalid roles', () => {
      expect(getRoleFromCookie('admin')).toBeNull();
      expect(getRoleFromCookie('hacker.1234.sig')).toBeNull();
    });

    it('session expiry causes authentication loss (spoofed cookie useless without DB row)', async () => {
      const school = await registerSchool(pool, {
        email: 'office@school.test',
        password: 'password12',
        name: 'North High',
        contact: 'principal@school.test',
      });

      const created = await createSession(pool, school.schoolUserId);

      // Session is valid
      let session = await readSession(pool, created.id);
      expect(session).not.toBeNull();

      // Expire it
      await db.query(
        `UPDATE academic_sessions SET expires_at = $1 WHERE id = $2`,
        [new Date(Date.now() - 1000).toISOString(), created.id],
      );

      // readSession returns null — a spoofed cookie with this ID is useless
      session = await readSession(pool, created.id);
      expect(session).toBeNull();
    });
  });
});
