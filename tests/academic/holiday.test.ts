import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registerStudentFirst } from '@/lib/academic/register';
import { ensureAcademicSchema } from '@/lib/academic/schema';
import { ensureCurriculumSchema } from '@/lib/academic/curriculum-schema';
import { seedCurriculum } from '@/lib/academic/curriculum-seed';
import { ensureAssignmentSchema } from '@/lib/academic/assignment-schema';
import { ensureHolidaySchema } from '@/lib/academic/holiday-schema';
import { materializeHomework } from '@/lib/academic/homework';
import { submitAssignment } from '@/lib/academic/assignment';
import { HOLIDAY_PACKAGES, isWindowOpen, activeWindow } from '@/lib/academic/holiday-catalogue';
import {
  listHolidayPackagesForParent,
  listHolidayPackagesForStudent,
  materializeHolidayPackages,
} from '@/lib/academic/holiday';
import {
  getRecordingForViewer,
  listRecordingsForAssignments,
  MAX_RECORDING_BYTES,
  saveRecording,
} from '@/lib/academic/recording';

class PGlitePool {
  constructor(readonly db: PGlite) {}
  query<TRow>(text: string, params?: unknown[]) {
    return this.db.query<TRow>(text, params);
  }
}

/** Inside the June break, which is the only window open on this date. */
const IN_JUNE = new Date('2026-06-15T09:00:00Z');

interface Family {
  pool: PGlitePool;
  studentId: string;
  parentId: string;
}

async function makePool(): Promise<PGlitePool> {
  const pool = new PGlitePool(new PGlite());
  await ensureAcademicSchema(pool);
  await ensureCurriculumSchema(pool);
  await ensureAssignmentSchema(pool);
  await seedCurriculum(pool);
  await ensureHolidaySchema(pool);
  return pool;
}

async function createFamily(pool: PGlitePool, suffix: string): Promise<Omit<Family, 'pool'>> {
  const result = await registerStudentFirst(pool, {
    studentEmail: `student-${suffix}@test.dev`,
    studentPassword: 'password12',
    studentDisplayName: `Student ${suffix}`,
    academicLevel: 'primary',
    formLevel: 'standard-5',
    parentEmail: `parent-${suffix}@test.dev`,
    parentPassword: 'password12',
    parentDisplayName: `Parent ${suffix}`,
  });

  const student = await pool.query<{ id: string }>(
    'SELECT id FROM academic_students WHERE user_id = $1',
    [result.studentUserId],
  );
  const parent = await pool.query<{ id: string }>(
    'SELECT id FROM academic_parents WHERE user_id = $1',
    [result.parentUserId],
  );

  return { studentId: student.rows[0].id, parentId: parent.rows[0].id };
}

/** Homework ids in the same order the package claiming uses. */
async function orderedHomeworkIds(pool: PGlitePool, studentId: string): Promise<string[]> {
  const rows = await pool.query<{ id: string }>(
    `SELECT h.id
     FROM academic_assignments h
     JOIN curriculum_topics t ON t.id = h.topic_id
     JOIN curriculum_subjects sub ON sub.id = t.subject_id
     WHERE h.student_id = $1 AND h.kind = 'homework'
     ORDER BY sub.sort_order, sub.name, t.sort_order, t.name`,
    [studentId],
  );
  return rows.rows.map((row) => row.id);
}

async function countPackages(pool: PGlitePool, studentId: string): Promise<number> {
  const rows = await pool.query<{ cnt: string | number }>(
    'SELECT COUNT(*) AS cnt FROM academic_holiday_packages WHERE student_id = $1',
    [studentId],
  );
  return Number(rows.rows[0].cnt);
}

describe('holiday catalogue windows', () => {
  it('opens only the package whose window covers the date', () => {
    const open = HOLIDAY_PACKAGES.filter((definition) => isWindowOpen(definition, IN_JUNE));
    expect(open.map((definition) => definition.slug)).toEqual(['june-break']);
  });

  it('opens the august package in august and nothing in september', () => {
    const august = new Date('2026-08-10T09:00:00Z');
    const september = new Date('2026-09-10T09:00:00Z');

    expect(
      HOLIDAY_PACKAGES.filter((definition) => isWindowOpen(definition, august)).map(
        (definition) => definition.slug,
      ),
    ).toEqual(['august-break']);

    expect(HOLIDAY_PACKAGES.filter((definition) => isWindowOpen(definition, september))).toEqual(
      [],
    );
  });

  it('keeps the december package open into january of the next year', () => {
    // The window crosses the year boundary; resolving it against the current year alone
    // would close it the moment the calendar turned.
    expect(isWindowOpen(HOLIDAY_PACKAGES[2], new Date('2026-12-20T09:00:00Z'))).toBe(true);
    expect(isWindowOpen(HOLIDAY_PACKAGES[2], new Date('2027-01-03T09:00:00Z'))).toBe(true);
    expect(isWindowOpen(HOLIDAY_PACKAGES[2], new Date('2026-06-15T09:00:00Z'))).toBe(false);
  });

  it('opens in the lead-up days before the window starts', () => {
    expect(isWindowOpen(HOLIDAY_PACKAGES[0], new Date('2026-05-25T09:00:00Z'))).toBe(true);
    expect(isWindowOpen(HOLIDAY_PACKAGES[0], new Date('2026-05-01T09:00:00Z'))).toBe(false);
  });

  it('resolves the december window across the year boundary', () => {
    expect(activeWindow(HOLIDAY_PACKAGES[2], new Date('2027-01-03T09:00:00Z'))).toEqual({
      startsOn: '2026-12-01',
      endsOn: '2027-01-05',
    });
  });
});

describe('holiday package materialisation', () => {
  let pool: PGlitePool;

  beforeEach(async () => {
    pool = await makePool();
  });

  afterEach(async () => {
    await pool.db.close();
  });

  it('creates one package for the open window and is idempotent', async () => {
    const { studentId } = await createFamily(pool, 'idem');

    await materializeHolidayPackages(pool, studentId, IN_JUNE);
    expect(await countPackages(pool, studentId)).toBe(1);

    await materializeHolidayPackages(pool, studentId, IN_JUNE);
    expect(await countPackages(pool, studentId)).toBe(1);
  });

  it('creates nothing when no window is open', async () => {
    const { studentId } = await createFamily(pool, 'closed');
    await materializeHolidayPackages(pool, studentId, new Date('2026-09-10T09:00:00Z'));
    expect(await countPackages(pool, studentId)).toBe(0);
  });

  it('claims the package slice and marks the required recordings', async () => {
    const { studentId } = await createFamily(pool, 'claim');
    const definition = HOLIDAY_PACKAGES[0];

    await materializeHolidayPackages(pool, studentId, IN_JUNE);

    const listed = await listHolidayPackagesForStudent(pool, studentId, IN_JUNE);
    expect(listed.reason).toBeNull();
    expect(listed.packages).toHaveLength(1);

    const pkg = listed.packages[0];
    expect(pkg.slug).toBe('june-break');
    expect(pkg.endsOn).toBe('2026-06-30');

    // The slice is the first topicCount topics of the form.
    const allIds = await orderedHomeworkIds(pool, studentId);
    const expected = allIds.slice(
      definition.topicOffset,
      definition.topicOffset + definition.topicCount,
    );
    expect(pkg.items.map((item) => item.id)).toEqual(expected);

    expect(pkg.recordingsRequired).toBe(definition.recordingCount);
    expect(pkg.recordingsDone).toBe(0);
    expect(pkg.missingItemIds).toEqual(pkg.items.slice(0, definition.recordingCount).map((i) => i.id));
  });

  it('moves the claimed items due date to the end of the break', async () => {
    const { studentId } = await createFamily(pool, 'due');
    await materializeHolidayPackages(pool, studentId, IN_JUNE);

    const listed = await listHolidayPackagesForStudent(pool, studentId, IN_JUNE);
    for (const item of listed.packages[0].items) {
      expect(item.dueAt?.toISOString()).toBe('2026-06-30T23:59:59.000Z');
    }
  });

  it('does not claim an item the student already submitted', async () => {
    const { studentId } = await createFamily(pool, 'submitted');
    await materializeHomework(pool, studentId, IN_JUNE);

    const ids = await orderedHomeworkIds(pool, studentId);
    await submitAssignment(pool, ids[0], studentId, IN_JUNE);

    await materializeHolidayPackages(pool, studentId, IN_JUNE);

    const listed = await listHolidayPackagesForStudent(pool, studentId, IN_JUNE);
    expect(listed.packages[0].items.map((item) => item.id)).not.toContain(ids[0]);
  });

  it('reports no_form for a student with no grade', async () => {
    const result = await registerStudentFirst(pool, {
      studentEmail: 'noform@test.dev',
      studentPassword: 'password12',
      studentDisplayName: 'No Form',
      academicLevel: 'primary',
      parentEmail: 'noform-parent@test.dev',
      parentPassword: 'password12',
      parentDisplayName: 'No Form Parent',
    });
    const student = await pool.query<{ id: string }>(
      'SELECT id FROM academic_students WHERE user_id = $1',
      [result.studentUserId],
    );

    const listed = await listHolidayPackagesForStudent(pool, student.rows[0].id, IN_JUNE);
    expect(listed).toEqual({ packages: [], reason: 'no_form' });
  });
});

describe('package completeness and the recording gate', () => {
  let pool: PGlitePool;
  let studentId: string;

  beforeEach(async () => {
    pool = await makePool();
    ({ studentId } = await createFamily(pool, 'gate'));
    await materializeHolidayPackages(pool, studentId, IN_JUNE);
  });

  afterEach(async () => {
    await pool.db.close();
  });

  it('refuses to submit an item that requires a recording until one exists', async () => {
    const listed = await listHolidayPackagesForStudent(pool, studentId, IN_JUNE);
    const item = listed.packages[0].items.find((entry) => entry.requiresRecording)!;

    await expect(submitAssignment(pool, item.id, studentId, IN_JUNE)).rejects.toThrow(
      /recording/i,
    );

    await saveRecording(pool, {
      assignmentId: item.id,
      studentId,
      mime: 'audio/webm',
      bytes: new Uint8Array([1, 2, 3, 4]),
    });

    const submitted = await submitAssignment(pool, item.id, studentId, IN_JUNE);
    expect(submitted?.status).toBe('submitted');
  });

  it('is incomplete while a required recording is missing and complete once everything is in', async () => {
    let listed = await listHolidayPackagesForStudent(pool, studentId, IN_JUNE);
    let pkg = listed.packages[0];
    expect(pkg.complete).toBe(false);
    expect(pkg.outstanding).toBe(pkg.items.length);

    for (const item of pkg.items) {
      if (item.requiresRecording) {
        await saveRecording(pool, {
          assignmentId: item.id,
          studentId,
          mime: 'audio/webm',
          bytes: new Uint8Array([9, 8, 7]),
        });
      }
      await submitAssignment(pool, item.id, studentId, IN_JUNE);
    }

    listed = await listHolidayPackagesForStudent(pool, studentId, IN_JUNE);
    pkg = listed.packages[0];
    expect(pkg.outstanding).toBe(0);
    expect(pkg.recordingsDone).toBe(pkg.recordingsRequired);
    expect(pkg.missingItemIds).toEqual([]);
    expect(pkg.complete).toBe(true);
  });

  it('counts a recording as done before submission', async () => {
    const listed = await listHolidayPackagesForStudent(pool, studentId, IN_JUNE);
    const item = listed.packages[0].items.find((entry) => entry.requiresRecording)!;

    await saveRecording(pool, {
      assignmentId: item.id,
      studentId,
      mime: 'audio/webm',
      bytes: new Uint8Array([5, 5, 5]),
    });

    const after = await listHolidayPackagesForStudent(pool, studentId, IN_JUNE);
    expect(after.packages[0].recordingsDone).toBe(1);
    expect(after.packages[0].missingItemIds).toEqual([]);
    expect(after.packages[0].complete).toBe(false);
  });

  it('replaces the take on re-record rather than accumulating', async () => {
    const listed = await listHolidayPackagesForStudent(pool, studentId, IN_JUNE);
    const item = listed.packages[0].items.find((entry) => entry.requiresRecording)!;

    await saveRecording(pool, {
      assignmentId: item.id,
      studentId,
      mime: 'audio/webm',
      bytes: new Uint8Array([1, 1, 1]),
    });
    await saveRecording(pool, {
      assignmentId: item.id,
      studentId,
      mime: 'video/webm',
      bytes: new Uint8Array([2, 2, 2, 2]),
    });

    const recordings = await listRecordingsForAssignments(pool, [item.id]);
    expect(recordings.size).toBe(1);
    expect(recordings.get(item.id)!.kind).toBe('video');
    expect(recordings.get(item.id)!.byteLength).toBe(4);
  });
});

describe('recording upload validation', () => {
  let pool: PGlitePool;
  let studentId: string;

  beforeEach(async () => {
    pool = await makePool();
    ({ studentId } = await createFamily(pool, 'upload'));
    await materializeHolidayPackages(pool, studentId, IN_JUNE);
  });

  afterEach(async () => {
    await pool.db.close();
  });

  async function firstRequiredItem(): Promise<string> {
    const listed = await listHolidayPackagesForStudent(pool, studentId, IN_JUNE);
    return listed.packages[0].items.find((entry) => entry.requiresRecording)!.id;
  }

  it('rejects a media type outside the allowlist', async () => {
    const id = await firstRequiredItem();
    await expect(
      saveRecording(pool, {
        assignmentId: id,
        studentId,
        mime: 'application/x-msdownload',
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow(/unsupported/i);
  });

  it('rejects an empty recording', async () => {
    const id = await firstRequiredItem();
    await expect(
      saveRecording(pool, {
        assignmentId: id,
        studentId,
        mime: 'audio/webm',
        bytes: new Uint8Array([]),
      }),
    ).rejects.toThrow(/empty/i);
  });

  it('rejects an upload over the size ceiling', async () => {
    const id = await firstRequiredItem();
    await expect(
      saveRecording(pool, {
        assignmentId: id,
        studentId,
        mime: 'audio/webm',
        bytes: new Uint8Array(MAX_RECORDING_BYTES + 1),
      }),
    ).rejects.toThrow(/too large/i);
  });

  it('refuses to attach a recording to another student item', async () => {
    const { studentId: otherId } = await createFamily(pool, 'other');
    const id = await firstRequiredItem();

    await expect(
      saveRecording(pool, {
        assignmentId: id,
        studentId: otherId,
        mime: 'audio/webm',
        bytes: new Uint8Array([1, 2]),
      }),
    ).rejects.toThrow(/cannot take a recording/i);
  });
});

describe('recording access control', () => {
  let pool: PGlitePool;
  let studentId: string;
  let parentId: string;
  let recordingId: string;

  beforeEach(async () => {
    pool = await makePool();
    ({ studentId, parentId } = await createFamily(pool, 'owner'));
    await materializeHolidayPackages(pool, studentId, IN_JUNE);

    const listed = await listHolidayPackagesForStudent(pool, studentId, IN_JUNE);
    const item = listed.packages[0].items.find((entry) => entry.requiresRecording)!;
    const saved = await saveRecording(pool, {
      assignmentId: item.id,
      studentId,
      mime: 'audio/webm',
      bytes: new Uint8Array([7, 7, 7]),
    });
    recordingId = saved.id;
  });

  afterEach(async () => {
    await pool.db.close();
  });

  it('lets the owning student read their recording', async () => {
    const result = await getRecordingForViewer(pool, recordingId, {
      role: 'student',
      studentId,
    });
    expect(result?.mime).toBe('audio/webm');
    expect([...(result?.bytes ?? [])]).toEqual([7, 7, 7]);
  });

  it('lets the parent of the owner read it', async () => {
    const result = await getRecordingForViewer(pool, recordingId, {
      role: 'parent',
      parentId,
    });
    expect(result).not.toBeNull();
  });

  it('refuses another family parent', async () => {
    const { parentId: otherParent } = await createFamily(pool, 'stranger');
    const result = await getRecordingForViewer(pool, recordingId, {
      role: 'parent',
      parentId: otherParent,
    });
    expect(result).toBeNull();
  });

  it('refuses another student', async () => {
    const { studentId: otherStudent } = await createFamily(pool, 'stranger2');
    const result = await getRecordingForViewer(pool, recordingId, {
      role: 'student',
      studentId: otherStudent,
    });
    expect(result).toBeNull();
  });

  it('returns null for an id that does not exist, indistinguishably from a forbidden one', async () => {
    const { parentId: otherParent } = await createFamily(pool, 'stranger3');
    const missing = await getRecordingForViewer(pool, 'does-not-exist', {
      role: 'parent',
      parentId: otherParent,
    });
    const forbidden = await getRecordingForViewer(pool, recordingId, {
      role: 'parent',
      parentId: otherParent,
    });
    expect(missing).toBeNull();
    expect(forbidden).toBeNull();
  });
});

describe('parent holiday view', () => {
  let pool: PGlitePool;

  beforeEach(async () => {
    pool = await makePool();
  });

  afterEach(async () => {
    await pool.db.close();
  });

  it('shows a parent their own child outstanding package', async () => {
    const { parentId } = await createFamily(pool, 'view');
    const view = await listHolidayPackagesForParent(pool, parentId, IN_JUNE);

    expect(view).toHaveLength(1);
    expect(view[0].studentName).toBe('Student view');
    expect(view[0].packages[0].outstanding).toBeGreaterThan(0);
    expect(view[0].packages[0].missingItemIds.length).toBeGreaterThan(0);
  });

  it('shows another parent nothing', async () => {
    await createFamily(pool, 'view2');
    const { parentId: otherParent } = await createFamily(pool, 'view3');

    const view = await listHolidayPackagesForParent(pool, otherParent, IN_JUNE);
    const mine = view.filter((entry) => entry.studentName === 'Student view2');
    expect(mine).toEqual([]);
  });

  it('omits a package once the child has finished it', async () => {
    const { studentId, parentId } = await createFamily(pool, 'done');
    await materializeHolidayPackages(pool, studentId, IN_JUNE);

    const listed = await listHolidayPackagesForStudent(pool, studentId, IN_JUNE);
    for (const item of listed.packages[0].items) {
      if (item.requiresRecording) {
        await saveRecording(pool, {
          assignmentId: item.id,
          studentId,
          mime: 'audio/webm',
          bytes: new Uint8Array([3, 3]),
        });
      }
      await submitAssignment(pool, item.id, studentId, IN_JUNE);
    }

    const view = await listHolidayPackagesForParent(pool, parentId, IN_JUNE);
    expect(view).toEqual([]);
  });
});
