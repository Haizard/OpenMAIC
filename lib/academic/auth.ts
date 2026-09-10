import { cookies } from 'next/headers';

import { readSession, SESSION_COOKIE, type AcademicSession } from '@/lib/academic/session';
import { getAcademicDb } from '@/lib/academic/db';

/**
 * Read the current academic session from cookies.
 * Returns null if no valid session exists.
 */
export async function getCurrentSession(): Promise<AcademicSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  if (!sessionCookie?.value) return null;

  const db = getAcademicDb();
  return readSession(db, sessionCookie.value);
}

/**
 * Require a valid session. Throws if not authenticated.
 */
export async function requireSession(): Promise<AcademicSession> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  return session;
}

/**
 * Require a session with a specific role. Throws if not authenticated or wrong role.
 */
export async function requireRole(role: 'student' | 'parent' | 'school'): Promise<AcademicSession> {
  const session = await requireSession();
  if (session.role !== role) {
    throw new Error('Forbidden');
  }
  return session;
}
