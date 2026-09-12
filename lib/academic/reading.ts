import { randomUUID } from 'node:crypto';

import type { AcademicDb } from '@/lib/academic/register';
import { resolveCurriculumLevelId } from '@/lib/academic/types';

export { resolveCurriculumLevelId };

// ─── Types ─────────────────────────────────────────────────────────────

export const READING_KINDS = [
  'lesson_note',
  'explainer',
  'reference',
  'past_paper',
  'glossary',
] as const;
export type ReadingKind = (typeof READING_KINDS)[number];

export const READING_SOURCES = ['authored', 'generated', 'imported'] as const;
export type ReadingSource = (typeof READING_SOURCES)[number];

export const READING_STATUSES = ['unread', 'reading', 'read'] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];

export interface Reading {
  id: string;
  topicId: string;
  title: string;
  summary: string;
  body: string;
  kind: ReadingKind;
  source: ReadingSource;
  readingMinutes: number;
  sortOrder: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Library list entry — metadata only, no body. Cheaper to list. */
export interface ReadingListItem {
  id: string;
  topicId: string;
  title: string;
  summary: string;
  kind: ReadingKind;
  readingMinutes: number;
  sortOrder: number;
  topicName: string;
  subjectName: string;
  formName: string;
  status: ReadingStatus;
  lastReadAt: Date | null;
  completedAt: Date | null;
}

/** Single reading opened by a student — includes the body. */
export interface ReadingWithProgress extends Reading {
  topicName: string;
  subjectName: string;
  formName: string;
  status: ReadingStatus;
  lastReadAt: Date | null;
  completedAt: Date | null;
}

export interface ReadingSummary {
  unread: number;
  reading: number;
  read: number;
  total: number;
}

export interface ReadingProgressForStudent {
  studentId: string;
  studentName: string;
  readingId: string;
  title: string;
  kind: ReadingKind;
  topicName: string;
  subjectName: string;
  status: ReadingStatus;
  lastReadAt: Date | null;
  completedAt: Date | null;
}

export interface CreateReadingInput {
  topicId: string;
  title: string;
  summary?: string;
  body?: string;
  kind?: ReadingKind;
  source?: ReadingSource;
  readingMinutes?: number;
  sortOrder?: number;
  published?: boolean;
}

export interface UpdateReadingInput {
  title?: string;
  summary?: string;
  body?: string;
  kind?: ReadingKind;
  source?: ReadingSource;
  readingMinutes?: number;
  sortOrder?: number;
  published?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Resolve the curriculum scope a student may see.
 *
 * `formId` is the student's own grade (Standard 5, Form 3 …) when it is known, in which case
 * content is scoped tightly to that form. `levelId` is the fallback for students registered
 * before grades were stored — they see their whole level rather than nothing.
 */
/**
 * The curriculum scope a student may see.
 *
 * Exported because the guidance engine (Slice 5) answers the same question and must not
 * reimplement it — two copies of this predicate is how a student ends up seeing another
 * level's material.
 */
export async function getStudentScope(
  db: AcademicDb,
  studentId: string,
): Promise<{ formId: string | null; levelId: string } | null> {
  const result = await db.query<{ academic_level: string; curriculum_form_id: string | null }>(
    'SELECT academic_level, curriculum_form_id FROM academic_students WHERE id = $1',
    [studentId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    formId: row.curriculum_form_id,
    levelId: resolveCurriculumLevelId(row.academic_level),
  };
}

/**
 * SQL predicate limiting `curriculum_forms f` to what the student may see.
 * Pass the form id as $formParam and the level id as $levelParam.
 */
export function scopePredicate(formParam: string, levelParam: string): string {
  return `((${formParam}::text IS NOT NULL AND f.id = ${formParam})
           OR (${formParam}::text IS NULL AND f.level_id = ${levelParam}))`;
}

// ─── CRUD ──────────────────────────────────────────────────────────────

export async function createReading(
  db: AcademicDb,
  input: CreateReadingInput,
): Promise<{ id: string }> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO academic_readings
       (id, topic_id, title, summary, body, kind, source, reading_minutes, sort_order, published)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      input.topicId,
      input.title.trim(),
      input.summary?.trim() ?? '',
      input.body ?? '',
      input.kind ?? 'lesson_note',
      input.source ?? 'authored',
      input.readingMinutes ?? 0,
      input.sortOrder ?? 0,
      input.published ?? true,
    ],
  );
  return { id };
}

export async function getReading(db: AcademicDb, readingId: string): Promise<Reading | null> {
  const result = await db.query<RawReading>(
    `${READING_COLUMNS} FROM academic_readings WHERE id = $1`,
    [readingId],
  );
  return result.rows[0] ? mapReading(result.rows[0]) : null;
}

export async function listReadingsForTopic(
  db: AcademicDb,
  topicId: string,
): Promise<Reading[]> {
  const result = await db.query<RawReading>(
    `${READING_COLUMNS} FROM academic_readings
     WHERE topic_id = $1 AND published = TRUE
     ORDER BY sort_order, title`,
    [topicId],
  );
  return result.rows.map(mapReading);
}

export async function updateReading(
  db: AcademicDb,
  readingId: string,
  patch: UpdateReadingInput,
): Promise<Reading | null> {
  const sets: string[] = [];
  const params: unknown[] = [readingId];

  const push = (column: string, value: unknown) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (patch.title !== undefined) push('title', patch.title.trim());
  if (patch.summary !== undefined) push('summary', patch.summary.trim());
  if (patch.body !== undefined) push('body', patch.body);
  if (patch.kind !== undefined) push('kind', patch.kind);
  if (patch.source !== undefined) push('source', patch.source);
  if (patch.readingMinutes !== undefined) push('reading_minutes', patch.readingMinutes);
  if (patch.sortOrder !== undefined) push('sort_order', patch.sortOrder);
  if (patch.published !== undefined) push('published', patch.published);

  if (sets.length === 0) {
    return getReading(db, readingId);
  }

  const result = await db.query<RawReading>(
    `UPDATE academic_readings
     SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $1
     RETURNING id, topic_id, title, summary, body, kind, source,
               reading_minutes, sort_order, published, created_at, updated_at`,
    params,
  );
  return result.rows[0] ? mapReading(result.rows[0]) : null;
}

export async function deleteReading(db: AcademicDb, readingId: string): Promise<boolean> {
  const result = await db.query(
    'DELETE FROM academic_readings WHERE id = $1 RETURNING id',
    [readingId],
  );
  return (result.rows as unknown[]).length > 0;
}

// ─── Student: library scoped to their curriculum level ─────────────────

export async function listReadingsForStudent(
  db: AcademicDb,
  studentId: string,
  options: { topicId?: string } = {},
): Promise<ReadingListItem[]> {
  const scope = await getStudentScope(db, studentId);
  if (!scope) return [];

  const result = await db.query<RawReadingListItem>(
    `SELECT r.id, r.topic_id, r.title, r.summary, r.kind, r.reading_minutes, r.sort_order,
            t.name AS topic_name, sub.name AS subject_name, f.name AS form_name,
            COALESCE(p.status, 'unread') AS status,
            p.last_read_at, p.completed_at
     FROM academic_readings r
     JOIN curriculum_topics t ON t.id = r.topic_id
     JOIN curriculum_subjects sub ON sub.id = t.subject_id
     JOIN curriculum_forms f ON f.id = sub.form_id
     LEFT JOIN academic_reading_progress p
       ON p.reading_id = r.id AND p.student_id = $1
     WHERE r.published = TRUE
       AND ${scopePredicate('$2', '$3')}
       AND ($4::text IS NULL OR r.topic_id = $4)
     ORDER BY f.sort_order, sub.sort_order, t.sort_order, r.sort_order, r.title`,
    [studentId, scope.formId, scope.levelId, options.topicId ?? null],
  );
  return result.rows.map(mapReadingListItem);
}

/**
 * Fetch one reading for a student, with their progress attached.
 * Returns null when the reading is unpublished, missing, or outside the student's level —
 * the caller cannot tell those apart, which is deliberate.
 */
export async function getReadingForStudent(
  db: AcademicDb,
  studentId: string,
  readingId: string,
): Promise<ReadingWithProgress | null> {
  const scope = await getStudentScope(db, studentId);
  if (!scope) return null;

  const result = await db.query<RawReadingWithProgress>(
    `SELECT r.id, r.topic_id, r.title, r.summary, r.body, r.kind, r.source,
            r.reading_minutes, r.sort_order, r.published, r.created_at, r.updated_at,
            t.name AS topic_name, sub.name AS subject_name, f.name AS form_name,
            COALESCE(p.status, 'unread') AS status,
            p.last_read_at, p.completed_at
     FROM academic_readings r
     JOIN curriculum_topics t ON t.id = r.topic_id
     JOIN curriculum_subjects sub ON sub.id = t.subject_id
     JOIN curriculum_forms f ON f.id = sub.form_id
     LEFT JOIN academic_reading_progress p
       ON p.reading_id = r.id AND p.student_id = $1
     WHERE r.id = $4 AND r.published = TRUE AND ${scopePredicate('$2', '$3')}`,
    [studentId, scope.formId, scope.levelId, readingId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { ...mapReading(row), ...mapProgressFields(row), ...mapContextFields(row) };
}

/** True when the reading sits inside the student's curriculum scope. */
export async function canStudentAccessReading(
  db: AcademicDb,
  studentId: string,
  readingId: string,
): Promise<boolean> {
  const scope = await getStudentScope(db, studentId);
  if (!scope) return false;

  // No studentId parameter here: the scope was already resolved from it above, and an
  // unreferenced parameter makes Postgres unable to infer its type.
  const result = await db.query<{ ok: number }>(
    `SELECT 1 AS ok
     FROM academic_readings r
     JOIN curriculum_topics t ON t.id = r.topic_id
     JOIN curriculum_subjects sub ON sub.id = t.subject_id
     JOIN curriculum_forms f ON f.id = sub.form_id
     WHERE r.id = $3 AND r.published = TRUE AND ${scopePredicate('$1', '$2')}`,
    [scope.formId, scope.levelId, readingId],
  );
  return result.rows.length > 0;
}

// ─── Progress ──────────────────────────────────────────────────────────

/**
 * Move a student's reading to a new status.
 *
 * - `reading` stamps last_read_at and clears completed_at
 * - `read`    stamps both last_read_at and completed_at
 * - `unread`  clears both
 *
 * Returns null when the reading is outside the student's level, so a caller can 404
 * instead of silently writing a row for someone else's content.
 */
export async function setReadingStatus(
  db: AcademicDb,
  studentId: string,
  readingId: string,
  status: ReadingStatus,
  at: Date = new Date(),
): Promise<ReadingStatus | null> {
  const allowed = await canStudentAccessReading(db, studentId, readingId);
  if (!allowed) return null;

  const lastReadAt = status === 'unread' ? null : at;
  const completedAt = status === 'read' ? at : null;

  const result = await db.query<{ status: string }>(
    `INSERT INTO academic_reading_progress
       (id, student_id, reading_id, status, last_read_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (student_id, reading_id) DO UPDATE
       SET status = EXCLUDED.status,
           last_read_at = EXCLUDED.last_read_at,
           completed_at = EXCLUDED.completed_at,
           updated_at = NOW()
     RETURNING status`,
    [randomUUID(), studentId, readingId, status, lastReadAt, completedAt],
  );
  const row = result.rows[0];
  return row ? (row.status as ReadingStatus) : null;
}

/** Counts across everything the student can access; readings with no row count as unread. */
export async function getReadingSummary(
  db: AcademicDb,
  studentId: string,
): Promise<ReadingSummary> {
  const scope = await getStudentScope(db, studentId);
  if (!scope) return { unread: 0, reading: 0, read: 0, total: 0 };

  const result = await db.query<{ status: string; cnt: string | number }>(
    `SELECT COALESCE(p.status, 'unread') AS status, COUNT(*) AS cnt
     FROM academic_readings r
     JOIN curriculum_topics t ON t.id = r.topic_id
     JOIN curriculum_subjects sub ON sub.id = t.subject_id
     JOIN curriculum_forms f ON f.id = sub.form_id
     LEFT JOIN academic_reading_progress p
       ON p.reading_id = r.id AND p.student_id = $1
     WHERE r.published = TRUE AND ${scopePredicate('$2', '$3')}
     GROUP BY COALESCE(p.status, 'unread')`,
    [studentId, scope.formId, scope.levelId],
  );

  const byStatus = new Map(result.rows.map((row) => [row.status, Number(row.cnt)]));
  const unread = byStatus.get('unread') ?? 0;
  const reading = byStatus.get('reading') ?? 0;
  const read = byStatus.get('read') ?? 0;
  return { unread, reading, read, total: unread + reading + read };
}

// ─── Parent (mentor) visibility ────────────────────────────────────────

/**
 * Reading activity for a parent's own children only.
 * Only rows with progress are returned — this is a mentor view of engagement,
 * not a full unread backlog per child.
 */
export async function listReadingProgressForParent(
  db: AcademicDb,
  parentId: string,
): Promise<ReadingProgressForStudent[]> {
  const result = await db.query<RawReadingProgressForStudent>(
    `SELECT s.id AS student_id, s.display_name AS student_name,
            r.id AS reading_id, r.title, r.kind,
            t.name AS topic_name, sub.name AS subject_name,
            p.status, p.last_read_at, p.completed_at
     FROM academic_reading_progress p
     JOIN academic_readings r ON r.id = p.reading_id
     JOIN academic_students s ON s.id = p.student_id
     JOIN curriculum_topics t ON t.id = r.topic_id
     JOIN curriculum_subjects sub ON sub.id = t.subject_id
     WHERE s.parent_id = $1
     ORDER BY s.display_name, sub.name, t.name, r.title`,
    [parentId],
  );
  return result.rows.map((row) => ({
    studentId: row.student_id,
    studentName: row.student_name,
    readingId: row.reading_id,
    title: row.title,
    kind: row.kind as ReadingKind,
    topicName: row.topic_name,
    subjectName: row.subject_name,
    status: row.status as ReadingStatus,
    lastReadAt: row.last_read_at ? toDate(row.last_read_at) : null,
    completedAt: row.completed_at ? toDate(row.completed_at) : null,
  }));
}

// ─── Mappers ───────────────────────────────────────────────────────────

const READING_COLUMNS = `SELECT id, topic_id, title, summary, body, kind, source,
       reading_minutes, sort_order, published, created_at, updated_at`;

interface RawReading {
  id: string;
  topic_id: string;
  title: string;
  summary: string;
  body: string;
  kind: string;
  source: string;
  reading_minutes: number;
  sort_order: number;
  published: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface RawReadingListItem {
  id: string;
  topic_id: string;
  title: string;
  summary: string;
  kind: string;
  reading_minutes: number;
  sort_order: number;
  topic_name: string;
  subject_name: string;
  form_name: string;
  status: string;
  last_read_at: Date | string | null;
  completed_at: Date | string | null;
}

interface RawReadingWithProgress extends RawReading {
  topic_name: string;
  subject_name: string;
  form_name: string;
  status: string;
  last_read_at: Date | string | null;
  completed_at: Date | string | null;
}

interface RawReadingProgressForStudent {
  student_id: string;
  student_name: string;
  reading_id: string;
  title: string;
  kind: string;
  topic_name: string;
  subject_name: string;
  status: string;
  last_read_at: Date | string | null;
  completed_at: Date | string | null;
}

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function mapReading(row: RawReading): Reading {
  return {
    id: row.id,
    topicId: row.topic_id,
    title: row.title,
    summary: row.summary,
    body: row.body,
    kind: row.kind as ReadingKind,
    source: row.source as ReadingSource,
    readingMinutes: Number(row.reading_minutes),
    sortOrder: Number(row.sort_order),
    published: Boolean(row.published),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

function mapProgressFields(row: {
  status: string;
  last_read_at: Date | string | null;
  completed_at: Date | string | null;
}) {
  return {
    status: row.status as ReadingStatus,
    lastReadAt: row.last_read_at ? toDate(row.last_read_at) : null,
    completedAt: row.completed_at ? toDate(row.completed_at) : null,
  };
}

function mapContextFields(row: { topic_name: string; subject_name: string; form_name: string }) {
  return {
    topicName: row.topic_name,
    subjectName: row.subject_name,
    formName: row.form_name,
  };
}

function mapReadingListItem(row: RawReadingListItem): ReadingListItem {
  return {
    id: row.id,
    topicId: row.topic_id,
    title: row.title,
    summary: row.summary,
    kind: row.kind as ReadingKind,
    readingMinutes: Number(row.reading_minutes),
    sortOrder: Number(row.sort_order),
    ...mapContextFields(row),
    ...mapProgressFields(row),
  };
}
