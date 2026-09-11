import { randomUUID } from 'node:crypto';

import { hashPassword } from '@/lib/academic/password';
import { isAcademicLevel, type AcademicLevel } from '@/lib/academic/types';

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

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (code === '23505') return true;
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate key|unique constraint|already exists/i.test(message);
}

async function withTransaction<T>(
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
        `INSERT INTO academic_students (id, user_id, parent_id, academic_level, display_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), studentUserId, parentId, academicLevel, studentName],
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

  try {
    return await withTransaction(db, async (query) => {
      const parent = await query(`SELECT id FROM academic_parents WHERE id = $1`, [input.parentId]);
      if (parent.rows.length === 0) throw new ValidationError('Parent not found');
      const studentUserId = await insertUser(query, 'student', studentEmail, studentPassword);
      await query(
        `INSERT INTO academic_students (id, user_id, parent_id, academic_level, display_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), studentUserId, input.parentId, academicLevel, studentName],
      );
      return { studentUserId };
    });
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    wrapUnique(error, studentEmail);
  }
}
