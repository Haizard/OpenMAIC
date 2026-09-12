import { randomUUID } from 'node:crypto';

import { hashPassword } from '@/lib/academic/password';
import {
  isAcademicLevel,
  resolveCurriculumLevelId,
  type AcademicLevel,
} from '@/lib/academic/types';

export interface AcademicDb {
  query: <TRow = unknown>(text: string, params?: unknown[]) => Promise<{ rows: TRow[] }>;
  connect?: () => Promise<{
    query: <TRow = unknown>(text: string, params?: unknown[]) => Promise<{ rows: TRow[] }>;
    release: () => void;
  }>;
}

export interface StudentFirstInput {
  studentEmail: string;
  studentPassword: string;
  studentDisplayName: string;
  academicLevel: AcademicLevel;
  /** Curriculum form slug, e.g. `standard-5` or `form-3`. Optional for backward compatibility. */
  formLevel?: string;
  parentEmail: string;
  parentPassword: string;
  parentDisplayName: string;
}

export interface ParentFirstInput {
  parentEmail: string;
  parentPassword: string;
  parentDisplayName: string;
  studentEmail: string;
  studentPassword: string;
  studentDisplayName: string;
  academicLevel: AcademicLevel;
  /** Curriculum form slug, e.g. `standard-5` or `form-3`. Optional for backward compatibility. */
  formLevel?: string;
}

export interface SchoolRegisterInput {
  email: string;
  password: string;
  name: string;
  contact: string;
}

export interface AddChildInput {
  parentId: string;
  studentEmail: string;
  studentPassword: string;
  studentDisplayName: string;
  academicLevel: AcademicLevel;
  /** Curriculum form slug, e.g. `standard-5` or `form-3`. Optional for backward compatibility. */
  formLevel?: string;
}

export class DuplicateEmailError extends Error {
  readonly email: string;
  constructor(email: string) {
    super(`Email already registered: ${email}`);
    this.name = 'DuplicateEmailError';
    this.email = email;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireName(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed === '') throw new ValidationError(`${field} is required`);
  return trimmed;
}

function requirePassword(value: string, field: string): string {
  if (value.length < 8) throw new ValidationError(`${field} must be at least 8 characters`);
  return value;
}

function requireLevel(value: string): AcademicLevel {
  if (!isAcademicLevel(value)) throw new ValidationError('Invalid academic level');
  return value;
}

/**
 * Resolve a curriculum form slug (e.g. `standard-5`, `form-3`) to its row id, checking that
 * the form actually belongs to the student's chosen level.
 *
 * Returns null when no form was supplied. That is not an error: students registered before
 * grades were stored still exist, and they fall back to level-wide content scoping.
 */
async function resolveFormId(
  db: AcademicDb,
  formLevel: string | undefined,
  academicLevel: AcademicLevel,
): Promise<string | null> {
  const slug = formLevel?.trim();
  if (!slug) return null;

  const result = await db.query<{ id: string; level_id: string }>(
    'SELECT id, level_id FROM curriculum_forms WHERE slug = $1',
    [slug],
  );
  const form = result.rows[0];
  if (!form) throw new ValidationError(`Unknown form: ${slug}`);

  const expectedLevel = resolveCurriculumLevelId(academicLevel);
  if (form.level_id !== expectedLevel) {
    throw new ValidationError(`Form ${slug} does not belong to level ${academicLevel}`);
  }
  return form.id;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (code === '23505') return true;
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate key|unique constraint|already exists/i.test(message);
}

export async function withTransaction<T>(
  db: AcademicDb,
  work: (query: AcademicDb['query']) => Promise<T>,
): Promise<T> {
  if (db.connect) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client.query.bind(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  try {
    await db.query('BEGIN');
    const result = await work(db.query.bind(db));
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function insertUser(
  query: AcademicDb['query'],
  role: 'student' | 'parent' | 'school',
  email: string,
  password: string,
): Promise<string> {
  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  await query(
    `INSERT INTO academic_users (id, email, password_hash, role)
     VALUES ($1, $2, $3, $4)`,
    [id, email, passwordHash, role],
  );
  return id;
}

function wrapUnique(error: unknown, email: string): never {
  if (isUniqueViolation(error)) throw new DuplicateEmailError(email);
  throw error;
}

export async function registerStudentFirst(
  db: AcademicDb,
  input: StudentFirstInput,
): Promise<{ studentUserId: string; parentUserId: string }> {
  const studentEmail = normalizeEmail(input.studentEmail);
  const parentEmail = normalizeEmail(input.parentEmail);
  const studentName = requireName(input.studentDisplayName, 'Student name');
  const parentName = requireName(input.parentDisplayName, 'Parent name');
  const studentPassword = requirePassword(input.studentPassword, 'Student password');
  const parentPassword = requirePassword(input.parentPassword, 'Parent password');
  const academicLevel = requireLevel(input.academicLevel);
  if (studentEmail === parentEmail) throw new ValidationError('Student and parent emails must differ');
  if (!studentEmail.includes('@') || !parentEmail.includes('@')) {
    throw new ValidationError('Valid emails are required');
  }

  // Resolve the grade before opening a transaction, so a bad form fails fast with no writes.
  const curriculumFormId = await resolveFormId(db, input.formLevel, academicLevel);

  try {
    return await withTransaction(db, async (query) => {
      const parentUserId = await insertUser(query, 'parent', parentEmail, parentPassword);
      const parentId = randomUUID();
      await query(
        `INSERT INTO academic_parents (id, user_id, display_name) VALUES ($1, $2, $3)`,
        [parentId, parentUserId, parentName],
      );
      const studentUserId = await insertUser(query, 'student', studentEmail, studentPassword);
      await query(
        `INSERT INTO academic_students
           (id, user_id, parent_id, academic_level, display_name, curriculum_form_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), studentUserId, parentId, academicLevel, studentName, curriculumFormId],
      );
      return { studentUserId, parentUserId };
    });
  } catch (error) {
    wrapUnique(error, studentEmail);
  }
}

export async function registerParentFirst(
  db: AcademicDb,
  input: ParentFirstInput,
): Promise<{ studentUserId: string; parentUserId: string }> {
  return registerStudentFirst(db, input);
}

export async function registerSchool(
  db: AcademicDb,
  input: SchoolRegisterInput,
): Promise<{ schoolUserId: string; schoolId: string }> {
  const email = normalizeEmail(input.email);
  const name = requireName(input.name, 'School name');
  const contact = requireName(input.contact, 'Contact');
  const password = requirePassword(input.password, 'Password');
  if (!email.includes('@')) throw new ValidationError('Valid email is required');

  try {
    return await withTransaction(db, async (query) => {
      const schoolUserId = await insertUser(query, 'school', email, password);
      const schoolId = randomUUID();
      await query(
        `INSERT INTO academic_schools (id, user_id, name, contact) VALUES ($1, $2, $3, $4)`,
        [schoolId, schoolUserId, name, contact],
      );
      return { schoolUserId, schoolId };
    });
  } catch (error) {
    wrapUnique(error, email);
  }
}

export async function addChild(
  db: AcademicDb,
  input: AddChildInput,
): Promise<{ studentUserId: string }> {
  const studentEmail = normalizeEmail(input.studentEmail);
  const studentName = requireName(input.studentDisplayName, 'Student name');
  const studentPassword = requirePassword(input.studentPassword, 'Student password');
  const academicLevel = requireLevel(input.academicLevel);
  if (!studentEmail.includes('@')) throw new ValidationError('Valid email is required');
  if (input.parentId.trim() === '') throw new ValidationError('Parent is required');

  const curriculumFormId = await resolveFormId(db, input.formLevel, academicLevel);

  try {
    return await withTransaction(db, async (query) => {
      const parent = await query(`SELECT id FROM academic_parents WHERE id = $1`, [input.parentId]);
      if (parent.rows.length === 0) throw new ValidationError('Parent not found');
      const studentUserId = await insertUser(query, 'student', studentEmail, studentPassword);
      await query(
        `INSERT INTO academic_students
           (id, user_id, parent_id, academic_level, display_name, curriculum_form_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(),
          studentUserId,
          input.parentId,
          academicLevel,
          studentName,
          curriculumFormId,
        ],
      );
      return { studentUserId };
    });
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    wrapUnique(error, studentEmail);
  }
}
