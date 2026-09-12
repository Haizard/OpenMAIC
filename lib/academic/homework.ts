import type { AcademicDb } from '@/lib/academic/register';
import type { AssignmentStatus } from '@/lib/academic/assignment';

/**
 * Homework — Slice 3.
 *
 * Homework is work that was **set for** the student, as opposed to an assignment they started
 * themselves. It lives in `academic_assignments` with `kind = 'homework'` and shares the one
 * submission lifecycle. See docs/superpowers/specs/2026-09-12-academic-hub-slice-3-homework.md.
 *
 * v1 has no teacher role, so the platform sets the work: one homework item per topic in the
 * student's own curriculum form. The student did not choose it and cannot delete it.
 */

/** How long a freshly materialised homework item is given. */
export const HOMEWORK_DUE_DAYS = 7;
/** A pending item due within this window counts as "due soon". */
export const DUE_SOON_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type HomeworkBucket = 'overdue' | 'due_soon' | 'later';

export interface HomeworkItem {
  id: string;
  title: string;
  description: string;
  topicId: string | null;
  topicName: string | null;
  subjectName: string | null;
  status: AssignmentStatus;
  dueAt: Date | null;
  submittedAt: Date | null;
  bucket: HomeworkBucket;
}

export interface HomeworkCounts {
  overdue: number;
  dueSoon: number;
  later: number;
}

export interface StudentHomework {
  overdue: HomeworkItem[];
  dueSoon: HomeworkItem[];
  later: HomeworkItem[];
  counts: HomeworkCounts;
  total: number;
  /** `no_form` when homework could not be materialised because no grade is stored. */
  reason: 'no_form' | null;
}

export interface ChildHomework extends StudentHomework {
  studentId: string;
  studentName: string;
}

/** Which bucket a due date falls into, relative to `now`. */
export function bucketFor(dueAt: Date | null, now: Date = new Date()): HomeworkBucket {
  if (!dueAt) return 'later';
  const remaining = dueAt.getTime() - now.getTime();
  if (remaining < 0) return 'overdue';
  if (remaining <= DUE_SOON_DAYS * DAY_MS) return 'due_soon';
  return 'later';
}

function emptyBuckets(): StudentHomework {
  return {
    overdue: [],
    dueSoon: [],
    later: [],
    counts: { overdue: 0, dueSoon: 0, later: 0 },
    total: 0,
    reason: null,
  };
}

function bucketItems(items: HomeworkItem[], now: Date): StudentHomework {
  const result = emptyBuckets();
  for (const item of items) {
    const bucket = bucketFor(item.dueAt, now);
    const withBucket = { ...item, bucket };
    if (bucket === 'overdue') result.overdue.push(withBucket);
    else if (bucket === 'due_soon') result.dueSoon.push(withBucket);
    else result.later.push(withBucket);
  }
  result.counts = {
    overdue: result.overdue.length,
    dueSoon: result.dueSoon.length,
    later: result.later.length,
  };
  result.total = items.length;
  return result;
}

/**
 * Create this student's homework from their curriculum form.
 *
 * Idempotent: a partial unique index on `(student_id, topic_id) WHERE kind = 'homework'`
 * means re-running adds nothing. Returns the number of rows actually inserted.
 *
 * A student with no stored form yields zero rows rather than an error — see
 * `listHomeworkForStudent`, which reports that as `reason: 'no_form'`.
 */
export async function materializeHomework(
  db: AcademicDb,
  studentId: string,
  now: Date = new Date(),
): Promise<number> {
  const dueAt = new Date(now.getTime() + HOMEWORK_DUE_DAYS * DAY_MS);

  const result = await db.query<{ id: string }>(
    `INSERT INTO academic_assignments
       (id, student_id, topic_id, title, description, status, due_at, kind, assigned_by)
     SELECT gen_random_uuid()::text,
            a.id,
            t.id,
            t.name,
            COALESCE(t.description, ''),
            'pending',
            $2::timestamptz,
            'homework',
            'platform'
     FROM academic_students a
     JOIN curriculum_subjects sub ON sub.form_id = a.curriculum_form_id
     JOIN curriculum_topics t ON t.subject_id = sub.id
     WHERE a.id = $1
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [studentId, dueAt],
  );

  return result.rows.length;
}

/** Whether the student has a curriculum form, which homework depends on. */
export async function studentHasForm(db: AcademicDb, studentId: string): Promise<boolean> {
  const result = await db.query<{ curriculum_form_id: string | null }>(
    'SELECT curriculum_form_id FROM academic_students WHERE id = $1',
    [studentId],
  );
  return Boolean(result.rows[0]?.curriculum_form_id);
}

/** The signed-in student's homework, materialised on demand and bucketed by urgency. */
export async function listHomeworkForStudent(
  db: AcademicDb,
  studentId: string,
  now: Date = new Date(),
): Promise<StudentHomework> {
  if (!(await studentHasForm(db, studentId))) {
    return { ...emptyBuckets(), reason: 'no_form' };
  }

  await materializeHomework(db, studentId, now);

  const result = await db.query<RawHomework>(
    `SELECT h.id, h.title, h.description, h.topic_id, h.status, h.due_at, h.submitted_at,
            t.name AS topic_name, sub.name AS subject_name
     FROM academic_assignments h
     LEFT JOIN curriculum_topics t ON t.id = h.topic_id
     LEFT JOIN curriculum_subjects sub ON sub.id = t.subject_id
     WHERE h.student_id = $1 AND h.kind = 'homework'
     ORDER BY h.due_at NULLS LAST, h.title`,
    [studentId],
  );

  return bucketItems(result.rows.map(mapHomeworkItem), now);
}

/**
 * Pending homework for a parent's own children, bucketed the same way.
 *
 * Only `pending` work is returned — this view answers "what does my child still owe?".
 * Submitted and late work is excluded; the parent has the Slice 1 assignment list for history.
 * Children with nothing pending are omitted entirely.
 */
export async function listPendingHomeworkForParent(
  db: AcademicDb,
  parentId: string,
  now: Date = new Date(),
): Promise<ChildHomework[]> {
  const result = await db.query<RawHomeworkWithStudent>(
    `SELECT h.id, h.title, h.description, h.topic_id, h.status, h.due_at, h.submitted_at,
            t.name AS topic_name, sub.name AS subject_name,
            s.id AS student_id, s.display_name AS student_name
     FROM academic_assignments h
     JOIN academic_students s ON s.id = h.student_id
     LEFT JOIN curriculum_topics t ON t.id = h.topic_id
     LEFT JOIN curriculum_subjects sub ON sub.id = t.subject_id
     WHERE s.parent_id = $1 AND h.kind = 'homework' AND h.status = 'pending'
     ORDER BY s.display_name, h.due_at NULLS LAST, h.title`,
    [parentId],
  );

  const byStudent = new Map<string, { studentName: string; items: HomeworkItem[] }>();
  for (const row of result.rows) {
    const entry = byStudent.get(row.student_id) ?? {
      studentName: row.student_name,
      items: [],
    };
    entry.items.push(mapHomeworkItem(row));
    byStudent.set(row.student_id, entry);
  }

  return [...byStudent.entries()].map(([studentId, entry]) => ({
    ...bucketItems(entry.items, now),
    studentId,
    studentName: entry.studentName,
  }));
}

// ─── Mappers ───────────────────────────────────────────────────────────

interface RawHomework {
  id: string;
  title: string;
  description: string;
  topic_id: string | null;
  status: string;
  due_at: Date | string | null;
  submitted_at: Date | string | null;
  topic_name: string | null;
  subject_name: string | null;
}

interface RawHomeworkWithStudent extends RawHomework {
  student_id: string;
  student_name: string;
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function mapHomeworkItem(row: RawHomework): HomeworkItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    topicId: row.topic_id,
    topicName: row.topic_name,
    subjectName: row.subject_name,
    status: row.status as AssignmentStatus,
    dueAt: row.due_at ? toDate(row.due_at) : null,
    submittedAt: row.submitted_at ? toDate(row.submitted_at) : null,
    bucket: 'later',
  };
}
