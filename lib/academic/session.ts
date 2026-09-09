import { randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';
import type { UserRole } from '@/lib/academic/types';
import { isUserRole } from '@/lib/academic/types';

export const SESSION_COOKIE = 'openmaic_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export interface AcademicSession {
  sessionId: string;
  userId: string;
  role: UserRole;
  expiresAt: Date;
  studentId: string | null;
  parentId: string | null;
  schoolId: string | null;
}

interface SessionRow {
  session_id: string;
  user_id: string;
  role: string;
  expires_at: Date | string;
  student_id: string | null;
  parent_id: string | null;
  school_id: string | null;
}

export async function createSession(
  db: AcademicDb,
  userId: string,
): Promise<{ id: string; expiresAt: Date }> {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.query(
    `INSERT INTO academic_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
    [id, userId, expiresAt.toISOString()],
  );
  return { id, expiresAt };
}

export async function readSession(db: AcademicDb, sessionId: string): Promise<AcademicSession | null> {
  const result = await db.query(
    `SELECT
       s.id AS session_id,
       s.user_id,
       s.expires_at,
       u.role,
       st.id AS student_id,
       p.id AS parent_id,
       sc.id AS school_id
     FROM academic_sessions s
     JOIN academic_users u ON u.id = s.user_id
     LEFT JOIN academic_students st ON st.user_id = u.id
     LEFT JOIN academic_parents p ON p.user_id = u.id
     LEFT JOIN academic_schools sc ON sc.user_id = u.id
     WHERE s.id = $1`,
    [sessionId],
  );
  const row = result.rows[0] as SessionRow | undefined;
  if (!row) return null;
  const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    await destroySession(db, sessionId);
    return null;
  }
  if (!isUserRole(row.role)) return null;
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    role: row.role,
    expiresAt,
    studentId: row.student_id,
    parentId: row.parent_id,
    schoolId: row.school_id,
  };
}

export async function destroySession(db: AcademicDb, sessionId: string): Promise<void> {
  await db.query(`DELETE FROM academic_sessions WHERE id = $1`, [sessionId]);
}

export function sessionCookieOptions(expiresAt: Date): {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  expires: Date;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    secure: process.env.NODE_ENV === 'production',
  };
}
