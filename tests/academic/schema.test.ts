import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureAcademicSchema } from '@/lib/academic/schema';

class PGlitePool {
  constructor(readonly db: PGlite) {}

  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }

  async end() {
    await this.db.close();
  }
}

describe('ensureAcademicSchema', () => {
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

  it('is idempotent', async () => {
    await expect(ensureAcademicSchema(pool)).resolves.toBeUndefined();
  });

  it('rejects a student row without a parent', async () => {
    await db.query(
      `INSERT INTO academic_users (id, email, password_hash, role)
       VALUES ('u1', 'a@b.c', 'hash', 'student')`,
    );
    await expect(
      db.query(
        `INSERT INTO academic_students (id, user_id, parent_id, academic_level, display_name)
         VALUES ('s1', 'u1', 'missing-parent', 'primary', 'Ada')`,
      ),
    ).rejects.toThrow();
  });

  it('creates all academic tables', async () => {
    const result = await db.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename LIKE 'academic_%'
        ORDER BY tablename`,
    );
    expect(result.rows.map((row) => row.tablename)).toEqual([
      'academic_parents',
      'academic_school_roster',
      'academic_schools',
      'academic_sessions',
      'academic_students',
      'academic_users',
    ]);
  });
});
