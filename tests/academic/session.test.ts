import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registerSchool } from '@/lib/academic/register';
import { ensureAcademicSchema } from '@/lib/academic/schema';
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSession,
  destroySession,
  readSession,
  sessionCookieOptions,
} from '@/lib/academic/session';

class PGlitePool {
  constructor(readonly db: PGlite) {}

  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }

  async end() {
    await this.db.close();
  }
}

describe('academic sessions', () => {
  let db: PGlite;
  let pool: PGlitePool;
  let userId: string;

  beforeEach(async () => {
    db = new PGlite();
    pool = new PGlitePool(db);
    await ensureAcademicSchema(pool);
    const school = await registerSchool(pool, {
      email: 'office@school.test',
      password: 'password12',
      name: 'North High',
      contact: 'principal@school.test',
    });
    userId = school.schoolUserId;
  });

  afterEach(async () => {
    await pool.end();
  });

  it('creates a session that can be read back with role and school id', async () => {
    const created = await createSession(pool, userId);
    const session = await readSession(pool, created.id);
    expect(session).toMatchObject({
      sessionId: created.id,
      userId,
      role: 'school',
      studentId: null,
      parentId: null,
    });
    expect(session?.schoolId).toEqual(expect.any(String));
    expect(session?.expiresAt.getTime()).toBe(created.expiresAt.getTime());
  });

  it('returns null for an expired session and deletes the row', async () => {
    const created = await createSession(pool, userId);
    await db.query(`UPDATE academic_sessions SET expires_at = $1 WHERE id = $2`, [
      new Date(Date.now() - 1000).toISOString(),
      created.id,
    ]);
    await expect(readSession(pool, created.id)).resolves.toBeNull();
    const remaining = await db.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM academic_sessions WHERE id = $1',
      [created.id],
    );
    expect(remaining.rows[0]?.count).toBe('0');
  });

  it('destroySession removes the row', async () => {
    const created = await createSession(pool, userId);
    await destroySession(pool, created.id);
    await expect(readSession(pool, created.id)).resolves.toBeNull();
  });

  it('returns null for a missing session id', async () => {
    await expect(readSession(pool, 'missing')).resolves.toBeNull();
  });

  it('cookie options are httpOnly and use the session cookie name', () => {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    expect(SESSION_COOKIE).toBe('openmaic_session');
    expect(sessionCookieOptions(expiresAt)).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  });
});
