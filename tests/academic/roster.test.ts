import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addRosterEntry, deleteRosterEntry, listRoster } from '@/lib/academic/roster';
import { registerSchool } from '@/lib/academic/register';
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

describe('academic roster', () => {
  let db: PGlite;
  let pool: PGlitePool;
  let schoolId: string;

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
    schoolId = school.schoolId;
  });

  afterEach(async () => {
    await pool.end();
  });

  it('lists an empty roster for a new school', async () => {
    expect(await listRoster(pool, schoolId)).toEqual([]);
  });

  it('adds and lists a roster entry', async () => {
    const added = await addRosterEntry(pool, schoolId, 'Ada Lovelace', '10th Grade');
    const list = await listRoster(pool, schoolId);
    expect(list).toEqual([
      { id: added.id, studentName: 'Ada Lovelace', grade: '10th Grade' },
    ]);
  });

  it('adds multiple entries and lists them in name order', async () => {
    await addRosterEntry(pool, schoolId, 'Zoe Zulu', '9th Grade');
    await addRosterEntry(pool, schoolId, 'Ada Lovelace', '10th Grade');
    const list = await listRoster(pool, schoolId);
    expect(list.map((r) => r.studentName)).toEqual(['Ada Lovelace', 'Zoe Zulu']);
  });

  it('deletes an existing entry and returns true', async () => {
    const added = await addRosterEntry(pool, schoolId, 'Ada Lovelace', '10th Grade');
    expect(await deleteRosterEntry(pool, schoolId, added.id)).toBe(true);
    expect(await listRoster(pool, schoolId)).toEqual([]);
  });

  it('returns false when deleting an unknown entry id', async () => {
    expect(
      await deleteRosterEntry(pool, schoolId, '00000000-0000-0000-0000-000000000000'),
    ).toBe(false);
  });

  it('returns false when deleting another school\'s entry id', async () => {
    const other = await registerSchool(pool, {
      email: 'other@school.test',
      password: 'password12',
      name: 'Other High',
      contact: 'other@school.test',
    });
    const added = await addRosterEntry(pool, other.schoolId, 'Ada Lovelace', '10th Grade');
    expect(await deleteRosterEntry(pool, schoolId, added.id)).toBe(false);
    expect(await listRoster(pool, other.schoolId)).toEqual([
      { id: added.id, studentName: 'Ada Lovelace', grade: '10th Grade' },
    ]);
  });
});
